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

    def execute_all_queries(self, anp_seq: int) -> Dict[str, List[Dict[str, Any]]]:
        results: Dict[str, List[Dict[str, Any]]] = {}

        try:
            results["tendencyQuery"] = self._query_tendency(anp_seq)
        except Exception:
            results["tendencyQuery"] = []

        try:
            results["topTendencyQuery"] = self._query_top_tendency(anp_seq)
        except Exception:
            results["topTendencyQuery"] = []

        try:
            results["thinkingSkillsQuery"] = self._query_thinking_skills(anp_seq)
        except Exception:
            results["thinkingSkillsQuery"] = []

        try:
            results["careerRecommendationQuery"] = self._query_career_recommendation(anp_seq)
        except Exception:
            results["careerRecommendationQuery"] = []

        # 나머지 키들은 파이프라인 호환성 유지를 위해 빈 리스트로 채움
        for key in [
            "personalityDetailQuery","strengthsWeaknessesQuery","jobMatchingQuery","majorRecommendationQuery",
            "studyMethodQuery","socialSkillsQuery","leadershipQuery","communicationQuery","problemSolvingQuery",
            "creativityQuery","analyticalThinkingQuery","practicalThinkingQuery","abstractThinkingQuery","memoryQuery",
            "attentionQuery","processingSpeedQuery","spatialAbilityQuery","verbalAbilityQuery","numericalAbilityQuery",
            "reasoningQuery","perceptionQuery","motivationQuery","interestQuery","valueQuery","workStyleQuery",
            "environmentPreferenceQuery","teamworkQuery","independenceQuery","stabilityQuery","challengeQuery"
        ]:
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
        # 최대 실행 시간(초). 초과 시 타임아웃 처리하여 재시도/실패로 전환
        self.query_timeout = query_timeout
        
    def _setup_validators(self) -> Dict[str, callable]:
        """Setup validation functions for different query types"""
        return {
            "tendencyQuery": self._validate_tendency_query,
            "topTendencyQuery": self._validate_top_tendency_query,
            "thinkingSkillsQuery": self._validate_thinking_skills_query,
            "careerRecommendationQuery": self._validate_career_recommendation_query,
            # Add more validators as needed
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
        """Validate top tendency query results.
        빈 결과는 허용(경고로 처리)하고, 데이터가 있을 때 필수 필드를 검사한다.
        """
        if data is None:
            return False
        if len(data) == 0:
            return True
            
        required_fields = ["rank", "tendency_name", "code", "score"]
        
        for row in data:
            for field in required_fields:
                if field not in row:
                    logger.warning(f"Missing required field '{field}' in top tendency query")
                    return False
                    
            # Validate data types
            if not isinstance(row.get("rank"), int) or not isinstance(row.get("score"), (int, float)):
                logger.warning("Invalid data types in top tendency query")
                return False
                
        return True
    
    def _validate_thinking_skills_query(self, data: List[Dict[str, Any]]) -> bool:
        """Validate thinking skills query results.
        빈 결과는 허용(경고로 처리)하고, 데이터가 있을 때 필수 필드를 검사한다.
        """
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
                    
            # Validate score ranges
            score = row.get("score")
            percentile = row.get("percentile")
            
            if not isinstance(score, (int, float)) or score < 0 or score > 100:
                logger.warning(f"Invalid score value: {score}")
                return False
                
            if not isinstance(percentile, (int, float)) or percentile < 0 or percentile > 100:
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
                    
            # Validate match score
            match_score = row.get("match_score")
            if not isinstance(match_score, (int, float)) or match_score < 0 or match_score > 100:
                logger.warning(f"Invalid match_score value: {match_score}")
                return False
                
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
                # Remove None values and empty strings
                if value is not None and value != "":
                    # Strip whitespace from string values
                    if isinstance(value, str):
                        cleaned_row[key] = value.strip()
                    else:
                        cleaned_row[key] = value
                        
            if cleaned_row:  # Only add non-empty rows
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
             # ▼▼▼ [수정] 이 로그를 추가하여 쿼리 실행 시도를 기록합니다. ▼▼▼
            logger.info(f"Query '{query_name}' attempting to execute (attempt {attempt + 1})")
            try:
                # Execute query in thread pool to avoid blocking
                loop = asyncio.get_event_loop()

                def execute_query():
                    aptitude_queries = AptitudeTestQueries(session)
                    all_results = aptitude_queries.execute_all_queries(anp_seq)
                    return all_results.get(query_name, [])

                # 타임아웃(기본 120초) 설정으로 무한 대기 방지
                try:
                    data = await asyncio.wait_for(
                        loop.run_in_executor(self.executor, execute_query),
                        timeout=self.query_timeout,
                    )
                except asyncio.TimeoutError:
                    execution_time = (datetime.now() - start_time).total_seconds()
                    logger.error(
                        f"Query '{query_name}' timed out after {self.query_timeout}s"
                    )
                    if attempt < self.max_retries:
                        wait_time = self.retry_delay * (2 ** attempt)
                        logger.warning(
                            f"Retrying '{query_name}' in {wait_time}s due to timeout (attempt {attempt + 1}/{self.max_retries + 1})"
                        )
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        return QueryResult(
                            query_name=query_name,
                            success=False,
                            error=f"timeout after {self.query_timeout}s",
                            execution_time=execution_time,
                            row_count=None,
                        )
                execution_time = (datetime.now() - start_time).total_seconds()
                
                # Clean the data
                cleaned_data = self._clean_query_data(query_name, data)
                
                # Validate the result
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
                    logger.warning(
                        f"Query '{query_name}' failed on attempt {attempt + 1}/{self.max_retries + 1}: {e}. "
                        f"Retrying in {self.retry_delay}s..."
                    )
                    await asyncio.sleep(self.retry_delay * (2 ** attempt))  # Exponential backoff
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
        
        # This should never be reached, but just in case
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
        Execute all 37 queries asynchronously with error handling and retry logic
        
        Args:
            session: Database session
            anp_seq: Test sequence number
            
        Returns:
            Dictionary mapping query names to QueryResult objects
        """
        
        # Define all 37 query names (based on the existing system)
        query_names = [
            "tendencyQuery",
            "topTendencyQuery", 
            "thinkingSkillsQuery",
            "careerRecommendationQuery",
            "personalityDetailQuery",
            "competencyAnalysisQuery",
            "learningStyleQuery",
            "preferenceAnalysisQuery",
            "strengthsWeaknessesQuery",
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
        
        # Execute all queries concurrently
        tasks = [
            self._execute_single_query_with_retry(session, anp_seq, query_name)
            for query_name in query_names
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
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
        
        Args:
            query_results: Results from execute_all_queries_async
            
        Returns:
            Dictionary mapping query names to their data (only successful queries)
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