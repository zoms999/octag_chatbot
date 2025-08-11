종합 진단 리포트 SQL 쿼리 분석 및 분류 (총 37개)

제공해주신 37개의 SQL 쿼리를 기능과 목적에 따라 8개의 그룹으로 분류하고, 각 쿼리의 역할과 실제 코드를 함께 정리했습니다.

1. 기본 정보 및 설정 쿼리 (Queries 1-3)

리포트 생성을 위한 가장 기본적인 정보를 가져오는 단계입니다.

1. anp_seq 존재 여부 확인

설명: mwd_answer_progress 테이블에서 주어진 검사 번호(anp_seq)가 유효한지 확인합니다. 모든 후속 쿼리 실행 전 데이터의 유효성을 검증하는 첫 관문입니다.

주요 역할: 데이터 유효성 검사

code
SQL
download
content_copy
expand_less

SELECT anp_seq FROM mwd_answer_progress WHERE anp_seq = 18240
2. instituteSettingsQuery (기관 설정 조회)

설명: 사용자가 개인 회원인지, 특정 기관(학교, 회사 등) 소속인지 판별합니다. 기관 소속일 경우, 해당 기관이 설정한 리포트 결과(성향, 역량)의 표시 유형(요약형/상세형)을 가져옵니다.

주요 역할: 리포트 타입 결정 (개인/기관), 기관별 맞춤 설정 로드

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  COALESCE(ins.ins_tendency_view_type, 'summary') as ins_tendency_view_type,
  COALESCE(ins.ins_competency_view_type, 'summary') as ins_competency_view_type,
  CASE WHEN ins.ins_seq IS NOT NULL THEN 'institutional' ELSE 'individual' END as member_type
FROM mwd_answer_progress ap
JOIN mwd_account ac ON ac.ac_gid = ap.ac_gid
LEFT JOIN mwd_institute ins ON ins.ins_seq = ac.ins_seq
WHERE ap.anp_seq = 18240
3. personalInfoQuery (개인 정보 조회)

설명: 여러 테이블을 조인하여 검사자의 상세 개인 정보를 조회합니다. 이름, 생년월일, 나이, 성별, 연락처, 최종 학력, 직업, 소속 등 리포트 상단에 표시될 기본 인적 사항을 구성합니다.

주요 역할: 리포트 대상자 정보 구성

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
select ac.ac_id as id, pe.pe_name as pname,
pe.pe_birth_year||'-'||pe.pe_birth_month||'-'||pe.pe_birth_day as birth,
case when pe.pe_sex = 'M' then '남' else '여' end sex,
pe.pe_cellphone as cellphone,
pe.pe_contact as contact,
pe.pe_email as email,
coalesce(ec.ename,'') as education,
pe.pe_school_name as school,
pe.pe_school_year as syear,
pe.pe_school_major as smajor,
coalesce(jc.jname,'') as job,
cast(extract(year from age(cast(lpad(cast(pe_birth_year as text),4,'0')||lpad(cast(pe_birth_month as text),2,'0')||lpad(cast(pe_birth_day as text),2,'0') as date))) as int) as age,
pe.pe_job_name,
pe.pe_job_detail,
ins.ins_name
from mwd_answer_progress ap
join mwd_account ac on ap.ac_gid = ac.ac_gid
join mwd_person pe on ac.pe_seq = pe.pe_seq
left join mwd_institute ins on ac.ins_seq = ins.ins_seq
left outer join (select coc_code ecode, coc_code_name ename from mwd_common_code where coc_group = 'UREDU') ec on pe.pe_ur_education = ec.ecode
left outer join (select coc_code jcode, coc_code_name jname from mwd_common_code where coc_group = 'URJOB') jc on pe.pe_ur_job = jc.jcode
where ap.anp_seq = 18240
2. 성향 분석 쿼리 (Queries 4-12, 34)

사용자의 성격적 특성과 강점 및 약점을 분석하는 데 필요한 데이터를 추출합니다.

4. tendencyQuery (대표 성향 조회)

설명: 검사 결과 가장 두드러진 대표 성향 1순위(Tnd1)와 2순위(Tnd2)의 이름을 조회합니다. 리포트의 핵심 주제를 결정합니다.

주요 역할: 핵심 성향 키워드 추출

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
select max(case when rk = 1 then tnd end) as Tnd1, max(case when rk = 2 then tnd end) as Tnd2
from (
  select replace(qa.qua_name,'형','') as tnd, 1 as rk
  from mwd_resval rv, mwd_question_attr qa
  where rv.anp_seq = 18240 and qa.qua_code = rv.rv_tnd1
  union
  select replace(qa.qua_name,'형','') as tnd, 2 as rk
  from mwd_resval rv, mwd_question_attr qa
  where rv.anp_seq = 18240 and qa.qua_code = rv.rv_tnd2
) t
5. tendency1ExplainQuery (1순위 성향 설명)

설명: 1순위 대표 성향에 대한 표준 해석 문구를 가져옵니다. que_explain 컬럼의 'OOO'와 같은 플레이스홀더를 실제 사용자 이름으로 대체하여 개인화된 설명을 만듭니다.

주요 역할: 개인화된 성향 설명 제공

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
select replace(qe.que_explain, 'OOO', '18240님')
from mwd_resval rv, mwd_question_explain qe
where rv.anp_seq = 18240 and qe.qua_code = rv.rv_tnd1
6. tendency2ExplainQuery (2순위 성향 설명)

설명: 2순위 대표 성향에 대한 표준 해석 문구를 가져옵니다. 5번 쿼리와 동일한 역할을 합니다.

주요 역할: 개인화된 성향 설명 제공

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
select replace(qe.que_explain, 'OOO', '18240님')
from mwd_resval rv, mwd_question_explain qe
where rv.anp_seq = 18240 and qe.qua_code = rv.rv_tnd2
7. topTendencyQuery (상위 강점 성향 조회)

설명: 점수 기준 상위 3개의 성향 이름, 순위, 코드를 조회하여 사용자의 강점을 명확히 보여줍니다.

