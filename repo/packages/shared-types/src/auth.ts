// Auth and session domain types

export type UserRole = 'student' | 'faculty_advisor' | 'corporate_mentor' | 'department_admin';

export interface UserScope {
  school?: string;
  major?: string;
  class?: string;
  cohort?: string;
}

export interface Session {
  _id: string;
  userId: string;
  role: UserRole;
  scope: UserScope;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  sessionId: string;
  userId: string;
  username: string;
  role: UserRole;
  scope: UserScope;
  expiresAt: Date;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface FailedLoginRecord {
  _id: string;
  username: string;
  attempts: number;
  lockedUntil?: Date;
  lastAttemptAt: Date;
}
