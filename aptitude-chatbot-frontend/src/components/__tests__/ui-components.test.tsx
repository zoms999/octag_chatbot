import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { ThemeProvider } from '@/components/common/theme-provider';

// Mock next-themes
jest.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
  }),
}));

describe('UI Components', () => {
  const renderWithTheme = (component: React.ReactElement) => {
    return render(
      <ThemeProvider attribute="class" defaultTheme="system">
        {component}
      </ThemeProvider>
    );
  };

  test('Button renders correctly', () => {
    renderWithTheme(<Button>Test Button</Button>);
    expect(
      screen.getByRole('button', { name: 'Test Button' })
    ).toBeInTheDocument();
  });

  test('Card renders correctly', () => {
    renderWithTheme(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>Test content</CardContent>
      </Card>
    );
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  test('Input renders correctly', () => {
    renderWithTheme(<Input placeholder="Test input" />);
    expect(screen.getByPlaceholderText('Test input')).toBeInTheDocument();
  });

  test('LoadingSpinner renders correctly', () => {
    renderWithTheme(<LoadingSpinner text="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
