'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  MainLayout,
  Container,
  ResponsiveGrid,
  Navigation,
  NavigationItem,
  LoadingSpinner,
  ErrorBoundary,
} from '@/components/common';
import { toast } from 'sonner';
import { useState } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');

  const showToast = () => {
    toast.success('Toast notification works!', {
      description: 'This is a test of the toast system.',
    });
  };

  return (
    <ErrorBoundary>
      <MainLayout
        header={
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">Aptitude Chatbot</h1>
            <Navigation>
              <NavigationItem
                active={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </NavigationItem>
              <NavigationItem
                active={activeTab === 'components'}
                onClick={() => setActiveTab('components')}
              >
                Components
              </NavigationItem>
              <NavigationItem
                active={activeTab === 'layouts'}
                onClick={() => setActiveTab('layouts')}
              >
                Layouts
              </NavigationItem>
            </Navigation>
          </div>
        }
      >
        <Container className="py-8">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold">UI Components Demo</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  This page demonstrates the basic UI components and layout
                  system implemented for the Aptitude Chatbot frontend.
                </p>
              </div>

              <ResponsiveGrid cols={{ default: 1, md: 2, lg: 3 }} gap="lg">
                <Card>
                  <CardHeader>
                    <CardTitle>Theme System</CardTitle>
                    <CardDescription>
                      Dark/light theme toggle with system preference support
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Use the theme toggle in the header to switch between light
                      and dark modes.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Responsive Design</CardTitle>
                    <CardDescription>
                      Mobile-first responsive layout components
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Resize your browser to see the responsive grid in action.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Accessibility</CardTitle>
                    <CardDescription>
                      ARIA labels and keyboard navigation support
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      All components include proper ARIA labels and focus
                      management.
                    </p>
                  </CardContent>
                </Card>
              </ResponsiveGrid>
            </div>
          )}

          {activeTab === 'components' && (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold">Component Showcase</h2>

              <ResponsiveGrid cols={{ default: 1, lg: 2 }} gap="lg">
                <Card>
                  <CardHeader>
                    <CardTitle>Buttons</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button>Default</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="outline">Outline</Button>
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="destructive">Destructive</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm">Small</Button>
                      <Button size="default">Default</Button>
                      <Button size="lg">Large</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Form Elements</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input placeholder="Enter your email" />
                    <Input type="password" placeholder="Enter your password" />
                    <Input disabled placeholder="Disabled input" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dialog</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>Open Dialog</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Dialog Title</DialogTitle>
                          <DialogDescription>
                            This is a sample dialog component with proper
                            accessibility features.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Input placeholder="Sample input in dialog" />
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline">Cancel</Button>
                            <Button>Save</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Toast Notifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={showToast}>Show Toast</Button>
                  </CardContent>
                </Card>
              </ResponsiveGrid>
            </div>
          )}

          {activeTab === 'layouts' && (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold">Layout Components</h2>

              <Card>
                <CardHeader>
                  <CardTitle>Loading States</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="font-medium">Loading Spinners</h4>
                    <div className="flex items-center space-x-4">
                      <LoadingSpinner size="sm" />
                      <LoadingSpinner size="md" />
                      <LoadingSpinner size="lg" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Loading with Text</h4>
                    <LoadingSpinner text="Loading data..." />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Responsive Grid</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveGrid
                    cols={{ default: 1, sm: 2, md: 3, lg: 4 }}
                    gap="md"
                  >
                    {Array.from({ length: 8 }, (_, i) => (
                      <div
                        key={i}
                        className="bg-muted rounded-lg p-4 text-center"
                      >
                        Item {i + 1}
                      </div>
                    ))}
                  </ResponsiveGrid>
                </CardContent>
              </Card>
            </div>
          )}
        </Container>
      </MainLayout>
    </ErrorBoundary>
  );
}