주요 역할: 강점 성향 제시

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
select qa.qua_name as tendency_name, sc1.sc1_rank as rank, sc1.qua_code as code
from mwd_score1 sc1, mwd_question_attr qa
where sc1.anp_seq = 18240 and sc1.sc1_step='tnd' and sc1.sc1_rank <= 3
and qa.qua_code = sc1.qua_code
order by sc1.sc1_rank
8. bottomTendencyQuery (하위 보완 성향 조회)

설명: 전체 성향 중 가장 순위가 낮은 3개의 성향을 조회하여 보완이 필요한 부분을 알려줍니다.

주요 역할: 약점/보완점 성향 제시

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
select qa.qua_name as tendency_name, sc1.sc1_rank as rank, sc1.qua_code as code
from mwd_score1 sc1, mwd_question_attr qa
where sc1.anp_seq = 18240 and sc1.sc1_step='tnd'
and sc1.sc1_rank > (select count(*) from mwd_score1 where anp_seq = 18240 and sc1_step='tnd') - 3
and qa.qua_code = sc1.qua_code
order by sc1.sc1_rank desc
9. tendencyQuestionExplainQuery (성향 관련 응답 조회)

설명: 상위 3개 성향이 왜 그렇게 도출되었는지 근거를 제시하기 위해, 사용자가 높게 응답한(가중치 4 이상) 관련 문항의 설명을 가져옵니다.

주요 역할: 분석 결과의 신뢰도 및 근거 제공

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
select qu.qu_explain, sc1.sc1_rank as rank
from mwd_answer an, mwd_question qu,
(select qua_code, sc1_rank from mwd_score1 sc1
 where anp_seq = 18240 and sc1_step='tnd' and sc1_rank <= 3) sc1
where an.anp_seq = 18240
and qu.qu_code = an.qu_code and qu.qu_use = 'Y'
and qu.qu_qusyn = 'Y' and qu.qu_kind1 = 'tnd'
and an.an_wei >= 4 and qu.qu_kind2 = sc1.qua_code
order by sc1.sc1_rank, an.an_wei desc
10. detailedPersonalityAnalysisQuery (상세 성격 분석)

설명: 9번 쿼리와 매우 유사하며, 상위 3개 성향에 대해 사용자가 높게 응답한 문항을 근거로 상세한 성격 분석 데이터를 제공합니다.

주요 역할: 분석 결과의 신뢰도 및 근거 제공

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
select qu.qu_explain, sc1.sc1_rank as rank, an.an_wei, sc1.qua_code
from mwd_answer an, mwd_question qu,
(select qua_code, sc1_rank from mwd_score1 sc1
 where anp_seq = 18240 and sc1_step='tnd' and sc1_rank <= 3) sc1
where an.anp_seq = 18240
and qu.qu_code = an.qu_code and qu.qu_use = 'Y'
and qu.qu_qusyn = 'Y' and qu.qu_kind1 = 'tnd'
and an.an_wei >= 4 and qu.qu_kind2 = sc1.qua_code
order by sc1.sc1_rank, an.an_wei desc
11. topTendencyExplainQuery (상위 성향 종합 설명)

설명: 상위 15개 성향의 순위, 이름, 그리고 각 성향에 대한 설명을 조회하여 사용자의 성격 프로필에 대한 폭넓은 이해를 돕습니다.

주요 역할: 성향 프로필의 심층 분석 정보 제공

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  sc1.sc1_rank as rank,
  qa.qua_name as tendency_name,
  qe.que_explain as explanation
FROM
  mwd_score1 sc1
  JOIN mwd_question_attr qa ON qa.qua_code = sc1.qua_code
  JOIN mwd_question_explain qe ON qe.qua_code = sc1.qua_code AND qe.que_switch = 1
WHERE
  sc1.anp_seq = 18240
  AND sc1.sc1_step = 'tnd'
  AND sc1.sc1_rank <= 15
ORDER BY
  sc1.sc1_rank
12. bottomTendencyExplainQuery (하위 성향 종합 설명)

설명: 8번 쿼리와 유사하게, 가장 순위가 낮은 성향들의 이름과 설명을 조회하여 보완점에 대한 상세 정보를 제공합니다.

주요 역할: 성향 프로필의 심층 분석 정보 제공

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  sc1.sc1_rank as rank,
  qa.qua_name as tendency_name,
  qe.que_explain as explanation
FROM
  mwd_score1 sc1
  JOIN mwd_question_attr qa ON qa.qua_code = sc1.qua_code
  JOIN mwd_question_explain qe ON qe.qua_code = sc1.qua_code AND qe.que_switch = 1
WHERE
  sc1.anp_seq = 18240
  AND sc1.sc1_step = 'tnd'
  AND sc1.sc1_rank > (select count(*) from mwd_score1 where anp_seq = 18240 and sc1_step='tnd') - 3
ORDER BY
  sc1.sc1_rank DESC```

#### **34. tendencyStatsQuery (성향 통계 분석)**
*   **설명:** 사용자의 상위 3개 성향에 대해, 각 성향이 전체 응시자 중에서 1순위로 나타난 비율이 몇 %인지 통계 정보를 계산하여 제공합니다.
*   **주요 역할:** 성향의 상대적 유니크함 제시

```sql
WITH
  TendencyCounts AS (
    SELECT
      qua_code,
      COUNT(*) AS tendency_count
    FROM
      mwd_score1
    WHERE
      sc1_step = 'tnd' AND sc1_rank = 1
    GROUP BY
      qua_code
  ),
  TotalCount AS (
    SELECT
      COUNT(*) AS total_count
    FROM
      mwd_score1
    WHERE
      sc1_step = 'tnd' AND sc1_rank = 1
  )
SELECT
  qa.qua_name AS tendency_name,
  sc1.sc1_rank AS rank,
  sc1.qua_code AS code,
  CASE
    WHEN tt.total_count > 0 THEN
      ROUND(
        (COALESCE(tc.tendency_count, 0) * 100.0) / tt.total_count,
        2
      )
    ELSE 0
  END AS percentage_in_total
FROM
  mwd_score1 sc1
JOIN
  mwd_question_attr qa ON sc1.qua_code = qa.qua_code
LEFT JOIN
  TendencyCounts tc ON sc1.qua_code = tc.qua_code
CROSS JOIN
  TotalCount tt
