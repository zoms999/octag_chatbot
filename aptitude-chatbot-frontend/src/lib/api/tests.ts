import { apiClient } from './client';
import {
  TestResult,
  ProcessingJob,
  ETLJobRequest,
  ETLJobResponse,
} from '../../types';

export class TestsApi {
  async getTestResults(): Promise<TestResult[]> {
    const response = await apiClient.get<TestResult[]>('/tests/results');
    return response.data;
  }

  async getTestResult(testId: string): Promise<TestResult> {
    const response = await apiClient.get<TestResult>(
      `/tests/results/${testId}`
    );
    return response.data;
  }

  async getUserTestResults(userId: string): Promise<TestResult[]> {
    const response = await apiClient.get<TestResult[]>(
      `/tests/results/user/${userId}`
    );
    return response.data;
  }

  async startETLJob(request: ETLJobRequest): Promise<ETLJobResponse> {
    const response = await apiClient.post<ETLJobResponse>(
      '/etl/start',
      request
    );
    return response.data;
  }

  async getETLJobStatus(jobId: string): Promise<ProcessingJob> {
    const response = await apiClient.get<ProcessingJob>(`/etl/status/${jobId}`);
    return response.data;
  }

  async cancelETLJob(jobId: string): Promise<void> {
    await apiClient.post(`/etl/cancel/${jobId}`);
  }

  async getActiveETLJobs(): Promise<ProcessingJob[]> {
    const response = await apiClient.get<ProcessingJob[]>('/etl/jobs/active');
    return response.data;
  }

  async reprocessTestData(
    userId: string,
    anpSeq: number
  ): Promise<ETLJobResponse> {
    return this.startETLJob({
      userId,
      anpSeq,
      forceReprocess: true,
    });
  }

  // Server-Sent Events for real-time job monitoring
  createETLJobEventSource(jobId: string): EventSource {
    const token = this.getAccessToken();
    const url = new URL(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/etl/events/${jobId}`
    );

    if (token) {
      url.searchParams.set('token', token);
    }

    return new EventSource(url.toString());
  }

  private getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  // Helper method to monitor ETL job progress
  async *monitorETLJob(jobId: string): AsyncGenerator<ProcessingJob> {
    const eventSource = this.createETLJobEventSource(jobId);

    try {
      while (true) {
        const event = await new Promise<MessageEvent>((resolve, reject) => {
          eventSource.onmessage = resolve;
          eventSource.onerror = reject;
        });

        const job: ProcessingJob = JSON.parse(event.data);
        yield job;

        // Stop monitoring if job is complete or failed
        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
          break;
        }
      }
    } finally {
      eventSource.close();
    }
  }
}

export const testsApi = new TestsApi();
