// Example usage of the API client
import { apiClient, authApi, chatApi, testsApi } from './index';
import { LoginCredentials, ChatRequest, ETLJobRequest } from '../../types';

// Example: Authentication
export async function loginExample() {
  try {
    const credentials: LoginCredentials = {
      username: 'user@example.com',
      password: 'password123',
      loginType: 'personal',
    };

    const authResponse = await authApi.login(credentials);
    console.log('Login successful:', authResponse.user);

    // Tokens are automatically stored and managed by the client
    return authResponse;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

// Example: Sending a chat message
export async function sendChatMessageExample() {
  try {
    const chatRequest: ChatRequest = {
      message: 'Tell me about my aptitude test results',
      conversation_id: undefined, // Will create new conversation
    };

    const response = await chatApi.sendMessage(chatRequest);
    console.log('Chat response:', response);

    return response;
  } catch (error) {
    console.error('Chat failed:', error);
    throw error;
  }
}

// Example: Streaming chat
export async function streamChatExample() {
  try {
    const chatRequest: ChatRequest = {
      message: 'Explain my career recommendations in detail',
    };

    const stream = await chatApi.streamMessage(chatRequest);

    // Process streaming response
    for await (const chunk of chatApi.parseStreamingResponse(stream)) {
      console.log('Streaming chunk:', chunk);

      if (chunk.type === 'complete') {
        console.log('Streaming complete');
        break;
      }
    }
  } catch (error) {
    console.error('Streaming failed:', error);
    throw error;
  }
}

// Example: Getting test results
export async function getTestResultsExample() {
  try {
    const testResults = await testsApi.getTestResults();
    console.log('Test results:', testResults);

    return testResults;
  } catch (error) {
    console.error('Failed to get test results:', error);
    throw error;
  }
}

// Example: Starting ETL job
export async function startETLJobExample() {
  try {
    const etlRequest: ETLJobRequest = {
      userId: 'user123',
      anpSeq: 12345,
      forceReprocess: false,
    };

    const jobResponse = await testsApi.startETLJob(etlRequest);
    console.log('ETL job started:', jobResponse);

    // Monitor job progress
    for await (const jobStatus of testsApi.monitorETLJob(jobResponse.jobId)) {
      console.log('Job progress:', jobStatus);

      if (['completed', 'failed', 'cancelled'].includes(jobStatus.status)) {
        break;
      }
    }

    return jobResponse;
  } catch (error) {
    console.error('ETL job failed:', error);
    throw error;
  }
}

// Example: Error handling
export async function errorHandlingExample() {
  try {
    // This will likely fail
    await apiClient.get('/nonexistent-endpoint');
  } catch (error) {
    // The error will be properly typed and handled
    if (error && typeof error === 'object' && 'isNetworkError' in error) {
      console.log('Network error occurred');
    } else if (error && typeof error === 'object' && 'isAuthError' in error) {
      console.log('Authentication error occurred');
    } else {
      console.log('Other error occurred:', error);
    }
  }
}
