const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const INTERNAL_API_KEY = process.env.PORTAL_INTERNAL_API_KEY || '';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  userId?: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, userId } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add portal auth headers if we have them
  if (INTERNAL_API_KEY && userId) {
    headers['X-Portal-API-Key'] = INTERNAL_API_KEY;
    headers['X-Portal-User-Id'] = userId;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || 'unknown_error',
      data.message || 'An error occurred'
    );
  }

  return data as T;
}

// Auth endpoints
export async function login(email: string, password: string) {
  return apiRequest<{ user: { id: string; email: string; displayName?: string; status: string } }>(
    '/v1/auth/login',
    { method: 'POST', body: { email, password } }
  );
}

export async function register(email: string, password: string, displayName?: string) {
  return apiRequest<{ user: { id: string; email: string; displayName?: string; status: string } }>(
    '/v1/auth/register',
    { method: 'POST', body: { email, password, displayName } }
  );
}

// Admin endpoints (require userId)
export async function getMe(userId: string) {
  return apiRequest<{ user: { id: string; email: string; displayName?: string; apps: { id: string; name: string; status: string }[] } }>(
    '/v1/admin/me',
    { userId }
  );
}

export async function getApps(userId: string) {
  return apiRequest<{ apps: AppWithKeys[] }>('/v1/admin/apps', { userId });
}

export async function getApp(userId: string, appId: string): Promise<AppWithKeys | null> {
  try {
    const result = await apiRequest<{ app: AppWithKeys }>(`/v1/admin/apps/${appId}`, { userId });
    return result.app;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return null;
    }
    throw e;
  }
}

export async function createApp(
  userId: string,
  data: { name: string; description?: string; allowedScopes?: string[]; allowedCallbackUrls?: string[] }
) {
  return apiRequest<{
    app: App;
    key: { id: string; prefix: string; fullKey: string };
    message: string;
  }>('/v1/admin/apps', { method: 'POST', body: data, userId });
}

export async function updateApp(
  userId: string,
  appId: string,
  data: { name?: string; description?: string; allowedScopes?: string[]; allowedCallbackUrls?: string[] }
) {
  return apiRequest<{ app: App }>(`/v1/admin/apps/${appId}`, {
    method: 'PATCH',
    body: data,
    userId,
  });
}

export async function deleteApp(userId: string, appId: string) {
  return apiRequest<{ message: string; app: { id: string; status: string } }>(
    `/v1/admin/apps/${appId}`,
    { method: 'DELETE', userId }
  );
}

export async function rotateAppKey(userId: string, appId: string) {
  return apiRequest<{
    key: { id: string; prefix: string; fullKey: string };
    message: string;
  }>(`/v1/admin/apps/${appId}/rotate-key`, { method: 'POST', userId });
}

export async function createAppKey(userId: string, appId: string, name?: string) {
  return apiRequest<{
    id: string;
    prefix: string;
    fullKey: string;
  }>(`/v1/admin/apps/${appId}/keys`, {
    method: 'POST',
    body: { name },
    userId,
  });
}

export async function revokeAppKey(userId: string, appId: string, keyId: string) {
  return apiRequest<{ message: string }>(
    `/v1/admin/apps/${appId}/keys/${keyId}`,
    { method: 'DELETE', userId }
  );
}

// User management
export async function updateUser(userId: string, data: { displayName?: string }) {
  return apiRequest<{ user: { id: string; email: string; displayName?: string } }>(
    '/v1/admin/profile',
    { method: 'PATCH', body: data, userId }
  );
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  return apiRequest<{ message: string }>(
    '/v1/admin/password',
    { method: 'POST', body: { currentPassword, newPassword }, userId }
  );
}

// Types
export interface App {
  id: string;
  name: string;
  description?: string;
  status: string;
  allowedScopes: string[];
  createdAt: string;
}

export interface AppKey {
  id: string;
  name?: string;
  keyPrefix: string;
  status: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface AppWithKeys extends App {
  keys: AppKey[];
  _count?: { verificationEvents: number };
}

export { ApiError };
