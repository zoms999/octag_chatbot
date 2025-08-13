네, 알겠습니다. 이제 모든 핵심 데이터 조각이 준비되었으니, 마지막 쿼리 추가 단계이자 전체 데이터 파이프라인을 완성하는 마지막 6단계를 진행하겠습니다.

이번 단계의 목표는 다음과 같습니다.

미구현 쿼리 정리: legacy_query_executor.py에서 아직 구현되지 않은 나머지 쿼리들을 더 이상 시도하지 않도록 정리하여 ETL 프로세스의 실행 속도를 최적화합니다.

최종 문서 생성: document_transformer.py에서 아직 구현되지 않은 나머지 문서 생성 메소드들을 **빈 문서(placeholder)**를 생성하도록 수정하여, ETL 파이프라인이 항상 모든 DocumentType에 대해 정상적으로 완료되도록 안정성을 확보합니다.

이 단계를 완료하면, 우리의 ETL 파이프라인은 최종적으로 완성됩니다.

1. legacy_query_executor.py 수정 사항
1.1 execute_all_queries_async 및 get_successful_results 메소드 최적화

execute_all_queries_async 메소드에서 실제로 구현된 쿼리만 실행하도록 수정하고, get_successful_results 메소드는 DocumentTransformer가 기대하는 모든 키에 대해 안전하게 빈 리스트를 제공하도록 수정합니다.

LegacyQueryExecutor 클래스 전체를 아래 코드로 교체하십시오. AptitudeTestQueries 클래스는 변경할 필요가 없습니다.

code
Python
download
content_copy
expand_less