WHERE
  sc1.anp_seq = 18240
  AND sc1.sc1_step = 'tnd'
  AND sc1.sc1_rank <= 3
ORDER BY
  sc1.sc1_rank
3. 사고력 분석 쿼리 (Queries 13-15, 35)

사용자의 인지적 능력을 8가지 영역으로 나누어 분석합니다.

13. thinkingMainQuery (대표 사고력 조회)

설명: 사용자의 대표적인 주 사고력(rv_thk1)과 보조 사고력(rv_thk2), 그리고 종합 사고력 점수(rv_thktscore)를 조회합니다.

주요 역할: 사고력 핵심 유형 및 종합 점수 제시

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  (SELECT qa.qua_name FROM mwd_question_attr qa WHERE qa.qua_code = rv_thk1) AS thkm,
  (SELECT qa.qua_name FROM mwd_question_attr qa WHERE qa.qua_code = rv_thk2) AS thks,
  rv_thktscore AS tscore
FROM mwd_resval
WHERE anp_seq = 18240
14. thinkingScoreQuery (8대 사고력 점수 조회)

설명: 사실적, 추론적, 분석적 사고력 등 8가지 세부 사고력 영역 각각의 점수(백분율)를 계산하여 가져옵니다. 세로로 긴 데이터(long-format)를 가로로 넓은 데이터(wide-format)로 변환(pivot)하는 역할을 합니다.

주요 역할: 사고력 영역별 점수 시각화 데이터 생성

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  sum(CASE WHEN qua_code = 'thk10000' THEN round(sc1_rate * 100) END) AS thk1,
  sum(CASE WHEN qua_code = 'thk20000' THEN round(sc1_rate * 100) END) AS thk2,
  sum(CASE WHEN qua_code = 'thk30000' THEN round(sc1_rate * 100) END) AS thk3,
  sum(CASE WHEN qua_code = 'thk40000' THEN round(sc1_rate * 100) END) AS thk4,
  sum(CASE WHEN qua_code = 'thk50000' THEN round(sc1_rate * 100) END) AS thk5,
  sum(CASE WHEN qua_code = 'thk60000' THEN round(sc1_rate * 100) END) AS thk6,
  sum(CASE WHEN qua_code = 'thk70000' THEN round(sc1_rate * 100) END) AS thk7,
  sum(CASE WHEN qua_code = 'thk80000' THEN round(sc1_rate * 100) END) AS thk8
FROM mwd_score1
WHERE anp_seq = 18240
AND sc1_step = 'thk'
15. thinkingDetailQuery (사고력 상세 분석)

설명: 8대 사고력 각각의 이름, 점수, 그리고 점수 수준(상/중/하)에 따라 각기 다른 해석 문구를 조회합니다.

주요 역할: 사고력 영역별 맞춤형 설명 제공

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  qa.qua_name,
  ROUND(sc1.sc1_rate * 100) AS score,
  REPLACE(qe.que_explain, 'OOO', pe.pe_name || '님') AS explain
FROM
  mwd_score1 sc1
  JOIN mwd_question_attr qa ON qa.qua_code = sc1.qua_code
  JOIN mwd_question_explain qe ON qe.qua_code = qa.qua_code
  JOIN mwd_answer_progress ap ON ap.anp_seq = sc1.anp_seq
  JOIN mwd_account ac ON ac.ac_gid = ap.ac_gid
  JOIN mwd_person pe ON pe.pe_seq = ac.pe_seq
WHERE
  sc1.anp_seq = 18240
  AND sc1.sc1_step = 'thk'
  AND qe.que_switch = CASE
    WHEN sc1.sc1_rate * 100 BETWEEN 80 AND 100 THEN 1
    WHEN sc1.sc1_rate * 100 BETWEEN 51 AND 79 THEN 2
    ELSE 3
  END
ORDER BY
  sc1.sc1_rank
35. thinkingSkillComparisonQuery (사고력 비교 분석)

설명: 8대 사고력 각각에 대해 '나의 점수'와 '전체 평균 점수'를 함께 조회하여, 자신의 사고력 수준을 객관적으로 비교할 수 있게 합니다.

주요 역할: 전체 평균 대비 상대적 사고 능력 비교

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  qa.qua_name AS thinking_skill_name,
  a.qua_code,
  ROUND(MAX(CASE WHEN a.anp_seq = 18240 THEN a.sc1_rate * 100 END)) AS my_score,
  ROUND(AVG(a.sc1_rate * 100), 1) AS average_score
FROM
  mwd_score1 a
JOIN
  mwd_question_attr qa ON a.qua_code = qa.qua_code
WHERE
  a.sc1_step = 'thk'
GROUP BY
  qa.qua_name, a.qua_code
ORDER BY
  a.qua_code
4. 역량 분석 쿼리 (Queries 21-22)

사용자의 직무 관련 핵심 역량을 분석합니다.

21. talentListQuery (핵심 역량 목록 조회)

설명: 사용자의 상위 5개 핵심 역량(재능)의 이름을 쉼표로 구분된 하나의 문자열로 가져옵니다.

주요 역할: 핵심 역량 요약 제시

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  string_agg(qa.qua_name, ', ' ORDER BY sc1.sc1_rank) AS tal
FROM
  mwd_question_attr qa
  JOIN mwd_score1 sc1 ON sc1.qua_code = qa.qua_code
WHERE
  sc1.anp_seq = 18240
  AND sc1.sc1_step = 'tal'
  AND sc1.sc1_rank <= 5```

#### **22. talentDetailsQuery (핵심 역량 상세 분석)**
*   **설명:** 상위 5개 핵심 역량의 이름, 점수, 순위, 상세 설명과 함께, 해당 역량이 전체 응시자 중 상위 몇 %에 해당하는지(백분위 순위)를 계산하여 보여주는 복합적인 쿼리입니다.
*   **주요 역할:** 역량의 상세 수준 및 상대적 위치 분석

```sql
SELECT
    t.qua_name,
    t.tscore,
    t.rank,
    t.explain,
    pr.percentile_rank
