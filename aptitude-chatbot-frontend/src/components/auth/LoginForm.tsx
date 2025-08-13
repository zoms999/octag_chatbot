'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth';
import { LoginCredentials } from '@/types';
import { cn } from '@/lib/utils';
import { Loader2, User, Building2 } from 'lucide-react';

interface FormErrors {
  username?: string;
  password?: string;
  general?: string;
}

interface LoginFormProps {
  onSuccess?: () => void;
  className?: string;
}

export function LoginForm({ onSuccess, className }: LoginFormProps) {
  const { login, isLoading, error, clearError } = useAuthStore();

  const [formData, setFormData] = useState<LoginCredentials>({
    username: '',
    password: '',
    loginType: 'personal',
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Form validation
  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.username.trim()) {
      errors.username = '사용자명을 입력해주세요.';
    } else if (formData.username.length < 2) {
      errors.username = '사용자명은 2자 이상이어야 합니다.';
    }

    if (!formData.password.trim()) {
      errors.password = '비밀번호를 입력해주세요.';
    } else if (formData.password.length < 4) {
      errors.password = '비밀번호는 4자 이상이어야 합니다.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle input changes
  const handleInputChange = (field: keyof LoginCredentials, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear field error when user starts typing
    if (formErrors[field as keyof FormErrors]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }

    // Clear general error
    if (error) {
      clearError();
    }
  };

  // Handle input blur
  const handleInputBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Handle login type change
  const handleLoginTypeChange = (type: 'personal' | 'organization') => {
    setFormData((prev) => ({ ...prev, loginType: type }));
    clearError();
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({ username: true, password: true });

    if (!validateForm()) {
      return;
    }

    try {
      await login(formData);
      onSuccess?.();
    } catch (err) {
      // Error is handled by the auth store
      console.error('Login failed:', err);
    }
  };

  // Get field error message
  const getFieldError = (field: keyof FormErrors): string | undefined => {
    return touched[field] ? formErrors[field] : undefined;
  };

  return (
    <Card className={cn('w-full max-w-md mx-auto', className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">로그인</CardTitle>
        <CardDescription className="text-center">
          적성검사 챗봇 서비스에 로그인하세요
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Login Type Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">로그인 유형</label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={
                formData.loginType === 'personal' ? 'default' : 'outline'
              }
              className={cn(
                'flex items-center gap-2 h-12',
                formData.loginType === 'personal' &&
                  'bg-primary text-primary-foreground'
              )}
              onClick={() => handleLoginTypeChange('personal')}
              disabled={isLoading}
            >
              <User className="w-4 h-4" />
              개인
            </Button>
            <Button
              type="button"
              variant={
                formData.loginType === 'organization' ? 'default' : 'outline'
              }
              className={cn(
                'flex items-center gap-2 h-12',
                formData.loginType === 'organization' &&
                  'bg-primary text-primary-foreground'
              )}
              onClick={() => handleLoginTypeChange('organization')}
              disabled={isLoading}
            >
              <Building2 className="w-4 h-4" />
              기관
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Field */}
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              {formData.loginType === 'personal' ? '사용자명' : '기관 코드'}
            </label>
            <Input
              id="username"
              type="text"
              placeholder={
                formData.loginType === 'personal'
                  ? '사용자명을 입력하세요'
                  : '기관 코드를 입력하세요'
              }
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              onBlur={() => handleInputBlur('username')}
              className={cn(
                getFieldError('username') &&
                  'border-red-500 focus-visible:ring-red-500'
              )}
              disabled={isLoading}
              autoComplete="username"
            />
            {getFieldError('username') && (
              <p className="text-sm text-red-500">
                {getFieldError('username')}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              비밀번호
            </label>
            <Input
              id="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              onBlur={() => handleInputBlur('password')}
              className={cn(
                getFieldError('password') &&
                  'border-red-500 focus-visible:ring-red-500'
              )}
              disabled={isLoading}
              autoComplete="current-password"
            />
            {getFieldError('password') && (
              <p className="text-sm text-red-500">
                {getFieldError('password')}
              </p>
            )}
          </div>

          {/* General Error Message */}
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full h-12" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                로그인 중...
              </>
            ) : (
              '로그인'
            )}
          </Button>
        </form>

        {/* Additional Info */}
        <div className="text-center text-sm text-muted-foreground">
          {formData.loginType === 'personal' ? (
            <p>개인 계정으로 로그인하여 개인화된 적성검사 결과를 확인하세요.</p>
          ) : (
            <p>기관 계정으로 로그인하여 기관 내 적성검사 결과를 관리하세요.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
