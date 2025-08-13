import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '로그인 - 적성검사 챗봇',
  description: '적성검사 기반 지능형 챗봇 서비스에 로그인하세요',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo/Brand Section */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              적성검사 챗봇
            </h1>
            <p className="text-sm text-gray-600">
              AI 기반 개인화된 적성검사 분석 서비스
            </p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