FROM
    (
        SELECT
            qa.qua_name,
            ROUND(sc1.sc1_rate * 100) AS tscore,
            sc1.sc1_rank AS rank,
            REPLACE(qe.que_explain, 'OOO', pe.pe_name || '님') AS explain,
            sc1.qua_code,
            sc1.anp_seq
        FROM
            mwd_score1 sc1
        JOIN
            mwd_question_attr qa ON qa.qua_code = sc1.qua_code
        JOIN
            mwd_question_explain qe ON qe.qua_code = qa.qua_code
        JOIN
            mwd_answer_progress ap ON ap.anp_seq = sc1.anp_seq
        JOIN
            mwd_account ac ON ac.ac_gid = ap.ac_gid
        JOIN
            mwd_person pe ON pe.pe_seq = ac.pe_seq
        WHERE
            sc1.anp_seq = 18240
            AND sc1.sc1_step = 'tal'
            AND sc1.sc1_rank <= 5
    ) AS t
JOIN LATERAL (
    SELECT
        s.anp_seq,
        ROUND(
            ((1 - PERCENT_RANK() OVER (ORDER BY s.sc1_rate)) * 100)::numeric, 2
        ) AS percentile_rank
    FROM
        mwd_score1 s
    WHERE
        s.qua_code = t.qua_code
        AND s.sc1_step = 'tal'
) AS pr ON t.anp_seq = pr.anp_seq
ORDER BY
    t.rank;
5. 선호도 분석 쿼리 (Queries 19-20, 23)

이미지 기반 검사를 통해 사용자의 시각적, 직관적 선호도를 분석합니다.

19. imagePreferenceQuery (이미지 선호도 검사 통계)

설명: 이미지 선호도 검사의 수행 통계(총 이미지 수, 응답 수, 응답률)를 조회합니다.

주요 역할: 검사 응답 충실도 확인

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  rv.rv_imgtcnt AS tcnt,
  rv.rv_imgrcnt AS cnt,
  rv.rv_imgresrate * 100 AS irate
FROM mwd_resval rv
WHERE rv.anp_seq = 18240
20. pdKindQuery (검사 상품 종류 확인)

설명: 사용자가 응시한 검사의 구체적인 상품 종류(pd_kind)를 확인합니다. 리포트의 종류를 분기 처리하는 데 사용될 수 있습니다.

주요 역할: 리포트 종류 분기 처리

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT cr.pd_kind
FROM mwd_answer_progress anp
JOIN mwd_choice_result cr ON anp.cr_seq = cr.cr_seq
WHERE anp.anp_seq = 18240
23. preferenceDataQuery (선호도 데이터 조회)

설명: 이미지 선호도 검사 결과, 가장 선호도가 높게 나타난 3가지 유형의 이름, 관련 문항 수, 응답률, 상세 설명을 조회합니다.

주요 역할: 시각적 선호도 분석 결과 제시

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  max(CASE WHEN rk2 = 1 THEN qua_name END) AS tdname1,
  max(CASE WHEN rk2 = 1 THEN sc1_qcnt END) AS qcnt1,
  max(CASE WHEN rk2 = 1 THEN rrate END) AS rrate1,
  max(CASE WHEN rk2 = 2 THEN qua_name END) AS tdname2,
  max(CASE WHEN rk2 = 2 THEN sc1_qcnt END) AS qcnt2,
  max(CASE WHEN rk2 = 2 THEN rrate END) AS rrate2,
  max(CASE WHEN rk2 = 3 THEN qua_name END) AS tdname3,
  max(CASE WHEN rk2 = 3 THEN sc1_qcnt END) AS qcnt3,
  max(CASE WHEN rk2 = 3 THEN rrate END) AS rrate3,
  max(CASE WHEN rk2 = 1 THEN que_explain END) AS exp1,
  max(CASE WHEN rk2 = 2 THEN que_explain END) AS exp2,
  max(CASE WHEN rk2 = 3 THEN que_explain END) AS exp3
FROM (
  SELECT
    qa.qua_name,
    sc1.sc1_qcnt,
    round(sc1.sc1_resrate * 100) AS rrate,
    row_number() OVER(PARTITION BY sc1.sc1_rank) AS rk,
    sc1.sc1_rank AS rk2,
    qe.que_explain
  FROM
    mwd_score1 sc1,
    mwd_question_attr qa,
    mwd_question_explain qe
  WHERE
    sc1.anp_seq = 18240
    AND sc1.sc1_step = 'img'
    AND qa.qua_code = sc1.qua_code
    AND sc1.sc1_rank <= 3
    AND qe.qua_code = qa.qua_code
    AND qe.que_switch = 1
  ORDER BY
    sc1.sc1_rank
) t
WHERE rk = 1
6. 진로 및 직업 추천 쿼리 (Queries 16-18, 24-29)

성향, 역량, 선호도 등 다양한 분석 결과를 종합하여 맞춤형 직업과 직무를 추천합니다.

16. suitableJobsSummaryQuery (적합 직업 요약)

설명: 사용자의 대표 성향과 관련된 7개의 추천 직업을 쉼표로 연결된 하나의 문자열로 요약하여 보여줍니다.

주요 역할: 성향 기반 진로 추천 (요약)

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  replace((
    SELECT qua_name
    FROM mwd_question_attr, mwd_resval
    WHERE anp_seq = 18240 AND qua_code = rv_tnd1
  ) || (
    SELECT qua_name
    FROM mwd_question_attr, mwd_resval
    WHERE anp_seq = 18240 AND qua_code = rv_tnd2
  ), '형', '') || '님' AS tendency,
  string_agg(jo.jo_name, ', ') AS tndjob
FROM (
  SELECT rej_code
  FROM mwd_resjob
  WHERE anp_seq = 18240
  AND rej_kind = 'rtnd'
  AND rej_rank <= 7
) j,
mwd_job jo
WHERE jo.jo_code = j.rej_code
17. suitableJobsDetailQuery (적합 직업 상세)

설명: 성향 분석을 기반으로 추천되는 상위 7개 직업의 이름, 개요, 주요 업무 등 상세 정보를 조회합니다.

주요 역할: 성향 기반 진로 추천 (상세)

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  jo.jo_name,
  jo.jo_outline,
  jo.jo_mainbusiness
