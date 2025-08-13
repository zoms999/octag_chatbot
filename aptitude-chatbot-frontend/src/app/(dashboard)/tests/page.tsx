'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function TestsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <FileText className="h-6 w-6" />
        <h1 className="text-2xl font-bold">테스트 결과</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>적성검사 결과 조회</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center text-muted-foreground">
            <p>테스트 결과 조회 기능이 곧 구현될 예정입니다.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
