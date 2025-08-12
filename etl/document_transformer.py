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
    
    def _create_personality_profile(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        try:
            tendency_data = self._safe_get(query_results.get("tendencyQuery", []))
            top_tendencies = query_results.get("topTendencyQuery", [])
            bottom_tendencies = query_results.get("bottomTendencyQuery", [])
            personality_detail = query_results.get("personalityDetailQuery", [])
            strengths_weaknesses = query_results.get("strengthsWeaknessesQuery", [])
            
            primary_tendency_name = self._safe_get_value(tendency_data, "Tnd1", "알 수 없음")
            secondary_tendency_name = self._safe_get_value(tendency_data, "Tnd2", "알 수 없음")
            
            primary_tendency = self._safe_get([t for t in top_tendencies if t.get('tendency_name', '').startswith(primary_tendency_name)])
            secondary_tendency = self._safe_get([t for t in top_tendencies if t.get('tendency_name', '').startswith(secondary_tendency_name)])
            
            content = {
                "primary_tendency": {
                    "name": self._safe_get_value(primary_tendency, "tendency_name", primary_tendency_name),
                    "code": self._safe_get_value(primary_tendency, "code", ""),
                    "rank": self._safe_get_value(primary_tendency, "rank", 1),
                    "score": self._safe_get_value(primary_tendency, "score", 0),
                },
                "secondary_tendency": {
                    "name": self._safe_get_value(secondary_tendency, "tendency_name", secondary_tendency_name),
                    "code": self._safe_get_value(secondary_tendency, "code", ""),
                    "rank": self._safe_get_value(secondary_tendency, "rank", 2),
                    "score": self._safe_get_value(secondary_tendency, "score", 0),
                },
                "top_tendencies": top_tendencies,
                "bottom_tendencies": bottom_tendencies,
                "personality_details": personality_detail,
                "strengths_weaknesses": strengths_weaknesses
            }
            
            summary_text = (
                f"사용자의 주요 성향은 {content['primary_tendency']['name']}이며, 부성향은 {content['secondary_tendency']['name']}입니다. "
                f"가장 강하게 나타나는 상위 성향들은 {', '.join([t['tendency_name'] for t in content.get('top_tendencies', [])[:3]])}입니다. "
                f"반면 보완이 필요한 성향으로는 {', '.join([t['tendency_name'] for t in content.get('bottom_tendencies', [])])} 등이 있습니다."
            )
            
            metadata = {
                "document_version": "1.2",
                "created_at": datetime.now().isoformat(),
                "data_sources": ["tendencyQuery", "topTendencyQuery", "bottomTendencyQuery", "personalityDetailQuery", "strengthsWeaknessesQuery"],
                "primary_tendency_code": content['primary_tendency']["code"],
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
            thinking_skills = query_results.get("thinkingSkillsQuery", [])
            if not thinking_skills:
                raise DocumentTransformationError(DocumentType.THINKING_SKILLS, "thinkingSkillsQuery returned no data.")

            core_skills = sorted(thinking_skills, key=lambda x: x.get('score', 0), reverse=True)
            avg_score = sum(s.get('score', 0) for s in core_skills) / len(core_skills) if core_skills else 0

            content = {
                "core_thinking_skills": core_skills,
                "top_skills": core_skills[:3],
                "bottom_skills": core_skills[-3:],
                "overall_analysis": {
                    "average_score": round(avg_score, 2),
                    "overall_level": self._get_skill_level(avg_score),
                }
            }

            summary_text = (
                f"사용자의 전체적인 사고능력은 평균 {content['overall_analysis']['average_score']:.1f}점으로, '{content['overall_analysis']['overall_level']}' 수준입니다. "
                f"특히 '{', '.join([s['skill_name'] for s in content['top_skills']])}'에서 강점을 보입니다."
            )

            metadata = {
                "document_version": "1.2", "created_at": datetime.now().isoformat(),
                "data_sources": ["thinkingSkillsQuery"], "skills_analyzed": len(core_skills),
                "average_score": content['overall_analysis']['average_score']
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
            duties = query_results.get("dutiesQuery", [])
            
            if not tendency_jobs and not competency_jobs and not duties:
                 raise DocumentTransformationError(DocumentType.CAREER_RECOMMENDATIONS, "No career recommendation data found.")

            content = {
                "tendency_based_jobs": tendency_jobs,
                "competency_based_jobs": competency_jobs,
                "recommended_duties": duties,
            }
            
            summary_parts = []
            if tendency_jobs:
                summary_parts.append(f"사용자의 성향에 기반하여 '{tendency_jobs[0]['job_name']}'을 포함한 {len(tendency_jobs)}개의 직업이 추천됩니다.")
            if competency_jobs:
                 summary_parts.append(f"보유한 역량을 바탕으로는 '{competency_jobs[0]['jo_name']}'을 포함한 {len(competency_jobs)}개의 직업이 적합합니다.")
            if duties:
                summary_parts.append(f"추천되는 세부 직무로는 '{duties[0]['du_name']}' 등이 있습니다.")

            summary_text = " ".join(summary_parts)
            
            metadata = {
                "document_version": "1.2", "created_at": datetime.now().isoformat(),
                "data_sources": ["careerRecommendationQuery", "competencyJobsQuery", "dutiesQuery"],
                "tendency_jobs_count": len(tendency_jobs),
                "competency_jobs_count": len(competency_jobs),
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
                "secondary_tendency_style": {
                    "name": self._safe_get_value(style_info, "tnd2_name", ""),
                    "study_tendency_description": self._safe_get_value(style_info, "tnd2_study_tendency", ""),
                    "study_way_description": self._safe_get_value(style_info, "tnd2_study_way", "")
                },
                "style_chart_data": style_chart_data,
                "method_chart_data": method_chart_data,
                "chart_coordinates": {
                    "row": self._safe_get_value(style_info, "tnd_row"),
                    "col": self._safe_get_value(style_info, "tnd_col")
                }
            }
            
            summary_text = (
                f"사용자의 주요 학습 성향은 '{content['primary_tendency_style']['name']}'이며, 보조 학습 성향은 '{content['secondary_tendency_style']['name']}'입니다. "
                f"주요 공부 성향에 대해 설명하자면, {content['primary_tendency_style']['study_tendency_description']} "
                f"이를 바탕으로 추천하는 공부 방법은 {content['primary_tendency_style']['study_way_description']}"
            )

            metadata = {
                "document_version": "1.2", "created_at": datetime.now().isoformat(),
                "data_sources": ["learningStyleQuery", "learningStyleChartQuery"],
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
        """Placeholder for preference analysis document"""
        raise DocumentTransformationError(DocumentType.PREFERENCE_ANALYSIS, "Transformation not yet implemented.")
    
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