FROM mwd_resjob rj, mwd_job jo
WHERE rj.anp_seq = 18240
AND rj.rej_kind = 'rtnd'
AND jo.jo_code = rj.rej_code
AND rej_rank <= 7
ORDER BY rj.rej_rank
18. suitableJobMajorsQuery (적합 직업 관련 전공)

설명: 성향 기반으로 추천된 상위 7개 직업과 관련된 대학/학과 정보를 조회합니다.

주요 역할: 성향 기반 진로 추천 (전공 연계)

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  jo.jo_name,
  string_agg(ma.ma_name, ', ' ORDER BY ma.ma_name) AS major
FROM mwd_resjob rj, mwd_job jo, mwd_job_major_map jmm, mwd_major ma
WHERE rj.anp_seq = 18240
AND rj.rej_kind = 'rtnd'
AND jo.jo_code = rj.rej_code
AND rej_rank <= 7
AND jmm.jo_code = rj.rej_code
AND ma.ma_code = jmm.ma_code
GROUP BY jo.jo_code, rj.rej_rank
ORDER BY rj.rej_rank
24-26. preferenceJobs1/2/3Query (선호도 기반 직업 추천)

설명: 선호도 분석 결과(1, 2, 3순위)를 기반으로 추천되는 직업 및 관련 전공 정보를 각각 조회합니다. (아래는 1순위 쿼리 예시)

주요 역할: 선호도 기반 진로 추천

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
-- preferenceJobs1Query 예시
SELECT
  qa.qua_name,
  jo.jo_name,
  jo.jo_outline,
  jo.jo_mainbusiness,
  string_agg(ma.ma_name, ', ' ORDER BY ma.ma_name) AS majors
FROM
  mwd_job jo,
  mwd_job_major_map jmm,
  mwd_major ma,
  mwd_resjob rj
LEFT OUTER JOIN
  mwd_question_attr qa ON qa.qua_code = rj.rej_quacode
WHERE
  rj.anp_seq = 18240
  AND rj.rej_kind = 'rimg1' -- rimg2, rimg3로 변경하여 2,3순위 조회
  AND rj.rej_rank <= 5
  AND jo.jo_code = rj.rej_code
  AND jmm.jo_code = jo.jo_code
  AND ma.ma_code = jmm.ma_code
GROUP BY
  rj.rej_kind,
  qa.qua_code,
  jo.jo_code,
  rj.rej_rank
ORDER BY
  rj.rej_rank
27. competencyJobsQuery (역량 기반 직업 추천)

설명: 역량 분석 결과를 기반으로 추천되는 상위 7개 직업의 상세 정보를 조회합니다.

주요 역할: 역량 기반 진로 추천

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  jo.jo_name,
  jo.jo_outline,
  jo.jo_mainbusiness
FROM
  mwd_resjob rj
  JOIN mwd_job jo ON jo.jo_code = rj.rej_code
WHERE
  rj.anp_seq = 18240
  AND rj.rej_kind = 'rtal'
  AND rj.rej_rank <= 7
ORDER BY
  rj.rej_rank
28. competencyJobMajorsQuery (역량 기반 직업 관련 전공)

설명: 역량 기반으로 추천된 직업들과 관련된 학과/전공 정보를 조회합니다.

주요 역할: 역량 기반 진로 추천 (전공 연계)

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  jo.jo_name,
  string_agg(ma.ma_name, ', ' ORDER BY ma.ma_name) AS major
FROM
  mwd_resjob rj
  JOIN mwd_job jo ON jo.jo_code = rj.rej_code
  JOIN mwd_job_major_map jmm ON jmm.jo_code = rj.rej_code
  JOIN mwd_major ma ON ma.ma_code = jmm.ma_code
WHERE
  rj.anp_seq = 18240
  AND rj.rej_kind = 'rtal'
  AND rj.rej_rank <= 7
GROUP BY
  jo.jo_code,
  rj.rej_rank
ORDER BY
  rj.rej_rank
29. dutiesQuery (추천 직무 조회)

설명: 사용자의 성향을 기반으로 적합한 세부 직무(Duty)를 5개까지 추천하고, 직무 내용, 관련 전공, 적합도를 계산하여 보여줍니다.

주요 역할: 직업보다 세분화된 직무 추천

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  du.du_name,
  du.du_outline as du_content,
  du.du_department as majors,
  'IT 계열' as jf_name,
  (100 - (rd.red_rank * 10)) as match_rate
FROM
  mwd_resduty rd,
  mwd_duty du
WHERE
  rd.anp_seq = 18240
  AND rd.red_kind = 'rtnd'
  AND du.du_code = rd.red_code
  AND rd.red_rank <= 5
ORDER BY
  rd.red_rank
7. 학습 스타일 및 교과목 추천 쿼리 (Queries 30-33, 36)

효율적인 학습을 위한 스타일과 전략, 그리고 적합한 교과목을 추천합니다.

30. learningStyleQuery (학습 스타일 분석)

설명: 대표 성향 2가지에 따른 학습 스타일(공부 성향, 공부 방법)과, 시각화(차트)에 사용될 좌표 값을 조회합니다.

주요 역할: 맞춤 학습 전략 제시

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
    -- rv_tnd1 유형 이름
    (SELECT REPLACE(qa.qua_name, '형', '')
    FROM mwd_question_attr qa
    WHERE qa.qua_code = rv.rv_tnd1) AS tnd1,

    -- rv_tnd1 관련 설명 (사용자 이름 추가)
    REPLACE(ts1.tes_study_tendency, 'OOO', pe.pe_name || '님') AS tnd1_study,
    REPLACE(ts1.tes_study_way, 'OOO', pe.pe_name || '님') AS tnd1_way,

    -- rv_tnd2 유형 이름
    (SELECT REPLACE(qa.qua_name, '형', '')
    FROM mwd_question_attr qa
    WHERE qa.qua_code = rv.rv_tnd2) AS tnd2,

    -- rv_tnd2 관련 설명 (사용자 이름 추가)
    REPLACE(ts2.tes_study_tendency, 'OOO', pe.pe_name || '님') AS tnd2_study,
    REPLACE(ts2.tes_study_way, 'OOO', pe.pe_name || '님') AS tnd2_way,

    -- 유형별 row, col 좌표 값
    CAST(SUBSTRING(rv.rv_tnd1, 4, 2) AS INT) - 10 AS tndrow,
    CAST(SUBSTRING(rv.rv_tnd2, 4, 2) AS INT) - 10 AS tndcol

