import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../LoginForm';
import { useAuthStore } from '@/lib/stores/auth';

// Mock the auth store
jest.mock('@/lib/stores/auth');
const mockUseAuthStore = useAuthStore as jest.MockedFunction<
  typeof useAuthStore
>;

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('LoginForm', () => {
  const mockLogin = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
      user: null,
      tokens: null,
      isAuthenticated: false,
      isRefreshing: false,
      refreshTimer: null,
      logout: jest.fn(),
      refreshToken: jest.fn(),
      checkAuth: jest.fn(),
      setTokens: jest.fn(),
      setUser: jest.fn(),
      startTokenRefreshTimer: jest.fn(),
      stopTokenRefreshTimer: jest.fn(),
      scheduleTokenRefresh: jest.fn(),
    });
    jest.clearAllMocks();
  });

  it('renders login form with personal type selected by default', () => {
    render(<LoginForm />);

    expect(screen.getByText('로그인')).toBeInTheDocument();
    expect(screen.getByText('개인')).toBeInTheDocument();
    expect(screen.getByText('기관')).toBeInTheDocument();
    expect(screen.getByLabelText('사용자명')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
  });

  it('switches between personal and organization login types', () => {
    render(<LoginForm />);

    // Initially personal is selected
    expect(screen.getByLabelText('사용자명')).toBeInTheDocument();

    // Click organization button
    fireEvent.click(screen.getByText('기관'));

    // Should show organization fields
    expect(screen.getByLabelText('기관 코드')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<LoginForm />);

    // Try to submit without filling fields
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(screen.getByText('사용자명을 입력해주세요.')).toBeInTheDocument();
      expect(screen.getByText('비밀번호를 입력해주세요.')).toBeInTheDocument();
    });
  });

  it('validates minimum field lengths', async () => {
    render(<LoginForm />);

    const usernameInput = screen.getByLabelText('사용자명');
    const passwordInput = screen.getByLabelText('비밀번호');

    // Enter short values
    fireEvent.change(usernameInput, { target: { value: 'a' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.blur(usernameInput);
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(
        screen.getByText('사용자명은 2자 이상이어야 합니다.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('비밀번호는 4자 이상이어야 합니다.')
      ).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockOnSuccess = jest.fn();
    render(<LoginForm onSuccess={mockOnSuccess} />);

    const usernameInput = screen.getByLabelText('사용자명');
    const passwordInput = screen.getByLabelText('비밀번호');

    // Enter valid data
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
        loginType: 'personal',
      });
    });
  });

  it('displays loading state during login', () => {
    mockUseAuthStore.mockReturnValue({
      ...mockUseAuthStore(),
      isLoading: true,
    });

    render(<LoginForm />);

    expect(screen.getByText('로그인 중...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인 중...' })).toBeDisabled();
  });

  it('displays error message when login fails', () => {
    mockUseAuthStore.mockReturnValue({
      ...mockUseAuthStore(),
      error: '로그인에 실패했습니다.',
    });

    render(<LoginForm />);

    expect(screen.getByText('로그인에 실패했습니다.')).toBeInTheDocument();
  });

  it('clears errors when user starts typing', async () => {
    mockUseAuthStore.mockReturnValue({
      ...mockUseAuthStore(),
      error: '로그인에 실패했습니다.',
    });

    render(<LoginForm />);

    const usernameInput = screen.getByLabelText('사용자명');
    fireEvent.change(usernameInput, { target: { value: 'test' } });

    expect(mockClearError).toHaveBeenCalled();
  });
});
