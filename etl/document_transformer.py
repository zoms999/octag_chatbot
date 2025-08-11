"""
Document Transformation Engine
Converts query results into thematic documents for RAG system
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime
import json

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
        """Safely get item from list with default fallback"""
        if default is None:
            default = {}
        
        if not data or len(data) <= index:
            return default
        
        return data[index] if data[index] is not None else default
    
    def _safe_get_value(self, data: Dict[str, Any], key: str, default: Any = None) -> Any:
        """Safely get value from dictionary with default fallback"""
        return data.get(key, default) if data else default
    
    def _create_personality_profile(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        """Create personality profile document from tendency queries"""
        
        try:
            # Extract data from relevant queries
            tendency_data = self._safe_get(query_results.get("tendencyQuery", []))
            top_tendencies = query_results.get("topTendencyQuery", [])
            personality_detail = query_results.get("personalityDetailQuery", [])
            strengths_weaknesses = query_results.get("strengthsWeaknessesQuery", [])
            
            # Build primary and secondary tendency information
            primary_tendency = {
                "name": self._safe_get_value(tendency_data, "Tnd1", "알 수 없음"),
                "code": self._safe_get_value(tendency_data, "Tnd1_code", ""),
                "explanation": self._safe_get_value(tendency_data, "Tnd1_explanation", ""),
                "rank": 1,
                "percentage_in_total": self._safe_get_value(tendency_data, "Tnd1_percentage", 0)
            }
            
            secondary_tendency = {
                "name": self._safe_get_value(tendency_data, "Tnd2", "알 수 없음"),
                "code": self._safe_get_value(tendency_data, "Tnd2_code", ""),
                "explanation": self._safe_get_value(tendency_data, "Tnd2_explanation", ""),
                "rank": 2,
                "percentage_in_total": self._safe_get_value(tendency_data, "Tnd2_percentage", 0)
            }
            
            # Process top tendencies (usually top 5-10)
            top_tendencies_detail = []
            for i, tendency in enumerate(top_tendencies[:10]):  # Limit to top 10
                top_tendencies_detail.append({
                    "rank": self._safe_get_value(tendency, "rank", i + 1),
                    "name": self._safe_get_value(tendency, "tendency_name", ""),
                    "code": self._safe_get_value(tendency, "code", ""),
                    "score": self._safe_get_value(tendency, "score", 0),
                    "percentage_in_total": self._safe_get_value(tendency, "percentage_in_total", 0),
                    "description": self._safe_get_value(tendency, "description", "")
                })
            
            # Process bottom tendencies (areas for development)
            bottom_tendencies = []
            if len(top_tendencies) > 10:
                for tendency in top_tendencies[-5:]:  # Last 5 as bottom tendencies
                    bottom_tendencies.append({
                        "rank": self._safe_get_value(tendency, "rank", 0),
                        "name": self._safe_get_value(tendency, "tendency_name", ""),
                        "score": self._safe_get_value(tendency, "score", 0),
                        "percentage_in_total": self._safe_get_value(tendency, "percentage_in_total", 0)
                    })
            
            # Build content structure
            content = {
                "primary_tendency": primary_tendency,
                "secondary_tendency": secondary_tendency,
                "top_tendencies": top_tendencies_detail,
                "bottom_tendencies": bottom_tendencies,
                "personality_details": personality_detail,
                "strengths_weaknesses": strengths_weaknesses,
                "analysis_summary": {
                    "dominant_traits": [primary_tendency["name"], secondary_tendency["name"]],
                    "total_tendencies_analyzed": len(top_tendencies),
                    "strongest_areas": [t["name"] for t in top_tendencies_detail[:3]],
                    "development_areas": [t["name"] for t in bottom_tendencies[:3]]
                }
            }
            
            # Create summary text for embedding and search
            summary_text = self._create_personality_summary_text(content)
            
            # Create metadata
            metadata = {
                "document_version": "1.0",
                "created_at": datetime.now().isoformat(),
                "data_sources": ["tendencyQuery", "topTendencyQuery", "personalityDetailQuery", "strengthsWeaknessesQuery"],
                "primary_tendency_code": primary_tendency["code"],
                "secondary_tendency_code": secondary_tendency["code"],
                "total_tendencies": len(top_tendencies_detail)
            }
            
            return TransformedDocument(
                doc_type=DocumentType.PERSONALITY_PROFILE,
                content=content,
                summary_text=summary_text,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Error creating personality profile document: {e}")
            raise DocumentTransformationError(DocumentType.PERSONALITY_PROFILE, str(e))
    
    def _create_personality_summary_text(self, content: Dict[str, Any]) -> str:
        """Create searchable summary text for personality profile"""
        
        primary = content["primary_tendency"]
        secondary = content["secondary_tendency"]
        top_traits = content.get("top_tendencies", [])
        
        summary_parts = [
            f"사용자의 주요 성향은 {primary['name']}이며, 부성향은 {secondary['name']}입니다.",
            f"{primary['name']} 성향은 {primary.get('explanation', '')[:100]}",
            f"상위 강점 성향으로는 {', '.join([t['name'] for t in top_traits[:5]])}이 있습니다."
        ]
        
        if content.get("analysis_summary", {}).get("development_areas"):
            development_areas = content["analysis_summary"]["development_areas"]
            summary_parts.append(f"개발이 필요한 영역으로는 {', '.join(development_areas)}이 있습니다.")
        
        return " ".join(summary_parts)
    
    def _create_thinking_skills_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        """Create thinking skills document from cognitive ability queries"""
        
        try:
            # Extract data from relevant queries
            thinking_skills = query_results.get("thinkingSkillsQuery", [])
            analytical_thinking = query_results.get("analyticalThinkingQuery", [])
            creative_thinking = query_results.get("creativityQuery", [])
            practical_thinking = query_results.get("practicalThinkingQuery", [])
            abstract_thinking = query_results.get("abstractThinkingQuery", [])
            problem_solving = query_results.get("problemSolvingQuery", [])
            memory_skills = query_results.get("memoryQuery", [])
            attention_skills = query_results.get("attentionQuery", [])
            processing_speed = query_results.get("processingSpeedQuery", [])
            
            # Process 8 core thinking skills
            core_skills = []
            skill_categories = {
                "analytical_thinking": analytical_thinking,
                "creative_thinking": creative_thinking,
                "practical_thinking": practical_thinking,
                "abstract_thinking": abstract_thinking,
                "problem_solving": problem_solving,
                "memory": memory_skills,
                "attention": attention_skills,
                "processing_speed": processing_speed
            }
            
            for skill_name, skill_data in skill_categories.items():
                if skill_data:
                    skill_info = self._safe_get(skill_data)
                    core_skills.append({
                        "skill_name": skill_name.replace("_", " ").title(),
                        "korean_name": self._get_korean_skill_name(skill_name),
                        "score": self._safe_get_value(skill_info, "score", 0),
                        "percentile": self._safe_get_value(skill_info, "percentile", 0),
                        "level": self._get_skill_level(self._safe_get_value(skill_info, "percentile", 0)),
                        "description": self._safe_get_value(skill_info, "description", ""),
                        "strengths": self._safe_get_value(skill_info, "strengths", []),
                        "improvement_areas": self._safe_get_value(skill_info, "improvement_areas", [])
                    })
            
            # Sort skills by percentile (highest first)
            core_skills.sort(key=lambda x: x["percentile"], reverse=True)
            
            # Identify top and bottom skills
            top_skills = core_skills[:3]
            bottom_skills = core_skills[-3:]
            
            # Calculate overall thinking ability
            avg_percentile = sum(skill["percentile"] for skill in core_skills) / len(core_skills) if core_skills else 0
            
            # Build content structure
            content = {
                "core_thinking_skills": core_skills,
                "top_skills": top_skills,
                "bottom_skills": bottom_skills,
                "overall_analysis": {
                    "average_percentile": round(avg_percentile, 1),
                    "overall_level": self._get_skill_level(avg_percentile),
                    "cognitive_profile": self._determine_cognitive_profile(core_skills),
                    "learning_recommendations": self._generate_learning_recommendations(core_skills)
                },
                "detailed_breakdown": {
                    "verbal_abilities": self._extract_verbal_abilities(query_results),
                    "numerical_abilities": self._extract_numerical_abilities(query_results),
                    "spatial_abilities": self._extract_spatial_abilities(query_results),
                    "reasoning_abilities": self._extract_reasoning_abilities(query_results)
                }
            }
            
            # Create summary text
            summary_text = self._create_thinking_skills_summary_text(content)
            
            # Create metadata
            metadata = {
                "document_version": "1.0",
                "created_at": datetime.now().isoformat(),
                "data_sources": list(skill_categories.keys()),
                "skills_analyzed": len(core_skills),
                "average_percentile": avg_percentile,
                "cognitive_profile": content["overall_analysis"]["cognitive_profile"]
            }
            
            return TransformedDocument(
                doc_type=DocumentType.THINKING_SKILLS,
                content=content,
                summary_text=summary_text,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Error creating thinking skills document: {e}")
            raise DocumentTransformationError(DocumentType.THINKING_SKILLS, str(e))
    
    def _get_korean_skill_name(self, skill_name: str) -> str:
        """Get Korean name for thinking skill"""
        korean_names = {
            "analytical_thinking": "분석적 사고",
            "creative_thinking": "창의적 사고", 
            "practical_thinking": "실용적 사고",
            "abstract_thinking": "추상적 사고",
            "problem_solving": "문제해결능력",
            "memory": "기억력",
            "attention": "주의집중력",
            "processing_speed": "처리속도"
        }
        return korean_names.get(skill_name, skill_name)
    
    def _get_skill_level(self, percentile: float) -> str:
        """Determine skill level based on percentile"""
        if percentile >= 90:
            return "매우 우수"
        elif percentile >= 75:
            return "우수"
        elif percentile >= 50:
            return "보통"
        elif percentile >= 25:
            return "개선 필요"
        else:
            return "많은 개선 필요"
    
    def _determine_cognitive_profile(self, skills: List[Dict[str, Any]]) -> str:
        """Determine overall cognitive profile"""
        if not skills:
            return "분석 불가"
        
        # Find dominant skill type
        skill_scores = {skill["skill_name"]: skill["percentile"] for skill in skills}
        
        if skill_scores.get("Creative Thinking", 0) > 75:
            return "창의형 사고자"
        elif skill_scores.get("Analytical Thinking", 0) > 75:
            return "분석형 사고자"
        elif skill_scores.get("Practical Thinking", 0) > 75:
            return "실용형 사고자"
        else:
            return "균형형 사고자"
    
    def _generate_learning_recommendations(self, skills: List[Dict[str, Any]]) -> List[str]:
        """Generate learning recommendations based on skill profile"""
        recommendations = []
        
        # Find weakest skills for improvement recommendations
        weak_skills = [skill for skill in skills if skill["percentile"] < 50]
        
        for skill in weak_skills[:3]:  # Top 3 areas for improvement
            skill_name = skill["korean_name"]
            if "분석" in skill_name:
                recommendations.append("논리적 사고 훈련과 체계적 분석 연습을 권장합니다.")
            elif "창의" in skill_name:
                recommendations.append("브레인스토밍과 발산적 사고 활동을 권장합니다.")
            elif "기억" in skill_name:
                recommendations.append("기억술 학습과 반복 학습 전략을 권장합니다.")
            elif "주의" in skill_name:
                recommendations.append("집중력 향상 훈련과 명상 연습을 권장합니다.")
        
        return recommendations[:5]  # Limit to 5 recommendations
    
    def _extract_verbal_abilities(self, query_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Extract verbal ability information"""
        verbal_data = query_results.get("verbalAbilityQuery", [])
        if verbal_data:
            data = self._safe_get(verbal_data)
            return {
                "score": self._safe_get_value(data, "score", 0),
                "percentile": self._safe_get_value(data, "percentile", 0),
                "level": self._get_skill_level(self._safe_get_value(data, "percentile", 0))
            }
        return {"score": 0, "percentile": 0, "level": "데이터 없음"}
    
    def _extract_numerical_abilities(self, query_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Extract numerical ability information"""
        numerical_data = query_results.get("numericalAbilityQuery", [])
        if numerical_data:
            data = self._safe_get(numerical_data)
            return {
                "score": self._safe_get_value(data, "score", 0),
                "percentile": self._safe_get_value(data, "percentile", 0),
                "level": self._get_skill_level(self._safe_get_value(data, "percentile", 0))
            }
        return {"score": 0, "percentile": 0, "level": "데이터 없음"}
    
    def _extract_spatial_abilities(self, query_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Extract spatial ability information"""
        spatial_data = query_results.get("spatialAbilityQuery", [])
        if spatial_data:
            data = self._safe_get(spatial_data)
            return {
                "score": self._safe_get_value(data, "score", 0),
                "percentile": self._safe_get_value(data, "percentile", 0),
                "level": self._get_skill_level(self._safe_get_value(data, "percentile", 0))
            }
        return {"score": 0, "percentile": 0, "level": "데이터 없음"}
    
    def _extract_reasoning_abilities(self, query_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Extract reasoning ability information"""
        reasoning_data = query_results.get("reasoningQuery", [])
        if reasoning_data:
            data = self._safe_get(reasoning_data)
            return {
                "score": self._safe_get_value(data, "score", 0),
                "percentile": self._safe_get_value(data, "percentile", 0),
                "level": self._get_skill_level(self._safe_get_value(data, "percentile", 0))
            }
        return {"score": 0, "percentile": 0, "level": "데이터 없음"}
    
    def _create_thinking_skills_summary_text(self, content: Dict[str, Any]) -> str:
        """Create searchable summary text for thinking skills"""
        
        top_skills = content.get("top_skills", [])
        overall = content.get("overall_analysis", {})
        
        summary_parts = [
            f"사용자의 전체적인 사고능력은 {overall.get('overall_level', '보통')} 수준입니다.",
            f"평균 백분위는 {overall.get('average_percentile', 0)}%이며, {overall.get('cognitive_profile', '균형형 사고자')}의 특성을 보입니다."
        ]
        
        if top_skills:
            top_skill_names = [skill["korean_name"] for skill in top_skills]
            summary_parts.append(f"특히 {', '.join(top_skill_names)}에서 강점을 보입니다.")
        
        recommendations = overall.get("learning_recommendations", [])
        if recommendations:
            summary_parts.append(f"학습 개선 방향: {' '.join(recommendations[:2])}")
        
        return " ".join(summary_parts)
    
    def _create_career_recommendations_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        """Create career recommendations document from job matching queries"""
        
        try:
            # Extract data from relevant queries
            career_recommendations = query_results.get("careerRecommendationQuery", [])
            job_matching = query_results.get("jobMatchingQuery", [])
            major_recommendations = query_results.get("majorRecommendationQuery", [])
            work_style = query_results.get("workStyleQuery", [])
            environment_preference = query_results.get("environmentPreferenceQuery", [])
            
            # Process career recommendations
            recommended_careers = []
            for career in career_recommendations[:10]:  # Top 10 recommendations
                recommended_careers.append({
                    "job_code": self._safe_get_value(career, "job_code", ""),
                    "job_name": self._safe_get_value(career, "job_name", ""),
                    "match_score": self._safe_get_value(career, "match_score", 0),
                    "match_percentage": self._safe_get_value(career, "match_percentage", 0),
                    "job_outline": self._safe_get_value(career, "job_outline", ""),
                    "main_business": self._safe_get_value(career, "main_business", ""),
                    "required_skills": self._safe_get_value(career, "required_skills", []),
                    "education_level": self._safe_get_value(career, "education_level", ""),
                    "salary_range": self._safe_get_value(career, "salary_range", ""),
                    "job_prospects": self._safe_get_value(career, "job_prospects", ""),
                    "match_reasons": self._safe_get_value(career, "match_reasons", [])
                })
            
            # Process major recommendations
            recommended_majors = []
            for major in major_recommendations[:8]:  # Top 8 majors
                recommended_majors.append({
                    "major_code": self._safe_get_value(major, "major_code", ""),
                    "major_name": self._safe_get_value(major, "major_name", ""),
                    "match_score": self._safe_get_value(major, "match_score", 0),
                    "description": self._safe_get_value(major, "description", ""),
                    "career_paths": self._safe_get_value(major, "career_paths", []),
                    "required_subjects": self._safe_get_value(major, "required_subjects", []),
                    "difficulty_level": self._safe_get_value(major, "difficulty_level", ""),
                    "employment_rate": self._safe_get_value(major, "employment_rate", 0)
                })
            
            # Analyze work style preferences
            work_style_analysis = self._analyze_work_style(work_style, environment_preference)
            
            # Build content structure
            content = {
                "recommended_careers": recommended_careers,
                "recommended_majors": recommended_majors,
                "work_style_analysis": work_style_analysis,
                "career_summary": {
                    "top_career_fields": self._identify_top_career_fields(recommended_careers),
                    "best_match_career": recommended_careers[0] if recommended_careers else None,
                    "best_match_major": recommended_majors[0] if recommended_majors else None,
                    "overall_career_direction": self._determine_career_direction(recommended_careers),
                    "key_strengths_for_career": self._extract_career_strengths(query_results),
                    "development_areas_for_career": self._extract_career_development_areas(query_results)
                },
                "detailed_analysis": {
                    "personality_career_fit": self._analyze_personality_career_fit(query_results),
                    "skills_career_alignment": self._analyze_skills_career_alignment(query_results),
                    "interest_career_match": self._analyze_interest_career_match(query_results),
                    "value_career_compatibility": self._analyze_value_career_compatibility(query_results)
                }
            }
            
            # Create summary text
            summary_text = self._create_career_summary_text(content)
            
            # Create metadata
            metadata = {
                "document_version": "1.0",
                "created_at": datetime.now().isoformat(),
                "data_sources": ["careerRecommendationQuery", "jobMatchingQuery", "majorRecommendationQuery", "workStyleQuery"],
                "careers_analyzed": len(recommended_careers),
                "majors_analyzed": len(recommended_majors),
                "top_career_field": content["career_summary"]["top_career_fields"][0] if content["career_summary"]["top_career_fields"] else None
            }
            
            return TransformedDocument(
                doc_type=DocumentType.CAREER_RECOMMENDATIONS,
                content=content,
                summary_text=summary_text,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Error creating career recommendations document: {e}")
            raise DocumentTransformationError(DocumentType.CAREER_RECOMMENDATIONS, str(e))  
  
    def _analyze_work_style(self, work_style: List[Dict[str, Any]], environment_preference: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze work style preferences"""
        work_style_data = self._safe_get(work_style)
        env_data = self._safe_get(environment_preference)
        
        return {
            "preferred_work_environment": self._safe_get_value(env_data, "preferred_environment", ""),
            "team_vs_individual": self._safe_get_value(work_style_data, "team_preference", ""),
            "structure_vs_flexibility": self._safe_get_value(work_style_data, "structure_preference", ""),
            "leadership_style": self._safe_get_value(work_style_data, "leadership_style", ""),
            "communication_style": self._safe_get_value(work_style_data, "communication_style", ""),
            "work_pace": self._safe_get_value(work_style_data, "work_pace", ""),
            "stress_tolerance": self._safe_get_value(work_style_data, "stress_tolerance", "")
        }
    
    def _identify_top_career_fields(self, careers: List[Dict[str, Any]]) -> List[str]:
        """Identify top career fields from recommendations"""
        if not careers:
            return []
        
        # Extract job categories/fields (this would need to be mapped from job codes)
        fields = []
        for career in careers[:5]:  # Top 5 careers
            job_name = career.get("job_name", "")
            # Simple field extraction based on job name keywords
            if any(keyword in job_name for keyword in ["개발", "프로그래머", "소프트웨어"]):
                fields.append("IT/소프트웨어")
            elif any(keyword in job_name for keyword in ["분석", "데이터", "연구"]):
                fields.append("데이터/연구")
            elif any(keyword in job_name for keyword in ["디자인", "창작", "예술"]):
                fields.append("디자인/창작")
            elif any(keyword in job_name for keyword in ["경영", "관리", "기획"]):
                fields.append("경영/기획")
            elif any(keyword in job_name for keyword in ["교육", "강사", "선생"]):
                fields.append("교육")
        
        # Return unique fields
        return list(set(fields))[:3]
    
    def _determine_career_direction(self, careers: List[Dict[str, Any]]) -> str:
        """Determine overall career direction"""
        if not careers:
            return "진로 방향 분석 불가"
        
        top_career = careers[0]
        match_score = top_career.get("match_score", 0)
        
        if match_score >= 90:
            return "매우 명확한 진로 방향성"
        elif match_score >= 75:
            return "명확한 진로 방향성"
        elif match_score >= 60:
            return "일반적인 진로 방향성"
        else:
            return "다양한 진로 탐색 필요"
    
    def _extract_career_strengths(self, query_results: Dict[str, List[Dict[str, Any]]]) -> List[str]:
        """Extract key strengths for career development"""
        strengths = []
        
        # This would extract from personality and skills data
        personality_data = query_results.get("tendencyQuery", [])
        if personality_data:
            primary_tendency = self._safe_get_value(self._safe_get(personality_data), "Tnd1", "")
            if primary_tendency:
                strengths.append(f"{primary_tendency} 성향의 강점 활용")
        
        return strengths[:5]
    
    def _extract_career_development_areas(self, query_results: Dict[str, List[Dict[str, Any]]]) -> List[str]:
        """Extract areas for career development"""
        development_areas = []
        
        # This would be based on skills analysis and career requirements
        development_areas.append("지속적인 전문성 개발")
        development_areas.append("네트워킹 및 인맥 구축")
        development_areas.append("리더십 역량 강화")
        
        return development_areas[:5]
    
    def _analyze_personality_career_fit(self, query_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Analyze how personality fits with career recommendations"""
        return {
            "fit_score": 85,  # This would be calculated based on actual data
            "fit_explanation": "성향과 추천 직업 간의 높은 일치도를 보입니다.",
            "key_personality_advantages": ["창의적 사고", "분석적 접근"],
            "potential_challenges": ["세부사항 관리", "루틴 업무 적응"]
        }
    
    def _analyze_skills_career_alignment(self, query_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Analyze how skills align with career requirements"""
        return {
            "alignment_score": 78,
            "strong_skill_matches": ["문제해결능력", "논리적 사고"],
            "skill_gaps": ["의사소통", "프레젠테이션"],
            "development_recommendations": ["소프트 스킬 개발", "전문 기술 심화"]
        }
    
    def _analyze_interest_career_match(self, query_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Analyze how interests match with career recommendations"""
        return {
            "interest_match_score": 82,
            "aligned_interests": ["기술", "혁신", "문제해결"],
            "potential_interest_conflicts": ["반복적 업무", "단순 작업"],
            "interest_development_suggestions": ["새로운 기술 학습", "창의적 프로젝트 참여"]
        }
    
    def _analyze_value_career_compatibility(self, query_results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Analyze how values align with career paths"""
        return {
            "value_compatibility_score": 80,
            "aligned_values": ["성취", "자율성", "전문성"],
            "potential_value_conflicts": ["안정성 vs 도전", "개인 vs 팀"],
            "value_integration_strategies": ["균형잡힌 커리어 설계", "가치 우선순위 명확화"]
        }
    
    def _create_career_summary_text(self, content: Dict[str, Any]) -> str:
        """Create searchable summary text for career recommendations"""
        
        careers = content.get("recommended_careers", [])
        majors = content.get("recommended_majors", [])
        summary_data = content.get("career_summary", {})
        
        summary_parts = []
        
        if careers:
            top_career = careers[0]
            summary_parts.append(f"가장 적합한 직업은 {top_career.get('job_name', '')}이며, 적합도는 {top_career.get('match_score', 0)}점입니다.")
        
        if majors:
            top_major = majors[0]
            summary_parts.append(f"추천 전공은 {top_major.get('major_name', '')}입니다.")
        
        top_fields = summary_data.get("top_career_fields", [])
        if top_fields:
            summary_parts.append(f"주요 진로 분야는 {', '.join(top_fields)}입니다.")
        
        career_direction = summary_data.get("overall_career_direction", "")
        if career_direction:
            summary_parts.append(f"전체적인 진로 방향성은 {career_direction}을 보입니다.")
        
        return " ".join(summary_parts)
    
    def _create_learning_style_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        """Create learning style document from study method and preference queries"""
        
        try:
            # Extract data from relevant queries
            learning_style = query_results.get("learningStyleQuery", [])
            study_method = query_results.get("studyMethodQuery", [])
            
            learning_data = self._safe_get(learning_style)
            study_data = self._safe_get(study_method)
            
            # Build content structure
            content = {
                "preferred_learning_style": self._safe_get_value(learning_data, "learning_style", ""),
                "study_methods": {
                    "most_effective": self._safe_get_value(study_data, "most_effective_method", ""),
                    "least_effective": self._safe_get_value(study_data, "least_effective_method", ""),
                    "recommended_techniques": self._safe_get_value(study_data, "recommended_techniques", []),
                    "study_environment": self._safe_get_value(study_data, "preferred_environment", "")
                },
                "academic_recommendations": {
                    "subject_preferences": self._safe_get_value(learning_data, "subject_preferences", []),
                    "learning_pace": self._safe_get_value(learning_data, "learning_pace", ""),
                    "group_vs_individual": self._safe_get_value(learning_data, "group_preference", ""),
                    "theoretical_vs_practical": self._safe_get_value(learning_data, "approach_preference", "")
                }
            }
            
            # Create summary text
            summary_text = f"선호하는 학습 스타일은 {content['preferred_learning_style']}이며, " \
                          f"가장 효과적인 학습 방법은 {content['study_methods']['most_effective']}입니다."
            
            # Create metadata
            metadata = {
                "document_version": "1.0",
                "created_at": datetime.now().isoformat(),
                "data_sources": ["learningStyleQuery", "studyMethodQuery"],
                "learning_style": content["preferred_learning_style"]
            }
            
            return TransformedDocument(
                doc_type=DocumentType.LEARNING_STYLE,
                content=content,
                summary_text=summary_text,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Error creating learning style document: {e}")
            raise DocumentTransformationError(DocumentType.LEARNING_STYLE, str(e))
    
    def _create_competency_analysis_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        """Create competency analysis document from various competency queries"""
        
        try:
            # Extract data from relevant queries
            competency_analysis = query_results.get("competencyAnalysisQuery", [])
            social_skills = query_results.get("socialSkillsQuery", [])
            leadership = query_results.get("leadershipQuery", [])
            communication = query_results.get("communicationQuery", [])
            teamwork = query_results.get("teamworkQuery", [])
            
            # Process top 5 competencies
            top_competencies = []
            for comp in competency_analysis[:5]:
                top_competencies.append({
                    "competency_name": self._safe_get_value(comp, "competency_name", ""),
                    "score": self._safe_get_value(comp, "score", 0),
                    "percentile": self._safe_get_value(comp, "percentile", 0),
                    "level": self._get_skill_level(self._safe_get_value(comp, "percentile", 0)),
                    "description": self._safe_get_value(comp, "description", ""),
                    "development_suggestions": self._safe_get_value(comp, "development_suggestions", [])
                })
            
            # Build content structure
            content = {
                "top_competencies": top_competencies,
                "social_competencies": {
                    "social_skills": self._process_competency_data(social_skills),
                    "leadership": self._process_competency_data(leadership),
                    "communication": self._process_competency_data(communication),
                    "teamwork": self._process_competency_data(teamwork)
                },
                "competency_summary": {
                    "strongest_competency": top_competencies[0] if top_competencies else None,
                    "average_competency_level": self._calculate_average_competency(top_competencies),
                    "development_priorities": self._identify_development_priorities(top_competencies),
                    "leadership_potential": self._assess_leadership_potential(leadership)
                }
            }
            
            # Create summary text
            summary_text = self._create_competency_summary_text(content)
            
            # Create metadata
            metadata = {
                "document_version": "1.0",
                "created_at": datetime.now().isoformat(),
                "data_sources": ["competencyAnalysisQuery", "socialSkillsQuery", "leadershipQuery", "communicationQuery"],
                "competencies_analyzed": len(top_competencies)
            }
            
            return TransformedDocument(
                doc_type=DocumentType.COMPETENCY_ANALYSIS,
                content=content,
                summary_text=summary_text,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Error creating competency analysis document: {e}")
            raise DocumentTransformationError(DocumentType.COMPETENCY_ANALYSIS, str(e))
    
    def _process_competency_data(self, competency_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process individual competency data"""
        if not competency_data:
            return {"score": 0, "percentile": 0, "level": "데이터 없음"}
        
        data = self._safe_get(competency_data)
        return {
            "score": self._safe_get_value(data, "score", 0),
            "percentile": self._safe_get_value(data, "percentile", 0),
            "level": self._get_skill_level(self._safe_get_value(data, "percentile", 0)),
            "strengths": self._safe_get_value(data, "strengths", []),
            "development_areas": self._safe_get_value(data, "development_areas", [])
        }
    
    def _calculate_average_competency(self, competencies: List[Dict[str, Any]]) -> float:
        """Calculate average competency percentile"""
        if not competencies:
            return 0.0
        
        total = sum(comp.get("percentile", 0) for comp in competencies)
        return round(total / len(competencies), 1)
    
    def _identify_development_priorities(self, competencies: List[Dict[str, Any]]) -> List[str]:
        """Identify top development priorities"""
        if not competencies:
            return []
        
        # Find competencies with lowest percentiles
        sorted_comps = sorted(competencies, key=lambda x: x.get("percentile", 0))
        return [comp.get("competency_name", "") for comp in sorted_comps[:3]]
    
    def _assess_leadership_potential(self, leadership_data: List[Dict[str, Any]]) -> str:
        """Assess leadership potential"""
        if not leadership_data:
            return "평가 불가"
        
        leadership_score = self._safe_get_value(self._safe_get(leadership_data), "percentile", 0)
        
        if leadership_score >= 80:
            return "높은 리더십 잠재력"
        elif leadership_score >= 60:
            return "보통 리더십 잠재력"
        else:
            return "리더십 개발 필요"
    
    def _create_competency_summary_text(self, content: Dict[str, Any]) -> str:
        """Create searchable summary text for competency analysis"""
        
        top_comps = content.get("top_competencies", [])
        summary_data = content.get("competency_summary", {})
        
        summary_parts = []
        
        if top_comps:
            strongest = top_comps[0]
            summary_parts.append(f"가장 강한 역량은 {strongest.get('competency_name', '')}이며, {strongest.get('percentile', 0)}%의 수준입니다.")
        
        avg_level = summary_data.get("average_competency_level", 0)
        summary_parts.append(f"전체 역량의 평균 수준은 {avg_level}%입니다.")
        
        leadership_potential = summary_data.get("leadership_potential", "")
        if leadership_potential:
            summary_parts.append(f"리더십 잠재력은 {leadership_potential}을 보입니다.")
        
        return " ".join(summary_parts)
    
    def _create_preference_analysis_document(self, query_results: Dict[str, List[Dict[str, Any]]]) -> TransformedDocument:
        """Create preference analysis document from preference and value queries"""
        
        try:
            # Extract data from relevant queries
            preference_analysis = query_results.get("preferenceAnalysisQuery", [])
            motivation = query_results.get("motivationQuery", [])
            interest = query_results.get("interestQuery", [])
            value = query_results.get("valueQuery", [])
            
            # Build content structure
            content = {
                "image_preferences": self._process_image_preferences(preference_analysis),
                "motivation_factors": self._process_motivation_data(motivation),
                "interest_areas": self._process_interest_data(interest),
                "core_values": self._process_value_data(value),
                "preference_summary": {
                    "dominant_preferences": self._identify_dominant_preferences(preference_analysis),
                    "motivation_profile": self._create_motivation_profile(motivation),
                    "interest_profile": self._create_interest_profile(interest),
                    "value_system": self._create_value_system(value)
                }
            }
            
            # Create summary text
            summary_text = self._create_preference_summary_text(content)
            
            # Create metadata
            metadata = {
                "document_version": "1.0",
                "created_at": datetime.now().isoformat(),
                "data_sources": ["preferenceAnalysisQuery", "motivationQuery", "interestQuery", "valueQuery"]
            }
            
            return TransformedDocument(
                doc_type=DocumentType.PREFERENCE_ANALYSIS,
                content=content,
                summary_text=summary_text,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Error creating preference analysis document: {e}")
            raise DocumentTransformationError(DocumentType.PREFERENCE_ANALYSIS, str(e))
    
    def _process_image_preferences(self, preference_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process image preference test results"""
        if not preference_data:
            return {}
        
        return {
            "preferred_images": [self._safe_get_value(item, "image_type", "") for item in preference_data[:5]],
            "preference_patterns": self._safe_get_value(self._safe_get(preference_data), "patterns", []),
            "related_careers": self._safe_get_value(self._safe_get(preference_data), "related_careers", [])
        }
    
    def _process_motivation_data(self, motivation_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process motivation factors"""
        return [
            {
                "factor": self._safe_get_value(item, "motivation_factor", ""),
                "strength": self._safe_get_value(item, "strength", 0),
                "description": self._safe_get_value(item, "description", "")
            }
            for item in motivation_data[:5]
        ]
    
    def _process_interest_data(self, interest_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process interest areas"""
        return [
            {
                "interest_area": self._safe_get_value(item, "interest_area", ""),
                "level": self._safe_get_value(item, "interest_level", 0),
                "related_activities": self._safe_get_value(item, "related_activities", [])
            }
            for item in interest_data[:8]
        ]
    
    def _process_value_data(self, value_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process core values"""
        return [
            {
                "value": self._safe_get_value(item, "value_name", ""),
                "importance": self._safe_get_value(item, "importance_score", 0),
                "description": self._safe_get_value(item, "description", "")
            }
            for item in value_data[:6]
        ]
    
    def _identify_dominant_preferences(self, preference_data: List[Dict[str, Any]]) -> List[str]:
        """Identify dominant preference patterns"""
        if not preference_data:
            return []
        
        return [self._safe_get_value(item, "preference_type", "") for item in preference_data[:3]]
    
    def _create_motivation_profile(self, motivation_data: List[Dict[str, Any]]) -> str:
        """Create motivation profile summary"""
        if not motivation_data:
            return "동기 프로필 분석 불가"
        
        top_motivation = self._safe_get(motivation_data)
        return f"{self._safe_get_value(top_motivation, 'motivation_factor', '')} 중심의 동기 구조"
    
    def _create_interest_profile(self, interest_data: List[Dict[str, Any]]) -> str:
        """Create interest profile summary"""
        if not interest_data:
            return "관심 프로필 분석 불가"
        
        top_interests = [self._safe_get_value(item, "interest_area", "") for item in interest_data[:3]]
        return f"{', '.join(top_interests)} 분야에 높은 관심"
    
    def _create_value_system(self, value_data: List[Dict[str, Any]]) -> str:
        """Create value system summary"""
        if not value_data:
            return "가치관 분석 불가"
        
        top_values = [self._safe_get_value(item, "value_name", "") for item in value_data[:3]]
        return f"{', '.join(top_values)}을 중시하는 가치관"
    
    def _create_preference_summary_text(self, content: Dict[str, Any]) -> str:
        """Create searchable summary text for preference analysis"""
        
        summary_data = content.get("preference_summary", {})
        
        summary_parts = [
            f"선호도 분석 결과 {summary_data.get('motivation_profile', '')}을 보입니다.",
            f"주요 관심 분야는 {summary_data.get('interest_profile', '')}입니다.",
            f"핵심 가치관은 {summary_data.get('value_system', '')}입니다."
        ]
        
        return " ".join(summary_parts)
    
    async def transform_all_documents(
        self, 
        query_results: Dict[str, List[Dict[str, Any]]]
    ) -> List[TransformedDocument]:
        """
        Transform all query results into semantic documents
        
        Args:
            query_results: Dictionary of query results from LegacyQueryExecutor
            
        Returns:
            List of TransformedDocument objects
        """
        
        documents = []
        
        for doc_type, transform_method in self.transformation_methods.items():
            try:
                logger.info(f"Transforming document type: {doc_type}")
                document = transform_method(query_results)
                documents.append(document)
                logger.info(f"Successfully transformed {doc_type} document")
                
            except DocumentTransformationError as e:
                logger.error(f"Failed to transform {doc_type}: {e}")
                # Continue with other documents even if one fails
                continue
            except Exception as e:
                logger.error(f"Unexpected error transforming {doc_type}: {e}")
                continue
        
        logger.info(f"Successfully transformed {len(documents)} documents")
        return documents
    
    async def validate_document(self, document: TransformedDocument) -> bool:
        """
        Validate a transformed document
        
        Args:
            document: TransformedDocument to validate
            
        Returns:
            True if document is valid, False otherwise
        """
        
        try:
            # Check required fields
            if not document.doc_type or not document.content or not document.summary_text:
                logger.warning(f"Document {document.doc_type} missing required fields")
                return False
            
            # Check document type is valid
            if not DocumentType.is_valid(document.doc_type):
                logger.warning(f"Invalid document type: {document.doc_type}")
                return False
            
            # Check content is valid JSON-serializable
            json.dumps(document.content)
            
            # Check summary text length
            if len(document.summary_text) < 10:
                logger.warning(f"Document {document.doc_type} summary text too short")
                return False
            
            logger.debug(f"Document {document.doc_type} validation passed")
            return True
            
        except Exception as e:
            logger.error(f"Document validation error for {document.doc_type}: {e}")
            return False   

    async def transform_all_documents(
        self, 
        query_results: Dict[str, List[Dict[str, Any]]]
    ) -> List[TransformedDocument]:
        """
        Transform all query results into documents
        
        Args:
            query_results: Dictionary mapping query names to their results
            
        Returns:
            List of TransformedDocument objects
        """
        
        documents = []
        
        for doc_type, transform_method in self.transformation_methods.items():
            try:
                document = transform_method(query_results)
                documents.append(document)
                logger.info(f"Successfully created {doc_type} document")
                
            except Exception as e:
                logger.error(f"Failed to create {doc_type} document: {e}")
                # Continue with other documents rather than failing completely
                continue
        
        logger.info(f"Document transformation completed. Created {len(documents)} documents.")
        return documents