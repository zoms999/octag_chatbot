"""
Document Transformation Engine
Converts query results into thematic documents for RAG system
"""

import logging
from typing import Dict, Any, List
from dataclasses import dataclass
from datetime import datetime
import json
from collections import defaultdict

from database.models import DocumentType

logger = logging.getLogger(__name__)

class DocumentTransformationError(Exception):
    """Raised when document transformation fails"""
    def __init__(self, doc_type: str, error_message: str):
        self.doc_type = doc_type
        self.error_message = error_message
        super().__init__(f"Document transformation failed for {doc_type}: {error_message}")

@dataclass
class TransformedDocument:
    """Container for transformed document data"""
    doc_type: str
    content: Dict[str, Any]
    summary_text: str
    metadata: Dict[str, Any]

class DocumentTransformer:
    """
    Transforms raw query results into semantic documents optimized for RAG
    """
    
    def __init__(self):
        self.transformation_methods = {
            DocumentType.USER_PROFILE: self._create_user_profile_document, # <-- [6단계] 추가
            DocumentType.PERSONALITY_PROFILE: self._create_personality_profile,
            DocumentType.THINKING_SKILLS: self._create_thinking_skills_document,
            DocumentType.CAREER_RECOMMENDATIONS: self._create_career_recommendations_document,
            DocumentType.LEARNING_STYLE: self._create_learning_style_document,
            DocumentType.COMPETENCY_ANALYSIS: self._create_competency_analysis_document,
            DocumentType.PREFERENCE_ANALYSIS: self._create_preference_analysis_document
        }
    
    def _safe_get(self, data: List[Dict[str, Any]], index: int = 0, default: Dict[str, Any] = None) -> Dict[str, Any]:
        if default is None:
            default = {}
        if not data or len(data) <= index:
            return default
        return data[index] if data[index] is not None else default
    
    def _safe_get_value(self, data: Dict[str, Any], key: str, default: Any = None) -> Any:
        return data.get(key, default) if data else default

    def _get_skill_level(self, percentile: float) -> str:
        """Determine skill level based on percentile"""
        if percentile >= 90: return "매우 우수 (상위 10%)"
        elif percentile >= 75: return "우수 (상위 25%)"
        elif percentile >= 50: return "보통 (상위 50%)"
        elif percentile >= 25: return "개선 필요"
        else: return "많은 개선 필요"
    
    # ▼▼▼ [6단계: 추가된 문서 생성 메소드] ▼▼▼
    def _create_user_profile_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        try:
            personal_info = self._safe_get(query_results.get("personalInfoQuery", []))
            if not personal_info or 'user_name' not in personal_info:
                raise DocumentTransformationError(DocumentType.USER_PROFILE, "personalInfoQuery returned no data.")

            content = {
                "user_name": self._safe_get_value(personal_info, "user_name"),
                "age": self._safe_get_value(personal_info, "age"),
                "gender": self._safe_get_value(personal_info, "gender")
            }
            
            summary_text = (
                f"검사자는 {content['user_name']}님이며, 나이는 {content['age']}세, 성별은 {content['gender']}입니다."
            )
            
            metadata = {
                "document_version": "1.5", "created_at": datetime.now().isoformat(),
                "data_sources": ["personalInfoQuery"],
            }
            
            return TransformedDocument(
                doc_type=DocumentType.USER_PROFILE,
                content=content, summary_text=summary_text, metadata=metadata
            )
        except Exception as e:
            logger.error(f"Error creating user profile document: {e}", exc_info=True)
            raise DocumentTransformationError(DocumentType.USER_PROFILE, str(e))

    def _create_personality_profile(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        try:
            tendency_data = self._safe_get(query_results.get("tendencyQuery", []))
            top_tendencies = query_results.get("topTendencyQuery", [])
            bottom_tendencies = query_results.get("bottomTendencyQuery", [])
            tendency_stats = query_results.get("tendencyStatsQuery", [])
            personality_detail = query_results.get("personalityDetailQuery", [])
            strengths_weaknesses = query_results.get("strengthsWeaknessesQuery", [])
            
            primary_name = self._safe_get_value(tendency_data, "Tnd1")
            secondary_name = self._safe_get_value(tendency_data, "Tnd2")

            primary_stats = self._safe_get([s for s in tendency_stats if s.get('tendency_name', '').startswith(primary_name)])
            secondary_stats = self._safe_get([s for s in tendency_stats if s.get('tendency_name', '').startswith(secondary_name)])
            
            content = {
                "primary_tendency": {
                    "name": primary_name,
                    "percentage": self._safe_get_value(primary_stats, "percentage", 0.0)
                },
                "secondary_tendency": {
                    "name": secondary_name,
                    "percentage": self._safe_get_value(secondary_stats, "percentage", 0.0)
                },
                "top_tendencies": top_tendencies,
                "bottom_tendencies": bottom_tendencies,
                "personality_details": personality_detail,
                "strengths_weaknesses": strengths_weaknesses
            }
            
            summary_text = (
                f"사용자의 주요 성향은 '{primary_name}'이며, 이는 전체 응답자의 {content['primary_tendency']['percentage']}%에 해당하는 유형입니다. "
                f"부성향은 '{secondary_name}'(으)로, 전체의 {content['secondary_tendency']['percentage']}%가 이 유형에 속합니다. "
                f"강점 성향은 {', '.join([t['tendency_name'] for t in top_tendencies])} 등입니다."
            )
            
            metadata = {
                "document_version": "1.4", "created_at": datetime.now().isoformat(),
                "data_sources": ["tendencyQuery", "topTendencyQuery", "bottomTendencyQuery", "tendencyStatsQuery", "personalityDetailQuery", "strengthsWeaknessesQuery"],
                "primary_tendency_name": primary_name,
            }
            
            return TransformedDocument(
                doc_type=DocumentType.PERSONALITY_PROFILE,
                content=content, summary_text=summary_text, metadata=metadata
            )
        except Exception as e:
            logger.error(f"Error creating personality profile document: {e}", exc_info=True)
            raise DocumentTransformationError(DocumentType.PERSONALITY_PROFILE, str(e))
    
    def _create_thinking_skills_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        try:
            comparison_data = query_results.get("thinkingSkillComparisonQuery", [])
            if not comparison_data:
                raise DocumentTransformationError(DocumentType.THINKING_SKILLS, "thinkingSkillComparisonQuery returned no data.")

            skills_with_avg = {item['skill_name']: item for item in comparison_data}
            
            thinking_skills_raw = query_results.get("thinkingSkillsQuery", [])
            for skill_raw in thinking_skills_raw:
                skill_name = skill_raw.get('skill_name')
                if skill_name in skills_with_avg:
                    skills_with_avg[skill_name]['percentile'] = skill_raw.get('percentile', 0)

            final_skills = sorted(list(skills_with_avg.values()), key=lambda x: x.get('my_score', 0), reverse=True)

            content = {
                "core_thinking_skills": final_skills,
                "top_skills": final_skills[:3],
                "bottom_skills": final_skills[-3:],
            }

            top_skill = content['top_skills'][0]
            summary_text = (
                f"사용자의 사고력 분석 결과, '{top_skill['skill_name']}'에서 가장 뛰어난 역량을 보입니다. "
                f"점수는 {top_skill['my_score']}점으로, 전체 평균({top_skill['average_score']}점)보다 월등히 높습니다. "
                f"전체적으로 {', '.join([s['skill_name'] for s in content['top_skills']])} 영역에서 강점을 보입니다."
            )

            metadata = {
                "document_version": "1.4", "created_at": datetime.now().isoformat(),
                "data_sources": ["thinkingSkillComparisonQuery", "thinkingSkillsQuery"],
                "skills_analyzed": len(final_skills),
                "strongest_skill": top_skill['skill_name']
            }

            return TransformedDocument(
                doc_type=DocumentType.THINKING_SKILLS,
                content=content, summary_text=summary_text, metadata=metadata
            )
        except Exception as e:
            logger.error(f"Error creating thinking skills document: {e}", exc_info=True)
            raise DocumentTransformationError(DocumentType.THINKING_SKILLS, str(e))

    def _create_career_recommendations_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        try:
            tendency_jobs = query_results.get("careerRecommendationQuery", [])
            competency_jobs = query_results.get("competencyJobsQuery", [])
            preference_jobs = query_results.get("preferenceJobsQuery", [])
            duties = query_results.get("dutiesQuery", [])
            
            if not any([tendency_jobs, competency_jobs, preference_jobs, duties]):
                 raise DocumentTransformationError(DocumentType.CAREER_RECOMMENDATIONS, "No career recommendation data found.")

            # 선호도 기반 직업 추천을 유형별(rimg1, rimg2, rimg3)로 그룹화
            pref_jobs_by_type = defaultdict(list)
            for job in preference_jobs:
                pref_jobs_by_type[job['preference_type']].append(job)

            content = {
                "tendency_based_jobs": tendency_jobs,
                "competency_based_jobs": competency_jobs,
                "preference_based_jobs": dict(pref_jobs_by_type),
                "recommended_duties": duties,
            }
            
            summary_parts = []
            if tendency_jobs:
                summary_parts.append(f"사용자의 성향에 기반하여 '{tendency_jobs[0]['job_name']}' 등 {len(tendency_jobs)}개의 직업이 추천됩니다.")
            if competency_jobs:
                 summary_parts.append(f"보유한 역량을 바탕으로는 '{competency_jobs[0]['jo_name']}' 등 {len(competency_jobs)}개의 직업이 적합합니다.")
            if preference_jobs:
                pref_name = preference_jobs[0]['preference_name']
                summary_parts.append(f"'{pref_name}' 선호 유형에 따라 '{preference_jobs[0]['jo_name']}'을 포함한 직업들이 추천됩니다.")
            if duties:
                summary_parts.append(f"추천되는 세부 직무로는 '{duties[0]['du_name']}' 등이 있습니다.")

            summary_text = " ".join(summary_parts) if summary_parts else "다양한 기준에 따른 직업 및 직무 정보가 분석되었습니다."
            
            metadata = {
                "document_version": "1.3", "created_at": datetime.now().isoformat(),
                "data_sources": ["careerRecommendationQuery", "competencyJobsQuery", "preferenceJobsQuery", "dutiesQuery"],
                "tendency_jobs_count": len(tendency_jobs),
                "competency_jobs_count": len(competency_jobs),
                "preference_jobs_count": len(preference_jobs),
                "duties_count": len(duties)
            }

            return TransformedDocument(
                doc_type=DocumentType.CAREER_RECOMMENDATIONS,
                content=content, summary_text=summary_text, metadata=metadata
            )
        except Exception as e:
            logger.error(f"Error creating career recommendations document: {e}", exc_info=True)
            raise DocumentTransformationError(DocumentType.CAREER_RECOMMENDATIONS, str(e))

    def _create_learning_style_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        try:
            learning_style_results = query_results.get("learningStyleQuery", [])
            chart_results = query_results.get("learningStyleChartQuery", [])
            subject_ranks = query_results.get("subjectRanksQuery", [])

            if not learning_style_results:
                raise DocumentTransformationError(DocumentType.LEARNING_STYLE, "learningStyleQuery returned no data.")

            style_info = self._safe_get(learning_style_results)
            
            style_chart_data = [d for d in chart_results if d.get("item_type") == 'S']
            method_chart_data = [d for d in chart_results if d.get("item_type") == 'W']

            content = {
                "primary_tendency_style": {
                    "name": self._safe_get_value(style_info, "tnd1_name", ""),
                    "study_tendency_description": self._safe_get_value(style_info, "tnd1_study_tendency", ""),
                    "study_way_description": self._safe_get_value(style_info, "tnd1_study_way", "")
                },
                "recommended_subjects": subject_ranks,
                "style_chart_data": style_chart_data,
                "method_chart_data": method_chart_data,
            }
            
            summary_parts = [
                f"주요 학습 성향은 '{content['primary_tendency_style']['name']}'입니다.",
                f"추천 공부 방법은 {content['primary_tendency_style']['study_way_description']}"
            ]
            
            # ▼▼▼ [수정] subject_ranks 데이터가 있을 때만 요약문에 추가하도록 변경 ▼▼▼
            if subject_ranks and len(subject_ranks) > 1:
                summary_parts.append(f"이러한 성향에 기반하여, '{subject_ranks[0]['subject_name']}' 및 '{subject_ranks[1]['subject_name']}' 과목에서 높은 성취도를 보일 가능성이 있습니다.")
            elif subject_ranks:
                 summary_parts.append(f"이러한 성향에 기반하여, '{subject_ranks[0]['subject_name']}' 과목에서 높은 성취도를 보일 가능성이 있습니다.")

            summary_text = " ".join(summary_parts)

            metadata = {
                "document_version": "1.5", "created_at": datetime.now().isoformat(),
                "data_sources": ["learningStyleQuery", "learningStyleChartQuery", "subjectRanksQuery"],
                "primary_style_name": content['primary_tendency_style']['name']
            }
            
            return TransformedDocument(
                doc_type=DocumentType.LEARNING_STYLE,
                content=content, summary_text=summary_text, metadata=metadata
            )
        except Exception as e:
            logger.error(f"Error creating learning style document: {e}", exc_info=True)
            raise DocumentTransformationError(DocumentType.LEARNING_STYLE, str(e))
    def _create_competency_analysis_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        try:
            competencies = query_results.get("competencyAnalysisQuery", [])
            subjects = query_results.get("competencySubjectsQuery", [])

            if not competencies:
                raise DocumentTransformationError(DocumentType.COMPETENCY_ANALYSIS, "competencyAnalysisQuery returned no data.")
            
            subjects_by_competency = defaultdict(list)
            for sub in subjects:
                subjects_by_competency[sub['competency_name']].append({
                    "group": sub['subject_group'],
                    "area": sub['subject_area'],
                    "name": sub['subject_name'],
                    "explain": sub['subject_explain']
                })

            top_competencies = []
            for comp in competencies:
                comp_name = comp['competency_name']
                comp_data = {
                    "name": comp_name,
                    "score": comp['score'],
                    "rank": comp['rank'],
                    "percentile": comp['percentile'],
                    "level": self._get_skill_level(comp.get('percentile', 0)),
                    "description": comp['description'],
                    "recommended_subjects": subjects_by_competency.get(comp_name, [])
                }
                top_competencies.append(comp_data)
            
            content = {
                "top_competencies": top_competencies,
                "competency_summary": {
                    "strongest_competency": top_competencies[0]['name'] if top_competencies else "N/A",
                    "average_percentile": round(sum(c.get('percentile', 0) for c in top_competencies) / len(top_competencies), 1) if top_competencies else 0,
                }
            }
            
            summary_parts = [
                f"사용자의 상위 5개 핵심 역량 분석 결과, 가장 뛰어난 역량은 '{content['competency_summary']['strongest_competency']}'(으)로, 전체 응시자 중 상위 {top_competencies[0]['percentile']}% 수준입니다."
            ]
            if len(top_competencies) > 1:
                summary_parts.append(f"그 외에도 {', '.join([c['name'] for c in top_competencies[1:3]])} 등의 역량이 뛰어납니다.")
            if subjects and top_competencies[0]['name'] in subjects_by_competency and subjects_by_competency[top_competencies[0]['name']]:
                summary_parts.append(f"'{top_competencies[0]['name']}' 역량 강화를 위해 '{subjects_by_competency[top_competencies[0]['name']][0]['name']}' 과목 학습이 추천됩니다.")

            summary_text = " ".join(summary_parts)
            
            metadata = {
                "document_version": "1.2", "created_at": datetime.now().isoformat(),
                "data_sources": ["competencyAnalysisQuery", "competencySubjectsQuery"],
                "competencies_analyzed": len(top_competencies),
                "strongest_competency_name": content['competency_summary']['strongest_competency']
            }
            
            return TransformedDocument(
                doc_type=DocumentType.COMPETENCY_ANALYSIS,
                content=content, summary_text=summary_text, metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Error creating competency analysis document: {e}", exc_info=True)
            raise DocumentTransformationError(DocumentType.COMPETENCY_ANALYSIS, str(e))
    
    def _create_preference_analysis_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        try:
            stats = self._safe_get(query_results.get("imagePreferenceStatsQuery", []))
            preferences = query_results.get("preferenceDataQuery", [])

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
                "document_version": "1.3", "created_at": datetime.now().isoformat(),
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
    
    async def transform_all_documents(
        self, 
        query_results: Dict[str, List[Dict[str, Any]]]
    ) -> List[TransformedDocument]:
        documents = []
        
        for doc_type, transform_method in self.transformation_methods.items():
            try:
                # Use doc_type.name to get the string representation for logging
                doc_type_name = doc_type.name if hasattr(doc_type, 'name') else str(doc_type)
                logger.info(f"Attempting to transform document type: {doc_type_name}")
                document = transform_method(query_results)
                documents.append(document)
                logger.info(f"Successfully transformed {doc_type_name} document")
            except DocumentTransformationError as e:
                doc_type_name = e.doc_type.name if hasattr(e.doc_type, 'name') else str(e.doc_type)
                logger.warning(f"Could not transform {doc_type_name}: {e.error_message}")
                continue
            except Exception as e:
                doc_type_name = doc_type.name if hasattr(doc_type, 'name') else str(doc_type)
                logger.error(f"Unexpected error while transforming {doc_type_name}: {e}", exc_info=True)
                continue
        
        logger.info(f"Document transformation completed. Created {len(documents)} documents.")
        return documents