FROM mwd_resval rv
JOIN mwd_tendency_study ts1 ON ts1.qua_code = rv.rv_tnd1
JOIN mwd_tendency_study ts2 ON ts2.qua_code = rv.rv_tnd2
-- 사용자 이름(pe_name)을 가져오기 위한 JOIN 추가
JOIN mwd_answer_progress ap ON ap.anp_seq = rv.anp_seq
JOIN mwd_account ac ON ac.ac_gid = ap.ac_gid
JOIN mwd_person pe ON pe.pe_seq = ac.pe_seq
WHERE rv.anp_seq = 18240
31. style1/style2/method1/method2ChartQuery (학습 차트 데이터)

설명: 대표 성향에 따른 학습 스타일과 학습 방법을 시각화(차트)하는 데 필요한 데이터(항목명, 비율, 색상 코드)를 조회합니다. 총 4개의 유사한 쿼리로 구성됩니다. (아래는 style1 쿼리 예시)

주요 역할: 리포트 시각화 데이터 생성

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
-- style1ChartQuery
SELECT
    sr.sw_kindname AS sname,
    CAST(sr.sw_rate * 100 AS INT) AS srate,
    CASE
      WHEN sr.sw_color LIKE '#%' THEN sr.sw_color
      ELSE REPLACE(REPLACE(sr.sw_color, 'rgb(', 'rgba('), ')', ', 0.8)')
    END AS scolor
FROM mwd_resval rv
JOIN mwd_studyway_rate sr ON sr.qua_code = rv.rv_tnd1 -- rv_tnd2로 변경하여 style2 조회
WHERE rv.anp_seq = 18240
AND sr.sw_type = 'S' -- 'W'로 변경하여 method 조회
ORDER BY sr.sw_kind
32. subjectRanksQuery (과목 순위 조회)

설명: 사용자의 주된 성향에 따라 추천되는 교과목들을 순위별로 조회합니다. CASE 문을 사용하여 각 성향 코드에 맞는 과목 순위를 매핑합니다.

주요 역할: 성향 기반 교과목 추천 (순위)

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  subject                       AS srank,
  tsm_subject_group             AS sgroup,
  tsm_subject_choice            AS schoice,
  tsm_subject                   AS subject,
  tsm_subject_explain           AS sexplain
FROM (
  SELECT
    CASE rv.rv_tnd1
      WHEN 'tnd11000' THEN sm.tsm_communication_type
      WHEN 'tnd12000' THEN sm.tsm_creation_type
      -- ... (기타 모든 WHEN절)
      WHEN 'tnd25000' THEN sm.tsm_adventurous_type
    END                      AS subject,
    sm.tsm_subject_group,
    sm.tsm_subject_choice,
    sm.tsm_subject,
    sm.tsm_subject_explain,
    sm.tsm_subject_code,
    sm.tsm_subject_group_code,
    sm.tsm_subject_choice_code
  FROM
    mwd_resval rv
    JOIN mwd_tendency_subject_map sm ON sm.tsm_use = 'Y'
  WHERE
    anp_seq = 18240
) t
ORDER BY
  tsm_subject_group_code,
  tsm_subject_choice_code,
  CAST(subject AS INT),
  tsm_subject_code
33. tendencySubjectsQuery (성향별 추천 과목 조회)

설명: 32번과 유사하게, 사용자의 주 성향의 이름과 함께 해당 성향에 추천되는 교과목들을 상세히 보여줍니다.

주요 역할: 성향 기반 교과목 추천 (상세)

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
SELECT
  subject                       AS srank,
  tsm_subject_group             AS sgroup,
  tsm_subject_choice            AS schoice,
  tsm_subject                   AS subject,
  tsm_subject_explain           AS sexplain,
  qua_name                      AS tnd1
FROM (
  SELECT
    CASE rv.rv_tnd1
      WHEN 'tnd11000' THEN sm.tsm_communication_type
      WHEN 'tnd12000' THEN sm.tsm_creation_type
      -- ... (기타 모든 WHEN절)
      WHEN 'tnd25000' THEN sm.tsm_adventurous_type
    END                      AS subject,
    sm.tsm_subject_group,
    sm.tsm_subject_choice,
    sm.tsm_subject,
    sm.tsm_subject_explain,
    sm.tsm_subject_code,
    qa.qua_name
  FROM
    mwd_resval rv
    JOIN mwd_tendency_subject_map sm ON sm.tsm_use = 'Y'
    JOIN mwd_question_attr qa ON qa.qua_code = rv.rv_tnd1
  WHERE
    anp_seq = 18240
) t
ORDER BY
  CAST(subject AS INT),
  tsm_subject_code
36. competencySubjectsQuery (역량별 추천 과목)

설명: 사용자의 상위 5개 핵심 역량을 개발하는 데 도움이 되는 추천 교과목들을 그룹별, 영역별로 상세하게 조회합니다.

주요 역할: 역량 개발 연계 교과목 추천

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
WITH Top5Competencies AS (
  SELECT
    sc1.sc1_rank,
    sc1.qua_code,
    qa.qua_name
  FROM
    mwd_score1 sc1
  JOIN
    mwd_question_attr qa ON sc1.qua_code = qa.qua_code
  WHERE
    sc1.anp_seq = 18240
    AND sc1.sc1_step = 'tal'
    AND sc1.sc1_rank <= 5
)
SELECT
  t5c.sc1_rank AS competency_rank,
  t5c.qua_name AS competency_name,
  mcs.mcs_group AS subject_group,
  mcs.mcs_area AS subject_area,
  mcs.mcs_name AS subject_name,
  mcs.mcs_explain AS subject_explain,
  mcs.mcs_rank AS subject_rank
FROM
  mwd_competency_subject_map mcs
  JOIN Top5Competencies t5c ON mcs.tal_code = t5c.qua_code
WHERE
  mcs.mcs_use = 'Y'
ORDER BY
  t5c.sc1_rank,
  mcs.mcs_rank
