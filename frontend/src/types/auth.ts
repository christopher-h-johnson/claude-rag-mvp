/**
 * Authentication Type Definitions
 */

export interface UserCredentials {
    username: string;
    password: string;
}

export interface SessionToken {
    token: string;
    expiresAt: number;
    userId: string;
}

export interface UserContext {
    userId: string;
    username: string;
    roles: string[];
    sessionId: string;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: UserContext | null;
    token: string | null;
    loading: boolean;
}

export interface LoginResponse {
    token: string;
    expiresAt: number;
    userId: string;
    username?: string;
    roles?: string[];
    sessionId?: string;
}
