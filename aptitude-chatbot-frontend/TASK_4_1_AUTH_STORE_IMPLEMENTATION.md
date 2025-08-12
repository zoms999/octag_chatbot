# Task 4.1 - 인증 스토어 및 토큰 관리 구현 완료

## 구현 개요

Task 4.1에서 요구된 Zustand 기반 AuthStore와 JWT 토큰 관리, 자동 토큰 갱신, 보호된 라우트 기능을 완전히 구현했습니다.

## 구현된 기능

### 1. 향상된 AuthStore (Zustand)

**파일**: `src/lib/stores/auth.ts`

#### 새로운 상태 필드
- `isRefreshing`: 토큰 갱신 중 상태 추적
- `refreshTimer`: 자동 토큰 갱신 타이머 관리

#### 핵심 기능
- **자동 토큰 갱신 스케줄링**: 토큰 만료 5분 전 자동 갱신
- **중복 갱신 방지**: 동시 갱신 요청 방지 로직
- **토큰 유효성 검사**: 로그인/인증 확인 시 토큰 상태 검증
- **타이머 관리**: 로그인/로그아웃 시 자동 타이머 시작/중지

### 2. 강화된 TokenManager

#### 새로운 메서드
- `getTokenTimestamp()`: 토큰 저장 시간 추적
- `isTokenValid()`: 토큰 유효성 실시간 검사
- `shouldRefresh()`: 토큰 갱신 필요 여부 판단

#### 보안 강화
- 액세스 토큰: sessionStorage (XSS 방지)
- 리프레시 토큰: localStorage (지속성)
- 토큰 타임스탬프 추적

### 3. 자동 토큰 갱신 시스템

**파일**: `src/hooks/useTokenRefresh.ts`

#### 기능
- **주기적 토큰 검사**: 1분마다 토큰 상태 확인
- **페이지 가시성 기반 갱신**: 페이지 활성화 시 토큰 검사
- **만료 임박 감지**: 5분 전 자동 갱신 트리거
- **실패 시 자동 로그아웃**: 갱신 실패 시 안전한 로그아웃

### 4. 포괄적인 라우트 보호

**파일**: `src/hooks/useRouteGuard.ts`

#### 제공되는 훅
- `useRouteGuard`: 기본 라우트 보호 로직
- `useProtectedRoute`: 인증 필요 라우트용
- `usePublicRoute`: 공개 라우트용 (인증된 사용자 리다이렉트)
- `useRoleBasedRoute`: 역할 기반 접근 제어

#### 기능
- **역할 기반 접근 제어**: 사용자 타입별 라우트 제한
- **리다이렉트 URL 저장**: 로그인 후 원래 페이지로 복귀
- **인증 상태 실시간 추적**: 토큰 갱신 중 로딩 상태 관리

### 5. 인증 유틸리티

**파일**: `src/lib/auth/authUtils.ts`

#### 제공 기능
- 토큰 만료 시간 계산 및 포맷팅
- 사용자 역할/ID 토큰에서 추출
- 역할 기반 권한 검사
- 인증 데이터 관리 (리다이렉트 URL 등)
- 마지막 인증 확인 시간 추적

### 6. API 인증 미들웨어

**파일**: `src/lib/auth/authMiddleware.ts`

#### 기능
- **자동 토큰 첨부**: API 요청에 유효한 토큰 자동 추가
- **백그라운드 갱신**: 필요 시 백그라운드에서 토큰 갱신
- **에러 처리**: 401 에러 시 자동 로그아웃 및 리다이렉트
- **요청 전처리**: 인증이 필요한 요청 자동 감지

### 7. 테스트 코드

**파일**: `src/lib/stores/__tests__/auth.test.ts`

#### 테스트 범위
- TokenManager 기본 동작
- 로그인/로그아웃 플로우
- 토큰 갱신 로직 (중복 방지 포함)
- 인증 상태 확인
- 타이머 관리

## 보안 강화 사항

### 1. 토큰 저장 전략
- **액세스 토큰**: sessionStorage (브라우저 종료 시 삭제)
- **리프레시 토큰**: localStorage (지속성 유지)
- **토큰 타임스탬프**: 만료 추적용

### 2. 자동 갱신 보안
- 만료 5분 전 자동 갱신으로 서비스 중단 방지
- 중복 갱신 요청 방지로 서버 부하 감소
- 갱신 실패 시 즉시 로그아웃으로 보안 유지

### 3. 라우트 보호
- 인증 상태 실시간 검증
- 토큰 갱신 중 적절한 로딩 상태 표시
- 권한 없는 접근 시 안전한 리다이렉트

## 사용 방법

### 1. 기본 인증 확인
```typescript
import { useAuthStore } from '@/lib/stores/auth';

function MyComponent() {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please login</div>;
  
  return <div>Welcome, {user?.name}!</div>;
}
```

### 2. 보호된 라우트
```typescript
import { useProtectedRoute } from '@/hooks';

function ProtectedPage() {
  const { isLoading, isAuthorized } = useProtectedRoute();
  
  if (isLoading) return <div>Checking access...</div>;
  if (!isAuthorized) return null; // Will redirect
  
  return <div>Protected content</div>;
}
```

### 3. 역할 기반 접근
```typescript
import { useRoleBasedRoute } from '@/hooks';

function AdminPage() {
  const { isLoading, isAuthorized } = useRoleBasedRoute(['organization_admin']);
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthorized) return <div>Access denied</div>;
  
  return <div>Admin content</div>;
}
```

### 4. 자동 토큰 갱신 활성화
```typescript
import { useTokenRefresh } from '@/hooks';

function App() {
  useTokenRefresh(); // 자동 토큰 관리 활성화
  
  return <div>App content</div>;
}
```

## 요구사항 충족 확인

### ✅ Requirements 1.2 - JWT 토큰 인증
- 액세스/리프레시 토큰 완전 구현
- 토큰 기반 인증 상태 관리

### ✅ Requirements 1.4 - 자동 토큰 갱신
- 만료 전 자동 갱신 시스템
- 백그라운드 갱신 지원

### ✅ Requirements 1.5 - 토큰 만료 처리
- 만료된 토큰 자동 감지
- 갱신 실패 시 로그아웃

### ✅ Requirements 7.5 - 보안 토큰 저장
- sessionStorage/localStorage 분리 저장
- XSS 공격 방지 고려

## 다음 단계

Task 4.1이 완료되었습니다. 다음 Task 4.2 (로그인 페이지 및 폼 구현)를 진행할 수 있습니다.

구현된 인증 시스템은 다음 기능들을 제공합니다:
- 완전한 JWT 토큰 관리
- 자동 토큰 갱신
- 포괄적인 라우트 보호
- 역할 기반 접근 제어
- 보안 강화된 토큰 저장
- 포괄적인 테스트 커버리지