8. 통계 및 비교 분석 쿼리 (Query 37)

전체 사용자 데이터와 비교하여 사용자의 위치를 통계적으로 분석합니다.

37. tendencySchoolsQuery / thinkingSchoolsQuery (성향/사고력 기반 학교/학과 통계)

설명: 사용자의 주 성향(또는 사고력)과 동일한 성향을 가진 학생들이 많이 분포한 대학교 및 학과를 통계적으로 분석하여 상위 100개를 보여주는 매우 복잡한 쿼리입니다. 통계적 유의성을 위해 일정 수 이상의 학생이 있는 데이터만 필터링합니다. (아래는 tendencySchoolsQuery 예시)

주요 역할: 진로/진학 선택을 위한 통계적 참고자료 제공

code
SQL
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
-- tendencySchoolsQuery
WITH UserPrimaryTendency AS (
  SELECT rv_tnd1
  FROM mwd_resval
  WHERE anp_seq = 18240
  LIMIT 1
), DepartmentStats AS (
  SELECT
    p.pe_school_major AS department_name,
    COUNT(DISTINCT p.pe_seq) AS total_students_in_dept,
    COUNT(DISTINCT CASE WHEN rv.rv_tnd1 = upt.rv_tnd1 THEN p.pe_seq ELSE NULL END) AS tendency_students_in_dept
  FROM mwd_person p
  JOIN mwd_resval rv ON p.pe_seq = rv.anp_seq -- 이 부분은 논리적으로 pe_seq와 anp_seq가 동일해야 함
  JOIN UserPrimaryTendency upt ON 1=1
  WHERE p.pe_ur_education IN ('URE0005', 'URE0006') AND p.pe_school_major IS NOT NULL AND p.pe_school_major <> ''
  GROUP BY p.pe_school_major
), UniversityStats AS (
  -- 대학교 단위 통계 (유사한 구조)
)
SELECT
  'departments' as type,
  ds.department_name as name,
  ds.tendency_students_in_dept as tendency_students,
  ds.total_students_in_dept as total_students,
  ROUND((ds.tendency_students_in_dept::numeric * 100.0 / ds.total_students_in_dept), 2) AS tendency_percentage
FROM DepartmentStats ds
WHERE ds.total_students_in_dept >= 20
UNION ALL
SELECT
  'schools' as type,
  us.university_name as name,
  -- ... (대학교 통계 필드)
FROM UniversityStats us
WHERE us.total_students_in_uni >= 20
ORDER BY tendency_percentage DESC, total_students DESC
LIMIT 100



