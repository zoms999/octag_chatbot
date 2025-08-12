"""
Legacy Query Integration Wrapper
Wraps existing AptitudeTestQueries class with async interface and error handling
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
from datetime import datetime
import traceback
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

@dataclass
class QueryResult:
    """Result container for query execution"""
    query_name: str
    success: bool
    data: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None
    row_count: Optional[int] = None

class QueryExecutionError(Exception):
    """Raised when query execution fails"""
    def __init__(self, query_name: str, original_error: Exception):
        self.query_name = query_name
        self.original_error = original_error
        super().__init__(f"Query '{query_name}' failed: {str(original_error)}")

class QueryValidationError(Exception):
    """Raised when query result validation fails"""
    def __init__(self, query_name: str, validation_error: str):
        self.query_name = query_name
        self.validation_error = validation_error
        super().__init__(f"Query '{query_name}' validation failed: {validation_error}")

class AptitudeTestQueries:
    """
    실제 레거시 DB의 mwd_* 테이블을 조회하여 결과를 반환하는 구현.
    PDF_RESULT.MD에 정의된 쿼리를 기반으로, 파이프라인에서 사용하는 키 이름에 맞춰 최소 핵심 결과를 제공합니다.
    """

    def __init__(self, _unused_session: Session):
        # 파이프라인에서 AsyncSession 이 넘어오므로, 레거시 조회는 동기 세션을 별도로 연다
        from database.connection import db_manager
        self._sync_sess = db_manager.get_sync_session()

    def _run(self, sql: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        rows = self._sync_sess.execute(text(sql), params).mappings().all()
        return [dict(r) for r in rows]

    def _query_tendency(self, anp_seq: int) -> List[Dict[str, Any]]:
        sql = """
        select max(case when rk = 1 then tnd end) as "Tnd1",
               max(case when rk = 2 then tnd end) as "Tnd2"
        from (
          select replace(qa.qua_name,'형','') as tnd, 1 as rk
          from mwd_resval rv, mwd_question_attr qa
          where rv.anp_seq = :anp_seq and qa.qua_code = rv.rv_tnd1
          union
          select replace(qa.qua_name,'형','') as tnd, 2 as rk
          from mwd_resval rv, mwd_question_attr qa
          where rv.anp_seq = :anp_seq and qa.qua_code = rv.rv_tnd2
        ) t
        """
        return self._run(sql, {"anp_seq": anp_seq})

    def _query_top_tendency(self, anp_seq: int) -> List[Dict[str, Any]]:
        sql = """
        select qa.qua_name as tendency_name,
               sc1.sc1_rank as rank,
               sc1.qua_code as code,
               (round(sc1.sc1_rate * 100))::int as score
        from mwd_score1 sc1, mwd_question_attr qa
        where sc1.anp_seq = :anp_seq and sc1.sc1_step='tnd' and sc1.sc1_rank <= 3
          and qa.qua_code = sc1.qua_code
        order by sc1.sc1_rank
        """
        return self._run(sql, {"anp_seq": anp_seq})

    def _query_career_recommendation(self, anp_seq: int) -> List[Dict[str, Any]]:
        # PDF의 suitableJobsDetailQuery를 기반으로 job_code 포함, match_score는 가중치 없음으로 80 고정
        sql = """
        select jo.jo_code as job_code,
               jo.jo_name as job_name,
               coalesce(jo.jo_outline, '') as job_outline,
               coalesce(jo.jo_mainbusiness, '') as main_business,
               80::int as match_score
        from mwd_resjob rj, mwd_job jo
        where rj.anp_seq = :anp_seq
          and rj.rej_kind = 'rtnd'
          and jo.jo_code = rj.rej_code
          and rj.rej_rank <= 7
        order by rj.rej_rank
        """
        return self._run(sql, {"anp_seq": anp_seq})

    def _query_thinking_skills(self, anp_seq: int) -> List[Dict[str, Any]]:
        # PDF의 thinkingScoreQuery를 요약하여 8대 영역을 이름/점수로 매핑
        sql = """
        select qa.qua_name as skill_name,
               coalesce(round(sc1.sc1_rate * 100), 0)::int as score,
               coalesce(round(sc1.sc1_rate * 100), 0)::int as percentile
        from mwd_score1 sc1
        join mwd_question_attr qa on qa.qua_code = sc1.qua_code
        where sc1.anp_seq = :anp_seq and sc1.sc1_step = 'thk'
        order by qa.qua_name
        """
        return self._run(sql, {"anp_seq": anp_seq})

    def _query_bottom_tendency(self, anp_seq: int) -> List[Dict[str, Any]]:
        sql = """
        select qa.qua_name as tendency_name,
               sc1.sc1_rank as rank,
               sc1.qua_code as code,
               (round(sc1.sc1_rate * 100))::int as score
        from mwd_score1 sc1, mwd_question_attr qa
        where sc1.anp_seq = :anp_seq and sc1.sc1_step='tnd'
        and sc1.sc1_rank > (select count(*) from mwd_score1 where anp_seq = :anp_seq and sc1_step='tnd') - 3
        and qa.qua_code = sc1.qua_code
        order by sc1.sc1_rank desc
        """
        return self._run(sql, {"anp_seq": anp_seq})

    def _query_personality_detail(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #10 쿼리(detailedPersonalityAnalysisQuery) 기반
        sql = """
        select qu.qu_explain as detail_description,
               sc1.sc1_rank as rank,
               an.an_wei as weight,
               sc1.qua_code as code
        from mwd_answer an, mwd_question qu,
        (select qua_code, sc1_rank from mwd_score1 sc1
         where anp_seq = :anp_seq and sc1_step='tnd' and sc1_rank <= 3) sc1
        where an.anp_seq = :anp_seq
        and qu.qu_code = an.qu_code and qu.qu_use = 'Y'
        and qu.qu_qusyn = 'Y' and qu.qu_kind1 = 'tnd'
        and an.an_wei >= 4 and qu.qu_kind2 = sc1.qua_code
        order by sc1.sc1_rank, an.an_wei desc
        """
        return self._run(sql, {"anp_seq": anp_seq})

    def _query_strengths_weaknesses(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 강점/약점 데이터가 별도로 없으므로, 원본 #9 쿼리를 변형하여
        # 가장 강하게 응답한 문항을 '강점'으로, 약하게 응답한 문항을 '약점'으로 간주
        sql = """
        (
            -- 강점: 상위 3개 성향 관련, 긍정적으로 높게 응답한 문항
            select qu.qu_explain as description,
                   'strength' as type,
                   an.an_wei as weight
            from mwd_answer an
            join mwd_question qu on an.qu_code = qu.qu_code
            join (select qua_code from mwd_score1 where anp_seq = :anp_seq and sc1_step = 'tnd' and sc1_rank <= 3) as top_tnd
                 on qu.qu_kind2 = top_tnd.qua_code
            where an.anp_seq = :anp_seq and qu.qu_kind1 = 'tnd' and an.an_wei >= 4
            order by an.an_wei desc
            limit 5
        )
        union all
        (
            -- 약점: 하위 3개 성향 관련, 부정적으로 높게 응답한 문항 (an_wei <= 2)
            select qu.qu_explain as description,
                   'weakness' as type,
                   an.an_wei as weight
            from mwd_answer an
            join mwd_question qu on an.qu_code = qu.qu_code
            join (select qua_code from mwd_score1 where anp_seq = :anp_seq and sc1_step = 'tnd' and sc1_rank > (select count(*) from mwd_score1 where anp_seq = :anp_seq and sc1_step='tnd') - 3) as bottom_tnd
                 on qu.qu_kind2 = bottom_tnd.qua_code
            where an.anp_seq = :anp_seq and qu.qu_kind1 = 'tnd' and an.an_wei <= 2
            order by an.an_wei asc
            limit 5
        )
        """
        return self._run(sql, {"anp_seq": anp_seq})
        
    def _query_learning_style(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #30 쿼리(learningStyleQuery) 기반
        sql = """
        SELECT
            (SELECT REPLACE(qa.qua_name, '형', '') FROM mwd_question_attr qa WHERE qa.qua_code = rv.rv_tnd1) AS tnd1_name,
            REPLACE(ts1.tes_study_tendency, 'OOO', pe.pe_name || '님') AS tnd1_study_tendency,
            REPLACE(ts1.tes_study_way, 'OOO', pe.pe_name || '님') AS tnd1_study_way,
            (SELECT REPLACE(qa.qua_name, '형', '') FROM mwd_question_attr qa WHERE qa.qua_code = rv.rv_tnd2) AS tnd2_name,
            REPLACE(ts2.tes_study_tendency, 'OOO', pe.pe_name || '님') AS tnd2_study_tendency,
            REPLACE(ts2.tes_study_way, 'OOO', pe.pe_name || '님') AS tnd2_study_way,
            CAST(SUBSTRING(rv.rv_tnd1, 4, 2) AS INT) - 10 AS tnd_row,
            CAST(SUBSTRING(rv.rv_tnd2, 4, 2) AS INT) - 10 AS tnd_col
        FROM mwd_resval rv
        JOIN mwd_tendency_study ts1 ON ts1.qua_code = rv.rv_tnd1
        JOIN mwd_tendency_study ts2 ON ts2.qua_code = rv.rv_tnd2
        JOIN mwd_answer_progress ap ON ap.anp_seq = rv.anp_seq
        JOIN mwd_account ac ON ac.ac_gid = ap.ac_gid
        JOIN mwd_person pe ON pe.pe_seq = ac.pe_seq
        WHERE rv.anp_seq = :anp_seq
        """
        return self._run(sql, {"anp_seq": anp_seq})

    def _query_learning_style_chart(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #31 쿼리(style1ChartQuery) 기반
        sql = """
        SELECT
            sr.sw_kindname AS item_name,
            CAST(sr.sw_rate * 100 AS INT) AS item_rate,
            CASE
              WHEN sr.sw_color LIKE '#%%' THEN sr.sw_color
              ELSE REPLACE(REPLACE(sr.sw_color, 'rgb(', 'rgba('), ')', ', 0.8)')
            END AS item_color,
            sr.sw_type AS item_type
        FROM mwd_resval rv
        JOIN mwd_studyway_rate sr ON sr.qua_code = rv.rv_tnd1
        WHERE rv.anp_seq = :anp_seq
        ORDER BY sr.sw_type, sr.sw_kind
        """
        return self._run(sql, {"anp_seq": anp_seq})

        # ▼▼▼ [3단계: 추가된 메소드 1] ▼▼▼
    def _query_competency_analysis(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #22 쿼리(talentDetailsQuery) 기반, 백분위(percentile) 계산 로직 포함
        sql = """
        WITH ranked_scores AS (
            SELECT
                anp_seq, qua_code, sc1_rate,
                PERCENT_RANK() OVER (PARTITION BY qua_code ORDER BY sc1_rate) as percentile_rank
            FROM mwd_score1
            WHERE sc1_step = 'tal'
        )
        SELECT
            qa.qua_name as competency_name,
            (round(sc1.sc1_rate * 100))::int as score,
            sc1.sc1_rank as rank,
            REPLACE(qe.que_explain, 'OOO', pe.pe_name || '님') as description,
            (round(rs.percentile_rank * 100))::int as percentile
        FROM mwd_score1 sc1
        JOIN mwd_question_attr qa ON qa.qua_code = sc1.qua_code
        JOIN mwd_question_explain qe ON qe.qua_code = sc1.qua_code
        JOIN mwd_answer_progress ap ON ap.anp_seq = sc1.anp_seq
        JOIN mwd_account ac ON ac.ac_gid = ap.ac_gid
        JOIN mwd_person pe ON pe.pe_seq = ac.pe_seq
        JOIN ranked_scores rs ON rs.anp_seq = sc1.anp_seq AND rs.qua_code = sc1.qua_code
        WHERE sc1.anp_seq = :anp_seq
          AND sc1.sc1_step = 'tal'
          AND sc1.sc1_rank <= 5
        ORDER BY sc1.sc1_rank
        """
        return self._run(sql, {"anp_seq": anp_seq})

    # ▼▼▼ [3단계: 추가된 메소드 2] ▼▼▼
    def _query_competency_subjects(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #36 쿼리(competencySubjectsQuery) 기반
        sql = """
        WITH Top5Competencies AS (
          SELECT sc1.sc1_rank, sc1.qua_code, qa.qua_name
          FROM mwd_score1 sc1 JOIN mwd_question_attr qa ON sc1.qua_code = qa.qua_code
          WHERE sc1.anp_seq = :anp_seq AND sc1.sc1_step = 'tal' AND sc1.sc1_rank <= 5
        )
        SELECT
          t5c.sc1_rank AS competency_rank, t5c.qua_name AS competency_name,
          t5c.qua_code AS competency_code, mcs.mcs_group AS subject_group,
          mcs.mcs_area AS subject_area, mcs.mcs_name AS subject_name,
          mcs.mcs_explain AS subject_explain, mcs.mcs_rank AS subject_rank
        FROM mwd_competency_subject_map mcs
        JOIN Top5Competencies t5c ON mcs.tal_code = t5c.qua_code
        WHERE mcs.mcs_use = 'Y'
        ORDER BY t5c.sc1_rank, mcs.mcs_rank
        """
        return self._run(sql, {"anp_seq": anp_seq})

    # ▼▼▼ [3단계: 추가된 메소드 3] ▼▼▼
    def _query_competency_jobs(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #27 쿼리(competencyJobsQuery) 기반
        sql = """
        SELECT
          jo.jo_name, jo.jo_outline, jo.jo_mainbusiness, rj.rej_rank as rank
        FROM mwd_resjob rj JOIN mwd_job jo ON jo.jo_code = rj.rej_code
        WHERE rj.anp_seq = :anp_seq AND rj.rej_kind = 'rtal' AND rj.rej_rank <= 7
        ORDER BY rj.rej_rank
        """
        return self._run(sql, {"anp_seq": anp_seq})

    # ▼▼▼ [3단계: 추가된 메소드 4] ▼▼▼
    def _query_competency_job_majors(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #28 쿼리(competencyJobMajorsQuery) 기반
        sql = """
        SELECT
          jo.jo_name, string_agg(ma.ma_name, ', ' ORDER BY ma.ma_name) AS major
        FROM mwd_resjob rj
        JOIN mwd_job jo ON jo.jo_code = rj.rej_code
        JOIN mwd_job_major_map jmm ON jmm.jo_code = rj.rej_code
        JOIN mwd_major ma ON ma.ma_code = jmm.ma_code
        WHERE rj.anp_seq = :anp_seq AND rj.rej_kind = 'rtal' AND rj.rej_rank <= 7
        GROUP BY jo.jo_code, rj.rej_rank
        ORDER BY rj.rej_rank
        """
        return self._run(sql, {"anp_seq": anp_seq})
    
    # ▼▼▼ [3단계: 추가된 메소드 5] ▼▼▼
    def _query_duties(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #29 쿼리(dutiesQuery) 기반
        sql = """
        SELECT
          du.du_name, du.du_outline as du_content,
          du.du_department as majors, 'IT 계열' as jf_name,
          (100 - (rd.red_rank * 10)) as match_rate
        FROM mwd_resduty rd, mwd_duty du
        WHERE rd.anp_seq = :anp_seq AND rd.red_kind = 'rtnd'
          AND du.du_code = rd.red_code AND rd.red_rank <= 5
        ORDER BY rd.red_rank
        """
        return self._run(sql, {"anp_seq": anp_seq})

    # ▼▼▼ [4단계: 추가된 메소드 1] ▼▼▼
    def _query_image_preference_stats(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #19 쿼리(imagePreferenceQuery) 기반
        sql = """
        SELECT
          rv.rv_imgtcnt AS total_image_count,
          rv.rv_imgrcnt AS response_count,
          (rv.rv_imgresrate * 100)::int AS response_rate
        FROM mwd_resval rv
        WHERE rv.anp_seq = :anp_seq
        """
        return self._run(sql, {"anp_seq": anp_seq})

    # ▼▼▼ [4단계: 추가된 메소드 2] ▼▼▼
    def _query_preference_data(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #23 쿼리(preferenceDataQuery) 기반
        sql = """
        SELECT
            qa.qua_name as preference_name,
            sc1.sc1_qcnt as question_count,
            (round(sc1.sc1_resrate * 100))::int AS response_rate,
            sc1.sc1_rank as rank,
            qe.que_explain as description
        FROM mwd_score1 sc1
        JOIN mwd_question_attr qa ON qa.qua_code = sc1.qua_code
        JOIN mwd_question_explain qe ON qe.qua_code = qa.qua_code AND qe.que_switch = 1
        WHERE sc1.anp_seq = :anp_seq
          AND sc1.sc1_step = 'img'
          AND sc1.sc1_rank <= 3
        ORDER BY sc1.sc1_rank
        """
        return self._run(sql, {"anp_seq": anp_seq})

    # ▼▼▼ [4단계: 추가된 메소드 3] ▼▼▼
    def _query_preference_jobs(self, anp_seq: int) -> List[Dict[str, Any]]:
        # 원본 #24, 25, 26 쿼리를 하나로 통합
        sql = """
        SELECT
          qa.qua_name as preference_name,
          rj.rej_kind as preference_type, -- rimg1, rimg2, rimg3
          jo.jo_name,
          jo.jo_outline,
          jo.jo_mainbusiness,
          string_agg(ma.ma_name, ', ' ORDER BY ma.ma_name) AS majors
        FROM mwd_resjob rj
        JOIN mwd_job jo ON jo.jo_code = rj.rej_code
        JOIN mwd_job_major_map jmm ON jmm.jo_code = jo.jo_code
        JOIN mwd_major ma ON ma.ma_code = jmm.ma_code
        LEFT OUTER JOIN mwd_question_attr qa ON qa.qua_code = rj.rej_quacode
        WHERE rj.anp_seq = :anp_seq
          AND rj.rej_kind IN ('rimg1', 'rimg2', 'rimg3')
          AND rj.rej_rank <= 5
        GROUP BY rj.rej_kind, qa.qua_name, jo.jo_code, rj.rej_rank
        ORDER BY rj.rej_kind, rj.rej_rank
        """
        return self._run(sql, {"anp_seq": anp_seq})

    def execute_all_queries(self, anp_seq: int) -> Dict[str, List[Dict[str, Any]]]:
        results: Dict[str, List[Dict[str, Any]]] = {}

        # --- 1단계까지 구현된 쿼리 호출 ---
        try: results["tendencyQuery"] = self._query_tendency(anp_seq)
        except Exception: results["tendencyQuery"] = []
        try: results["topTendencyQuery"] = self._query_top_tendency(anp_seq)
        except Exception: results["topTendencyQuery"] = []
        try: results["thinkingSkillsQuery"] = self._query_thinking_skills(anp_seq)
        except Exception: results["thinkingSkillsQuery"] = []
        try: results["careerRecommendationQuery"] = self._query_career_recommendation(anp_seq)
        except Exception: results["careerRecommendationQuery"] = []
        try: results["bottomTendencyQuery"] = self._query_bottom_tendency(anp_seq)
        except Exception: results["bottomTendencyQuery"] = []
        try: results["personalityDetailQuery"] = self._query_personality_detail(anp_seq)
        except Exception: results["personalityDetailQuery"] = []
        try: results["strengthsWeaknessesQuery"] = self._query_strengths_weaknesses(anp_seq)
        except Exception: results["strengthsWeaknessesQuery"] = []

        # --- 2단계 추가 쿼리 호출 ---
        try:
            results["learningStyleQuery"] = self._query_learning_style(anp_seq)
        except Exception:
            results["learningStyleQuery"] = []
        try:
            results["learningStyleChartQuery"] = self._query_learning_style_chart(anp_seq)
        except Exception:
            results["learningStyleChartQuery"] = []

        # ▼▼▼ [3단계: 추가된 쿼리 호출] ▼▼▼
        try: results["competencyAnalysisQuery"] = self._query_competency_analysis(anp_seq)
        except: results["competencyAnalysisQuery"] = []
        try: results["competencySubjectsQuery"] = self._query_competency_subjects(anp_seq)
        except: results["competencySubjectsQuery"] = []
        try: results["competencyJobsQuery"] = self._query_competency_jobs(anp_seq)
        except: results["competencyJobsQuery"] = []
        try: results["competencyJobMajorsQuery"] = self._query_competency_job_majors(anp_seq)
        except: results["competencyJobMajorsQuery"] = []
        try: results["dutiesQuery"] = self._query_duties(anp_seq)
        except: results["dutiesQuery"] = []

        # ▼▼▼ [4단계: 추가된 쿼리 호출] ▼▼▼
        try: results["imagePreferenceStatsQuery"] = self._query_image_preference_stats(anp_seq)
        except: results["imagePreferenceStatsQuery"] = []
        try: results["preferenceDataQuery"] = self._query_preference_data(anp_seq)
        except: results["preferenceDataQuery"] = []
        try: results["preferenceJobsQuery"] = self._query_preference_jobs(anp_seq)
        except: results["preferenceJobsQuery"] = []


       # [수정] 4단계에서 구현된 키는 이 목록에서 제외되어야 합니다.
        remaining_keys = [
            "jobMatchingQuery","majorRecommendationQuery",
            "studyMethodQuery","socialSkillsQuery","leadershipQuery","communicationQuery","problemSolvingQuery",
            "creativityQuery","analyticalThinkingQuery","practicalThinkingQuery","abstractThinkingQuery","memoryQuery",
            "attentionQuery","processingSpeedQuery","spatialAbilityQuery","verbalAbilityQuery","numericalAbilityQuery",
            "reasoningQuery","perceptionQuery","motivationQuery","interestQuery","valueQuery","workStyleQuery",
            "environmentPreferenceQuery","teamworkQuery","independenceQuery","stabilityQuery","challengeQuery"
        ]
        for key in remaining_keys:
            results.setdefault(key, [])

        return results

class LegacyQueryExecutor:
    """
    Async wrapper for existing AptitudeTestQueries class
    Provides error handling, retry logic, and result validation
    """
    
    def __init__(self, max_retries: int = 3, retry_delay: float = 1.0, max_workers: int = 4, query_timeout: float = 120.0):
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.query_validators = self._setup_validators()
        self.query_timeout = query_timeout
        
    def _setup_validators(self) -> Dict[str, callable]:
        """Setup validation functions for different query types"""
        return {
            # ... (기존 9개 유효성 검사기) ...
            "learningStyleQuery": self._validate_learning_style_query,
            "learningStyleChartQuery": self._validate_learning_style_chart_query,
            # ▼▼▼ [3단계: 추가된 쿼리 유효성 검사기] ▼▼▼
            "competencyAnalysisQuery": self._validate_competency_analysis_query,
            "competencySubjectsQuery": self._validate_competency_subjects_query,
            "competencyJobsQuery": self._validate_competency_jobs_query,
            "competencyJobMajorsQuery": self._validate_competency_job_majors_query,
            "dutiesQuery": self._validate_duties_query,
            # ▼▼▼ [4단계: 추가된 쿼리 유효성 검사기] ▼▼▼
            "imagePreferenceStatsQuery": self._validate_image_preference_stats_query,
            "preferenceDataQuery": self._validate_preference_data_query,
            "preferenceJobsQuery": self._validate_preference_jobs_query,
        }
    
    def _validate_tendency_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate tendency query results"""
        if not data or len(data) == 0:
            return False
        
        first_row = data[0]
        required_fields = ["Tnd1", "Tnd2"]
        
        for field in required_fields:
            if field not in first_row or not first_row[field]:
                logger.warning(f"Missing or empty required field '{field}' in tendency query")
                return False
                
        return True
    
    def _validate_top_tendency_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate top/bottom tendency query results."""
        if data is None:
            return False
        if len(data) == 0:
            return True
            
        required_fields = ["rank", "tendency_name", "code", "score"]
        
        for row in data:
            for field in required_fields:
                if field not in row:
                    logger.warning(f"Missing required field '{field}' in top/bottom tendency query")
                    return False
                    
            if not isinstance(row.get("rank"), int) or not isinstance(row.get("score"), (int, float)):
                logger.warning("Invalid data types in top/bottom tendency query")
                return False
                
        return True
    
    def _validate_thinking_skills_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate thinking skills query results."""
        if data is None:
            return False
        if len(data) == 0:
            return True
            
        required_fields = ["skill_name", "score", "percentile"]
        
        for row in data:
            for field in required_fields:
                if field not in row:
                    logger.warning(f"Missing required field '{field}' in thinking skills query")
                    return False
                    
            score = row.get("score")
            percentile = row.get("percentile")
            
            if not isinstance(score, (int, float)) or not 0 <= score <= 100:
                logger.warning(f"Invalid score value: {score}")
                return False
                
            if not isinstance(percentile, (int, float)) or not 0 <= percentile <= 100:
                logger.warning(f"Invalid percentile value: {percentile}")
                return False
                
        return True
    
    def _validate_career_recommendation_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate career recommendation query results"""
        if not data:
            return False
            
        required_fields = ["job_code", "job_name", "match_score"]
        
        for row in data:
            for field in required_fields:
                if field not in row or not row[field]:
                    logger.warning(f"Missing or empty required field '{field}' in career recommendation query")
                    return False
                    
            match_score = row.get("match_score")
            if not isinstance(match_score, (int, float)) or not 0 <= match_score <= 100:
                logger.warning(f"Invalid match_score value: {match_score}")
                return False
                
        return True

    def _validate_personality_detail_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate personality detail query results."""
        if data is None: return False
        if not data: return True

        required_fields = ["detail_description", "rank", "weight", "code"]
        for row in data:
            for field in required_fields:
                if field not in row:
                    logger.warning(f"Missing required field '{field}' in personalityDetailQuery")
                    return False
        return True

    def _validate_strengths_weaknesses_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate strengths/weaknesses query results."""
        if data is None: return False
        if not data: return True

        required_fields = ["description", "type", "weight"]
        for row in data:
            for field in required_fields:
                if field not in row:
                    logger.warning(f"Missing required field '{field}' in strengthsWeaknessesQuery")
                    return False
            if row.get("type") not in ["strength", "weakness"]:
                logger.warning(f"Invalid type value in strengthsWeaknessesQuery: {row.get('type')}")
                return False
        return True
        
    def _validate_learning_style_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate learning style query results."""
        if not data or len(data) != 1:
            logger.warning(f"learningStyleQuery should return exactly one row, but got {len(data)}")
            return False
        
        required_fields = [
            "tnd1_name", "tnd1_study_tendency", "tnd1_study_way",
            "tnd2_name", "tnd2_study_tendency", "tnd2_study_way",
            "tnd_row", "tnd_col"
        ]
        row = data[0]
        for field in required_fields:
            if field not in row:
                logger.warning(f"Missing required field '{field}' in learningStyleQuery")
                return False
        
        if not isinstance(row.get("tnd_row"), int) or not isinstance(row.get("tnd_col"), int):
            logger.warning("Invalid data types for coordinates in learningStyleQuery")
            return False
            
        return True

    def _validate_learning_style_chart_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate learning style chart query results."""
        if data is None: return False
        if not data: return True

        required_fields = ["item_name", "item_rate", "item_color", "item_type"]
        for row in data:
            for field in required_fields:
                if field not in row:
                    logger.warning(f"Missing required field '{field}' in learningStyleChartQuery")
                    return False
            
            rate = row.get("item_rate")
            if not isinstance(rate, int) or not 0 <= rate <= 100:
                logger.warning(f"Invalid item_rate value: {rate}")
                return False

            if row.get("item_type") not in ["S", "W"]:
                logger.warning(f"Invalid item_type value: {row.get('item_type')}")
                return False
        return True

        # ▼▼▼ [3단계: 추가된 유효성 검사 메소드] ▼▼▼
    def _validate_competency_analysis_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate competency analysis query results."""
        if data is None: return False
        if not data: return True # 데이터가 없는 경우는 허용
        
        required_fields = ["competency_name", "score", "rank", "description", "percentile"]
        for row in data:
            for field in required_fields:
                if field not in row:
                    logger.warning(f"Missing required field '{field}' in competencyAnalysisQuery")
                    return False
            if not isinstance(row.get("score"), int) or not isinstance(row.get("rank"), int) or not isinstance(row.get("percentile"), int):
                logger.warning(f"Invalid data types in competencyAnalysisQuery for row: {row}")
                return False
        return True

    def _validate_competency_subjects_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate competency subjects query results."""
        if data is None: return False
        if not data: return True # 데이터가 없는 경우는 허용

        required_fields = ["competency_rank", "competency_name", "subject_group", "subject_area", "subject_name", "subject_explain", "subject_rank"]
        for row in data:
            for field in required_fields:
                if field not in row:
                    logger.warning(f"Missing required field '{field}' in competencySubjectsQuery")
                    return False
        return True

    def _validate_competency_jobs_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate competency jobs query results."""
        if data is None: return False
        if not data: return True
        required_fields = ["jo_name", "jo_outline", "jo_mainbusiness", "rank"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True

    def _validate_competency_job_majors_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate competency job majors query results."""
        if data is None: return False
        if not data: return True
        required_fields = ["jo_name", "major"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True
    
    def _validate_duties_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate duties query results."""
        if data is None: return False
        if not data: return True
        required_fields = ["du_name", "du_content", "majors", "jf_name", "match_rate"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True

    # ▼▼▼ [4단계: 추가된 유효성 검사 메소드] ▼▼▼
    def _validate_image_preference_stats_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate image preference stats query results."""
        if data is None: return False
        if not data: return True
        if len(data) != 1: return False
        
        required_fields = ["total_image_count", "response_count", "response_rate"]
        for field in required_fields:
            if field not in data[0]: return False
        return True

    def _validate_preference_data_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate preference data query results."""
        if data is None: return False
        if not data: return True
        
        required_fields = ["preference_name", "question_count", "response_rate", "rank", "description"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True

    def _validate_preference_jobs_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate preference jobs query results."""
        if data is None: return False
        if not data: return True
        
        required_fields = ["preference_name", "preference_type", "jo_name", "jo_outline", "jo_mainbusiness", "majors"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
            if row.get("preference_type") not in ["rimg1", "rimg2", "rimg3"]: return False
        return True

    def _validate_query_result(self, query_name: str, data: List[Dict[str, Any]]) -> bool:
        """Validate query result using appropriate validator"""
        validator = self.query_validators.get(query_name)
        
        if validator:
            try:
                return validator(data)
            except Exception as e:
                logger.error(f"Validation error for query '{query_name}': {e}")
                return False
        else:
            # Generic validation for unknown query types
            return data is not None and isinstance(data, list)
    
    def _clean_query_data(self, query_name: str, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Clean and normalize query data"""
        if not data:
            return []
            
        cleaned_data = []
        
        for row in data:
            cleaned_row = {}
            
            for key, value in row.items():
                if value is not None and value != "":
                    if isinstance(value, str):
                        cleaned_row[key] = value.strip()
                    else:
                        cleaned_row[key] = value
                        
            if cleaned_row:
                cleaned_data.append(cleaned_row)
                
        return cleaned_data
    
    async def _execute_single_query_with_retry(
        self, 
        session: Session, 
        anp_seq: int, 
        query_name: str
    ) -> QueryResult:
        """Execute a single query with retry logic"""
        
        for attempt in range(self.max_retries + 1):
            start_time = datetime.now()
            logger.info(f"Query '{query_name}' attempting to execute (attempt {attempt + 1})")
            try:
                loop = asyncio.get_event_loop()

                def execute_query():
                    aptitude_queries = AptitudeTestQueries(session)
                    all_results = aptitude_queries.execute_all_queries(anp_seq)
                    return all_results.get(query_name, [])

                try:
                    data = await asyncio.wait_for(
                        loop.run_in_executor(self.executor, execute_query),
                        timeout=self.query_timeout,
                    )
                except asyncio.TimeoutError:
                    execution_time = (datetime.now() - start_time).total_seconds()
                    logger.error(f"Query '{query_name}' timed out after {self.query_timeout}s")
                    if attempt < self.max_retries:
                        wait_time = self.retry_delay * (2 ** attempt)
                        logger.warning(f"Retrying '{query_name}' in {wait_time}s due to timeout (attempt {attempt + 1}/{self.max_retries + 1})")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        return QueryResult(
                            query_name=query_name,
                            success=False,
                            error=f"timeout after {self.query_timeout}s",
                            execution_time=execution_time,
                        )
                execution_time = (datetime.now() - start_time).total_seconds()
                
                cleaned_data = self._clean_query_data(query_name, data)
                
                if not self._validate_query_result(query_name, cleaned_data):
                    raise QueryValidationError(
                        query_name, 
                        f"Query result validation failed for {query_name}"
                    )
                
                logger.info(
                    f"Query '{query_name}' executed successfully in {execution_time:.2f}s, "
                    f"returned {len(cleaned_data)} rows"
                )
                
                return QueryResult(
                    query_name=query_name,
                    success=True,
                    data=cleaned_data,
                    execution_time=execution_time,
                    row_count=len(cleaned_data)
                )
                
            except Exception as e:
                execution_time = (datetime.now() - start_time).total_seconds()
                
                if attempt < self.max_retries:
                    wait_time = self.retry_delay * (2 ** attempt)
                    logger.warning(
                        f"Query '{query_name}' failed on attempt {attempt + 1}/{self.max_retries + 1}: {e}. "
                        f"Retrying in {wait_time}s..."
                    )
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(
                        f"Query '{query_name}' failed after {self.max_retries + 1} attempts: {e}\n"
                        f"Traceback: {traceback.format_exc()}"
                    )
                    
                    return QueryResult(
                        query_name=query_name,
                        success=False,
                        error=str(e),
                        execution_time=execution_time
                    )
        
        return QueryResult(
            query_name=query_name,
            success=False,
            error="Unknown error occurred"
        )
    
    async def execute_all_queries_async(
        self, 
        session: Session, 
        anp_seq: int
    ) -> Dict[str, QueryResult]:
        """
        Execute all queries asynchronously with error handling and retry logic
        """
        
        query_names = [
            # --- 2단계까지 구현된 쿼리 ---
            "tendencyQuery",
            "topTendencyQuery", 
            "thinkingSkillsQuery",
            "careerRecommendationQuery",
            "bottomTendencyQuery",
            "personalityDetailQuery",
            "strengthsWeaknessesQuery",
            "learningStyleQuery",
            "learningStyleChartQuery",

            # --- 3단계 신규 쿼리 ---
            "competencyAnalysisQuery",
            "competencySubjectsQuery",
            "competencyJobsQuery",
            "competencyJobMajorsQuery",
            "dutiesQuery",

            # --- 4단계 신규 쿼리 ---
            "imagePreferenceStatsQuery",
            "preferenceDataQuery",
            "preferenceJobsQuery",

            # --- 향후 추가될 쿼리 (자리 표시) ---
            "jobMatchingQuery",
            "majorRecommendationQuery",
            "studyMethodQuery",
            "socialSkillsQuery",
            "leadershipQuery",
            "communicationQuery",
            "problemSolvingQuery",
            "creativityQuery",
            "analyticalThinkingQuery",
            "practicalThinkingQuery",
            "abstractThinkingQuery",
            "memoryQuery",
            "attentionQuery",
            "processingSpeedQuery",
            "spatialAbilityQuery",
            "verbalAbilityQuery",
            "numericalAbilityQuery",
            "reasoningQuery",
            "perceptionQuery",
            "motivationQuery",
            "interestQuery",
            "valueQuery",
            "workStyleQuery",
            "environmentPreferenceQuery",
            "teamworkQuery",
            "independenceQuery",
            "stabilityQuery",
            "challengeQuery"
        ]
        
        logger.info(f"Starting execution of {len(query_names)} queries for anp_seq: {anp_seq}")
        
        tasks = [
            self._execute_single_query_with_retry(session, anp_seq, query_name)
            for query_name in query_names
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        query_results = {}
        successful_queries = 0
        failed_queries = 0
        
        for i, result in enumerate(results):
            query_name = query_names[i]
            
            if isinstance(result, Exception):
                logger.error(f"Unexpected error for query '{query_name}': {result}")
                query_results[query_name] = QueryResult(
                    query_name=query_name,
                    success=False,
                    error=str(result)
                )
                failed_queries += 1
            else:
                query_results[query_name] = result
                if result.success:
                    successful_queries += 1
                else:
                    failed_queries += 1
        
        logger.info(
            f"Query execution completed for anp_seq: {anp_seq}. "
            f"Successful: {successful_queries}, Failed: {failed_queries}"
        )
        
        return query_results
    
    async def get_successful_results(
        self, 
        query_results: Dict[str, QueryResult]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Extract only successful query results in the format expected by DocumentTransformer
        """
        
        successful_results = {}
        
        for query_name, result in query_results.items():
            if result.success and result.data is not None:
                successful_results[query_name] = result.data
            else:
                logger.warning(f"Excluding failed query '{query_name}' from results")
        
        return successful_results
    
    async def close(self):
        """Clean up resources"""
        if self.executor:
            self.executor.shutdown(wait=True)
            logger.info("LegacyQueryExecutor resources cleaned up")