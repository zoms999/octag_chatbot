# Components Documentation

This directory contains all the reusable components for the Aptitude Chatbot frontend application.

## Structure

```
components/
├── ui/                 # shadcn/ui base components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   └── sonner.tsx
├── common/            # Common layout and utility components
│   ├── app-layout.tsx
│   ├── error-boundary.tsx
│   ├── error-fallback.tsx
│   ├── header.tsx
│   ├── loading-spinner.tsx
│   ├── main-layout.tsx
│   ├── navigation.tsx
│   ├── responsive-grid.tsx
│   ├── sidebar.tsx
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
├── auth/              # Authentication related components
├── chat/              # Chat interface components
├── tests/             # Test results components
└── __tests__/         # Component tests
```

## UI Components (shadcn/ui)

### Button

- Multiple variants: default, destructive, outline, secondary, ghost, link
- Multiple sizes: sm, default, lg, icon
- Full accessibility support with ARIA labels

### Card

- Flexible card component with header, content, footer sections
- Responsive design with proper spacing

### Dialog

- Modal dialog with overlay
- Keyboard navigation and focus management
- Customizable close button

### Input

- Form input with validation states
- Proper focus and error styling
- File input support

### Toast (Sonner)

- Toast notification system
- Theme-aware styling
- Multiple notification types

## Common Components

### Layout Components

#### AppLayout

- Root layout wrapper with min-height and background
- Container component with responsive max-widths

#### MainLayout

- Complete layout with header, sidebar, and main content
- Responsive sidebar with collapse functionality
- Flexible header and sidebar content

#### Header

- Sticky header with theme toggle
- Responsive container with proper spacing
- Backdrop blur effect

#### Sidebar

- Collapsible sidebar for navigation
- Hidden on mobile, visible on desktop
- Smooth animations

### Navigation Components

#### Navigation & NavigationItem

- Tab-style navigation
- Active state management
- Keyboard navigation support

#### ResponsiveGrid

- CSS Grid-based responsive layout
- Configurable breakpoints and gaps
- Mobile-first approach

### Utility Components

#### ThemeProvider & ThemeToggle

- Dark/light theme system using next-themes
- System preference detection
- Smooth theme transitions

#### LoadingSpinner

- Multiple sizes (sm, md, lg)
- Optional loading text
- Accessible loading states

#### ErrorBoundary & ErrorFallback

- React error boundary implementation
- Development error details
- User-friendly error messages
- Retry functionality

## Usage Examples

### Basic Layout

```tsx
import { MainLayout, Container } from '@/components/common';

export default function Page() {
  return (
    <MainLayout
      header={<h1>My App</h1>}
      showSidebar={true}
      sidebar={<nav>Navigation items</nav>}
    >
      <Container>
        <h2>Page Content</h2>
      </Container>
    </MainLayout>
  );
}
```

### Responsive Grid

```tsx
import { ResponsiveGrid } from '@/components/common';
import { Card } from '@/components/ui/card';

export function Dashboard() {
  return (
    <ResponsiveGrid cols={{ default: 1, md: 2, lg: 3 }} gap="lg">
      <Card>Item 1</Card>
      <Card>Item 2</Card>
      <Card>Item 3</Card>
    </ResponsiveGrid>
  );
}
```

### Theme Integration

```tsx
import { ThemeProvider } from '@/components/common';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

## Accessibility Features

All components include:

- Proper ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader compatibility
- Color contrast compliance
- Semantic HTML structure

## Responsive Design

Components use a mobile-first approach with these breakpoints:

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## Theme System

The theme system supports:

- Light and dark modes
- System preference detection
- CSS custom properties for colors
- Smooth transitions between themes
- Component-level theme awareness

## Testing

Components include comprehensive tests covering:

- Rendering behavior
- User interactions
- Accessibility features
- Theme switching
- Error states

Run tests with:

```bash
npm test
```