네, 그럼요. 제공해주신 37개 SQL 쿼리 각각의 역할과 목적에 대해 자세히 설명해 드리겠습니다. 이 쿼리들은 기존 mwd_로 시작하는 원본 데이터베이스에서 특정 사용자(anp_seq = 18240)의 검사 결과를 추출하여, 의미 있는 리포트를 생성하기 위한 각 단계를 구성하고 있습니다.
쿼리 설명 (1-37)
1. anp_seq 존재 여부 확인
설명: mwd_answer_progress 테이블에서 주어진 검사 번호(anp_seq)가 존재하는지 확인하는 가장 기본적인 쿼리입니다. 후속 쿼리 실행 전에 데이터 유효성을 검사하는 용도로 사용됩니다.
2. instituteSettingsQuery (기관 설정 조회)
설명: 사용자가 개인 회원인지, 특정 기관(학교, 회사 등) 소속 회원인지 판별합니다. 또한, 소속 기관이 설정한 리포트 결과(성향, 역량)의 표시 유형(요약형, 상세형 등)을 가져옵니다.
3. personalInfoQuery (개인 정보 조회)
설명: 검사자의 상세한 개인 정보를 조회하는 종합 쿼리입니다. 여러 테이블을 조인하여 이름, 생년월일, 성별, 연락처, 학력, 직업, 나이, 소속 기관명 등 리포트 상단에 표시될 기본 인적 사항을 가져옵니다.
4. tendencyQuery (대표 성향 조회)
설명: 검사 결과 가장 두드러지게 나타난 대표 성향 2가지(1순위, 2순위)의 이름(rv_tnd1, rv_tnd2)을 조회합니다. 리포트의 핵심 주제를 결정하는 중요한 정보입니다.
5. tendency1ExplainQuery (1순위 성향 설명 조회)
설명: 1순위 대표 성향에 대한 표준 해석 문구를 가져옵니다. que_explain 컬럼의 ���와 같은 플레이스홀더를 실제 사용자 이름으로 대체하여 개인화된 설명을 만듭니다.
6. tendency2ExplainQuery (2순위 성향 설명 조회)
설명: 2순위 대표 성향에 대한 표준 해석 문구를 가져옵니다. 5번 쿼리와 동일한 역할을 합니다.
7. topTendencyQuery (상위 성향 3가지 조회)
설명: 점수를 기준으로 순위가 매겨진 성향들 중 상위 3개의 성향 이름, 순위, 코드를 조회합니다. 사용자의 강점을 보여주는 데 사용됩니다.
8. bottomTendencyQuery (하위 성향 3가지 조회)
설명: 전체 성향 중 가장 순위가 낮은 3개의 성향을 조회합니다. 사용자의 보완점을 파악하는 데 사용됩니다.
9. tendencyQuestionExplainQuery (성향 관련 응답 조회)
설명: 상위 3개 성향이 왜 그렇게 도출되었는지 근거를 제시하기 위해, 사용자가 높게 응답한(가중치 4 이상) 관련 문항의 설명을 가져옵니다.
10. detailedPersonalityAnalysisQuery (상세 성격 분석)
설명: 9번 쿼리와 매우 유사하며, 상위 3개 성향에 대해 사용자가 높게 응답한 문항을 근거로 상세한 성격 분석 데이터를 제공합니다.
11. topTendencyExplainQuery (상위 성향 종합 설명)
설명: 상위 15개 성향의 순위, 이름, 그리고 각 성향에 대한 설명을 조회하여 사용자의 성격 프로필에 대한 폭넓은 이해를 돕습니다.
12. bottomTendencyExplainQuery (하위 성향 종합 설명)
설명: 8번 쿼리와 유사하게, 가장 순위가 낮은 성향들의 이름과 설명을 조회하여 보완점에 대한 상세 정보를 제공합니다.
13. thinkingMainQuery (대표 사고력 조회)
설명: 사용자의 대표적인 주 사고력(rv_thk1)과 보조 사고력(rv_thk2), 그리고 종합 사고력 점수(rv_thktscore)를 조회합니다.
14. thinkingScoreQuery (8대 사고력 점수 조회)
설명: 사실적, 추론적, 분석적 사고력 등 8가지 세부 사고력 영역 각각의 점수(백분율)를 계산하여 가져옵니다. 세로로 긴 데이터(long-format)를 가로로 넓은 데이터(wide-format)로 변환(pivot)하는 역할을 합니다.
15. thinkingDetailQuery (사고력 상세 분석)
설명: 8대 사고력 각각의 이름, 점수, 그리고 점수 수준(상/중/하)에 따라 각기 다른 해석 문구를 조회합니다.
16. suitableJobsSummaryQuery (적합 직업 요약)
설명: 사용자의 대표 성향과 관련된 7개의 추천 직업을 쉼표로 연결된 하나의 문자열로 요약하여 보여줍니다.
17. suitableJobsDetailQuery (적합 직업 상세 정보)
설명: 대표 성향 기반으로 추천된 상위 7개 직업의 이름, 개요, 주요 업무 등 상세 정보를 조회합니다.
18. suitableJobMajorsQuery (적합 직업 관련 전공)
설명: 추천된 상위 7개 직업과 관련된 대학/학과 정보를 조회합니다.
19. imagePreferenceQuery (이미지 선호도 검사 통계)
설명: 이미지 선호도 검사의 수행 통계(총 이미지 수, 응답 수, 응답률)를 조회합니다.
20. pdKindQuery (검사 상품 종류 확인)
설명: 사용자가 응시한 검사의 구체적인 상품 종류(Product Kind)를 확인합니다. 리포트의 종류를 분기 처리하는 데 사용될 수 있습니다.
21. talentListQuery (핵심 역량 목록 조회)
설명: 사용자의 상위 5개 핵심 역량(재능)의 이름을 쉼표로 구분된 하나의 문자열로 가져옵니다.
22. talentDetailsQuery (핵심 역량 상세 분석)
설명: 상위 5개 핵심 역량의 이름, 점수, 순위, 상세 설명과 함께, 해당 역량이 전체 응시자 중 상위 몇 %에 해당하는지(백분위 순위)를 계산하여 보여주는 복합적인 쿼리입니다.
23. preferenceDataQuery (선호도 데이터 조회)
설명: 이미지 선호도 검사 결과, 가장 선호도가 높게 나타난 3가지 유형의 이름, 관련 문항 수, 응답률, 상세 설명을 조회합니다.
24. preferenceJobs1Query (1순위 선호도 기반 직업 추천)
설명: 1순위로 나타난 이미지 선호도 유형과 관련된 추천 직업 및 전공 정보를 조회합니다.
25. preferenceJobs2Query (2순위 선호도 기반 직업 추천)
설명: 2순위 선호도 유형과 관련된 추천 직업 및 전공 정보를 조회합니다.
26. preferenceJobs3Query (3순위 선호도 기반 직업 추천)
설명: 3순위 선호도 유형과 관련된 추천 직업 및 전공 정보를 조회합니다.
27. competencyJobsQuery (역량 기반 직업 추천)
설명: 사용자의 핵심 역량(재능) 분석 결과를 기반으로 추천되는 상위 7개 직업의 상세 정보를 조회합니다.
28. competencyJobMajorsQuery (역량 기반 직업 관련 전공)
설명: 역량 기반으로 추천된 직업들과 관련된 학과/전공 정보를 조회합니다.
29. dutiesQuery (추천 직무 조회)
설명: 사용자의 성향을 기반으로 적합한 세부 직무(Duty)를 5개까지 추천하고, 적합도를 계산하여 보여줍니다.
30. learningStyleQuery (학습 스타일 분석)
설명: 대표 성향 2가지에 따른 학습 스타일(공부 성향, 공부 방법)과, 시각화(차트)에 사용될 좌표 값을 조회합니다.
31. styleChartQuery / methodChartQuery (학습 스타일/방법 차트 데이터)
설명: 대표 성향에 따른 학습 스타일과 학습 방법을 시각화(차트)하는 데 필요한 데이터(항목명, 비율, 색상 코드)를 조회합니다. 총 4개의 유사한 쿼리로 구성됩니다.
32. subjectRanksQuery (과목 순위 조회)
설명: 사용자의 주된 성향에 따라 추천되는 교과목들을 순위별로 조회합니다. CASE 문을 사용하여 각 성향 코드에 맞는 과목 순위를 매핑합니다.
33. tendencySubjectsQuery (성향별 추천 과목 조회)
설명: 32번과 유사하게, 사용자의 주 성향의 이름과 함께 해당 성향에 추천되는 교과목들을 상세히 보여줍니다.
34. tendencyStatsQuery (성향 통계 분석)
설명: 사용자의 상위 3개 성향에 대해, 각 성향이 전체 응시자 중에서 1순위로 나타난 비율이 몇 %인지 통계 정보를 계산하여 제공합니다.
35. thinkingSkillComparisonQuery (사고력 비교 분석)
설명: 8대 사고력 각각에 대해 '나의 점수'와 '전체 평균 점수'를 함께 조회하여, 자신의 사고력 수준을 객관적으로 비교할 수 있게 합니다.
36. competencySubjectsQuery (역량별 추천 과목)
설명: 사용자의 상위 5개 핵심 역량을 개발하는 데 도움이 되는 추천 교과목들을 그룹별, 영역별로 상세하게 조회합니다.
37. tendencySchoolsQuery / thinkingSchoolsQuery (성향/사고력 기반 학교/학과 통계)
설명: 사용자의 주 성향(또는 사고력)과 동일한 성향을 가진 학생들이 많이 분포한 대학교 및 학과를 통계적으로 분석하여 상위 100개를 보여주는 매우 복잡한 쿼리입니다. 통계적 유의성을 위해 일정 수 이상의 학생이 있는 데이터만 필터링합니다.
