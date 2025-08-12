// User related types
export interface BaseUser {
  id: string;
  name: string;
  ac_id: string;
}

export interface PersonalUser extends BaseUser {
  type: 'personal';
  sex: string;
  isPaid: boolean;
  productType: string;
  isExpired: boolean;
  state: string;
}

export interface OrganizationUser extends BaseUser {
  type: 'organization_admin' | 'organization_member';
  sessionCode: string;
  ins_seq?: number;
}

export type User = PersonalUser | OrganizationUser;

export interface LoginCredentials {
  username: string;
  password: string;
  loginType: 'personal' | 'organization';
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}
