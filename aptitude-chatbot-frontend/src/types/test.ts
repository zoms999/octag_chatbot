// Test related types
export type DocumentType =
  | 'aptitude_summary'
  | 'career_recommendation'
  | 'personality_analysis'
  | 'skill_assessment'
  | 'learning_path';

export interface TestDocument {
  id: string;
  type: DocumentType;
  summary: string;
  contentPreview: Record<string, any>;
  createdAt: string;
}

export interface TestResult {
  id: string;
  userId: string;
  anpSeq: number;
  status: 'completed' | 'processing' | 'failed';
  completedAt: string;
  documents: TestDocument[];
}

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ProcessingJob {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentStep: string;
  estimatedCompletion: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ETLJobRequest {
  userId: string;
  anpSeq: number;
  forceReprocess?: boolean;
}

export interface ETLJobResponse {
  jobId: string;
  status: JobStatus;
  message: string;
}