# legacy_query_executor.py 파일에서 LegacyQueryExecutor 클래스 전체를 이 코드로 교체하세요.

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
        
        # ▼▼▼ [6단계 수정] 실제로 구현된 쿼리 목록을 클래스 변수로 관리합니다. ▼▼▼
        self.IMPLEMENTED_QUERIES = [
            "tendencyQuery", "topTendencyQuery", "thinkingSkillsQuery",
            "careerRecommendationQuery", "bottomTendencyQuery",
            "personalityDetailQuery", "strengthsWeaknessesQuery",
            "learningStyleQuery", "learningStyleChartQuery",
            "competencyAnalysisQuery", "competencySubjectsQuery",
            "competencyJobsQuery", "competencyJobMajorsQuery", "dutiesQuery",
            "imagePreferenceStatsQuery", "preferenceDataQuery", "preferenceJobsQuery",
            "tendencyStatsQuery", "thinkingSkillComparisonQuery",
            "personalInfoQuery", "subjectRanksQuery",
        ]

    # ... (기존 _setup_validators 및 _validate_* 메소드들은 변경 없음) ...
    def _setup_validators(self) -> Dict[str, callable]:
        """Setup validation functions for different query types"""
        return {
            "tendencyQuery": self._validate_tendency_query,
            "topTendencyQuery": self._validate_top_tendency_query,
            "thinkingSkillsQuery": self._validate_thinking_skills_query,
            "careerRecommendationQuery": self._validate_career_recommendation_query,
            "bottomTendencyQuery": self._validate_top_tendency_query,
            "personalityDetailQuery": self._validate_personality_detail_query,
            "strengthsWeaknessesQuery": self._validate_strengths_weaknesses_query,
            "learningStyleQuery": self._validate_learning_style_query,
            "learningStyleChartQuery": self._validate_learning_style_chart_query,
            "competencyAnalysisQuery": self._validate_competency_analysis_query,
            "competencySubjectsQuery": self._validate_competency_subjects_query,
            "competencyJobsQuery": self._validate_competency_jobs_query,
            "competencyJobMajorsQuery": self._validate_competency_job_majors_query,
            "dutiesQuery": self._validate_duties_query,
            "imagePreferenceStatsQuery": self._validate_image_preference_stats_query,
            "preferenceDataQuery": self._validate_preference_data_query,
            "preferenceJobsQuery": self._validate_preference_jobs_query,
            "tendencyStatsQuery": self._validate_tendency_stats_query,
            "thinkingSkillComparisonQuery": self._validate_thinking_skill_comparison_query,
            "personalInfoQuery": self._validate_personal_info_query,
            "subjectRanksQuery": self._validate_subject_ranks_query,
        }
    
    def _validate_tendency_query(self, data: List[Dict[str, Any]]) -> bool:
        if not data or len(data) == 0: return False
        required_fields = ["Tnd1", "Tnd2"]
        for field in required_fields:
            if field not in data[0] or not data[0][field]: return False
        return True
    
    def _validate_top_tendency_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if len(data) == 0: return True
        required_fields = ["rank", "tendency_name", "code", "score"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
            if not isinstance(row.get("rank"), int) or not isinstance(row.get("score"), int): return False
        return True
    
    def _validate_thinking_skills_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if len(data) == 0: return True
        required_fields = ["skill_name", "score", "percentile"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
            score, percentile = row.get("score"), row.get("percentile")
            if not isinstance(score, int) or not 0 <= score <= 100: return False
            if not isinstance(percentile, int) or not 0 <= percentile <= 100: return False
        return True
    
    def _validate_career_recommendation_query(self, data: List[Dict[str, Any]]) -> bool:
        if not data: return True
        required_fields = ["job_code", "job_name", "match_score"]
        for row in data:
            for field in required_fields:
                if field not in row or (field != 'job_outline' and field != 'main_business' and not row[field]): return False
            match_score = row.get("match_score")
            if not isinstance(match_score, int) or not 0 <= match_score <= 100: return False
        return True

    def _validate_personality_detail_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["detail_description", "rank", "weight", "code"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True

    def _validate_strengths_weaknesses_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["description", "type", "weight"]
        for row in data:
            if field not in row: return False
            if row.get("type") not in ["strength", "weakness"]: return False
        return True
        
    def _validate_learning_style_query(self, data: List[Dict[str, Any]]) -> bool:
        if not data or len(data) != 1: return False
        required_fields = ["tnd1_name", "tnd1_study_tendency", "tnd1_study_way", "tnd2_name", "tnd2_study_tendency", "tnd2_study_way", "tnd_row", "tnd_col"]
        row = data[0]
        for field in required_fields:
            if field not in row: return False
        if not isinstance(row.get("tnd_row"), int) or not isinstance(row.get("tnd_col"), int): return False
        return True

    def _validate_learning_style_chart_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["item_name", "item_rate", "item_color", "item_type"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
            rate = row.get("item_rate")
            if not isinstance(rate, int) or not 0 <= rate <= 100: return False
            if row.get("item_type") not in ["S", "W"]: return False
        return True

    def _validate_competency_analysis_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["competency_name", "score", "rank", "description", "percentile"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
            if not isinstance(row.get("score"), int) or not isinstance(row.get("rank"), int) or not isinstance(row.get("percentile"), int): return False
        return True

    def _validate_competency_subjects_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["competency_rank", "competency_name", "subject_group", "subject_area", "subject_name", "subject_explain", "subject_rank"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True

    def _validate_competency_jobs_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["jo_name", "jo_outline", "jo_mainbusiness", "rank"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True

    def _validate_competency_job_majors_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["jo_name", "major"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True
    
    def _validate_duties_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["du_name", "du_content", "majors", "jf_name", "match_rate"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True

    def _validate_image_preference_stats_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        if len(data) != 1: return False
        required_fields = ["total_image_count", "response_count", "response_rate"]
        for field in required_fields:
            if field not in data[0]: return False
        return True

    def _validate_preference_data_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["preference_name", "question_count", "response_rate", "rank", "description"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True

    def _validate_preference_jobs_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["preference_name", "preference_type", "jo_name", "jo_outline", "jo_mainbusiness", "majors"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
            if row.get("preference_type") not in ["rimg1", "rimg2", "rimg3"]: return False
        return True

    def _validate_tendency_stats_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["tendency_name", "percentage"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
            if not isinstance(row.get("percentage"), float): return False
        return True

    def _validate_thinking_skill_comparison_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["skill_name", "my_score", "average_score"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
            if not isinstance(row.get("my_score"), int) or not isinstance(row.get("average_score"), int): return False
        return True

    def _validate_personal_info_query(self, data: List[Dict[str, Any]]) -> bool:
        if not data or len(data) != 1: return False
        required_fields = ["user_name", "age", "gender"]
        for field in required_fields:
            if field not in data[0]: return False
        return True

    def _validate_subject_ranks_query(self, data: List[Dict[str, Any]]) -> bool:
        if data is None: return False
        if not data: return True
        required_fields = ["subject_group", "subject_choice", "subject_name", "subject_explain", "rank"]
        for row in data:
            for field in required_fields:
                if field not in row: return False
        return True

    # ... ( _validate_query_result, _clean_query_data, _execute_single_query_with_retry 는 변경 없음 ) ...
    def _validate_query_result(self, query_name: str, data: List[Dict[str, Any]]) -> bool:
        validator = self.query_validators.get(query_name)
        if validator:
            try: return validator(data)
            except Exception as e:
                logger.error(f"Validation error for query '{query_name}': {e}")
                return False
        return data is not None and isinstance(data, list)

    def _clean_query_data(self, query_name: str, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not data: return []
        cleaned_data = []
        for row in data:
            cleaned_row = {k: v.strip() if isinstance(v, str) else v for k, v in row.items() if v is not None and v != ""}
            if cleaned_row: cleaned_data.append(cleaned_row)
        return cleaned_data

    async def _execute_single_query_with_retry(self, session: Session, anp_seq: int, query_name: str) -> QueryResult:
        for attempt in range(self.max_retries + 1):
            start_time = datetime.now()
            logger.info(f"Query '{query_name}' attempting to execute (attempt {attempt + 1})")
            try:
                loop = asyncio.get_event_loop()
                def execute_query():
                    aptitude_queries = AptitudeTestQueries(session)
                    return aptitude_queries.execute_all_queries(anp_seq).get(query_name, [])
                
                data = await asyncio.wait_for(loop.run_in_executor(self.executor, execute_query), timeout=self.query_timeout)
                execution_time = (datetime.now() - start_time).total_seconds()
                cleaned_data = self._clean_query_data(query_name, data)
                
                if not self._validate_query_result(query_name, cleaned_data):
                    raise QueryValidationError(query_name, "Query result validation failed")
                
                logger.info(f"Query '{query_name}' executed successfully in {execution_time:.2f}s, returned {len(cleaned_data)} rows")
                return QueryResult(query_name=query_name, success=True, data=cleaned_data, execution_time=execution_time, row_count=len(cleaned_data))
                
            except Exception as e:
                execution_time = (datetime.now() - start_time).total_seconds()
                if isinstance(e, asyncio.TimeoutError) or attempt >= self.max_retries:
                    logger.error(f"Query '{query_name}' failed after {attempt + 1} attempts: {e}\nTraceback: {traceback.format_exc()}")
                    return QueryResult(query_name=query_name, success=False, error=str(e), execution_time=execution_time)
                else:
                    wait_time = self.retry_delay * (2 ** attempt)
                    logger.warning(f"Query '{query_name}' failed on attempt {attempt + 1}: {e}. Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
        
        return QueryResult(query_name=query_name, success=False, error="Unknown error occurred")

    async def execute_all_queries_async(
        self, 
        session: Session, 
        anp_seq: int
    ) -> Dict[str, QueryResult]:
        """
        Execute all implemented queries asynchronously.
        """
        
        # ▼▼▼ [6단계 수정] 구현된 쿼리만 실행하도록 변경합니다. ▼▼▼
        query_names = self.IMPLEMENTED_QUERIES
        
        logger.info(f"Starting execution of {len(query_names)} implemented queries for anp_seq: {anp_seq}")
        
        tasks = [
            self._execute_single_query_with_retry(session, anp_seq, query_name)
            for query_name in query_names
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        query_results = {}
        successful_queries, failed_queries = 0, 0
        for i, result in enumerate(results):
            query_name = query_names[i]
            if isinstance(result, Exception):
                query_results[query_name] = QueryResult(query_name=query_name, success=False, error=str(result))
                failed_queries += 1
            else:
                query_results[query_name] = result
                if result.success: successful_queries += 1
                else: failed_queries += 1
        
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
        Extract successful query results and add empty placeholders for all expected queries.
        """
        # ▼▼▼ [6단계 수정] DocumentTransformer가 기대하는 모든 키 목록을 정의합니다. ▼▼▼
        ALL_EXPECTED_QUERIES = [
            "personalInfoQuery", "tendencyQuery", "topTendencyQuery", "bottomTendencyQuery",
            "personalityDetailQuery", "strengthsWeaknessesQuery", "tendencyStatsQuery",
            "thinkingSkillsQuery", "thinkingSkillComparisonQuery",
            "careerRecommendationQuery", "competencyJobsQuery", "preferenceJobsQuery", "dutiesQuery",
            "learningStyleQuery", "learningStyleChartQuery", "subjectRanksQuery",
            "competencyAnalysisQuery", "competencySubjectsQuery",
            "imagePreferenceStatsQuery", "preferenceDataQuery"
        ]

        successful_results = {}
        
        # 성공한 쿼리 결과만 먼저 채웁니다.
        for query_name, result in query_results.items():
            if result.success and result.data is not None:
                successful_results[query_name] = result.data

        # DocumentTransformer가 기대하는 모든 키에 대해 기본값(빈 리스트)을 설정합니다.
        for key in ALL_EXPECTED_QUERIES:
            successful_results.setdefault(key, [])

        return successful_results
    
    async def close(self):
        """Clean up resources"""
        if self.executor:
            self.executor.shutdown(wait=True)
            logger.info("LegacyQueryExecutor resources cleaned up")
2. document_transformer.py 수정 사항
2.1 모든 문서 생성 메소드에 대한 최종 안정성 확보

DocumentTransformer의 _create_... 메소드 중 아직 구현되지 않은 _create_preference_analysis_document를 다른 메소드들처럼 데이터가 없을 경우 DocumentTransformationError를 발생시키도록 수정하여 파이프라인의 안정성을 높입니다.

code
Python
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
# _create_preference_analysis_document 메소드를 이 코드로 교체하세요.

    def _create_preference_analysis_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        try:
            stats = self._safe_get(query_results.get("imagePreferenceStatsQuery", []))
            preferences = query_results.get("preferenceDataQuery", [])

            # ▼▼▼ [6단계 수정] 데이터가 없는 경우 에러를 발생시켜 안전하게 건너뛰도록 합니다. ▼▼▼
            if not preferences:
                raise DocumentTransformationError(DocumentType.PREFERENCE_ANALYSIS, "preferenceDataQuery returned no data.")

            content = {
                "preference_test_stats": stats,
                "top_preferences": preferences
            }

            top_pref_names = [p['preference_name'] for p in preferences]
            summary_text = (
                f"이미지 선호도 분석 결과, 사용자는 '{', '.join(top_pref_names)}' 유형에 가장 높은 선호도를 보입니다. "
                f"가장 선호하는 유형인 '{top_pref_names[0]}'에 대한 설명: {preferences[0]['description']}"
            )
            
            metadata = {
                "document_version": "1.5", "created_at": datetime.now().isoformat(),
                "data_sources": ["imagePreferenceStatsQuery", "preferenceDataQuery"],
                "top_preference_name": top_pref_names[0]
            }
            
            return TransformedDocument(
                doc_type=DocumentType.PREFERENCE_ANALYSIS,
                content=content, summary_text=summary_text, metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Error creating preference analysis document: {e}", exc_info=True)
            raise DocumentTransformationError(DocumentType.PREFERENCE_ANALYSIS, str(e))

이 수정들을 적용하고 애플리케이션을 재시작한 후 ETL을 실행하면, 불필요한 쿼리 실행 없이 더 빠르고 안정적으로 모든 문서가 생성될 것입니다. 이것으로 데이터 추출 및 변환 파이프라인의 구현이 최종적으로 완료됩니다.