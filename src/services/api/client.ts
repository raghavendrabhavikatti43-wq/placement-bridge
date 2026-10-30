/**
 * Placement Bridge — Typed Frontend API Client
 * Part I: Single HTTP client with automatic Bearer attachment, cookie credentials,
 * single-flight 401 refresh rotation, and normalized error handling.
 */

export const AUTH_TOKEN_STORAGE_KEY = 'placement_portal_auth_token_v1';

const API_BASE_URL =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ||
  '/api/v1';

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fieldErrors?: Array<{ field: string; message: string }>;
  public readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Array<{ field: string; message: string }>,
    requestId?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.requestId = requestId;
  }
}

export function getStoredAccessToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore restricted iframe storage exceptions
  }
}

let inFlightRefreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        return null;
      }
      const json = await response.json();
      const nextToken: string | undefined = json?.data?.accessToken || json?.accessToken;
      if (nextToken) {
        setStoredAccessToken(nextToken);
        return nextToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
  skipRefresh?: boolean;
  rawBaseUrl?: string;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, skipAuth = false, skipRefresh = false, rawBaseUrl, headers, ...rest } = options;
  const baseUrl = rawBaseUrl !== undefined ? rawBaseUrl : API_BASE_URL;
  const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const buildHeaders = (tokenOverride?: string | null): Headers => {
    const h = new Headers(headers || {});
    if (body !== undefined && !(body instanceof FormData) && !h.has('Content-Type')) {
      h.set('Content-Type', 'application/json');
    }
    if (!skipAuth) {
      const tok = tokenOverride !== undefined ? tokenOverride : getStoredAccessToken();
      if (tok && !h.has('Authorization')) {
        h.set('Authorization', `Bearer ${tok}`);
      }
    }
    return h;
  };

  const serializeBody = (): BodyInit | undefined => {
    if (body === undefined) return undefined;
    if (body instanceof FormData || typeof body === 'string') return body;
    return JSON.stringify(body);
  };

  let response = await fetch(url, {
    ...rest,
    credentials: 'include',
    headers: buildHeaders(),
    body: serializeBody(),
  });

  if (response.status === 401 && !skipRefresh && !path.includes('/auth/')) {
    const refreshedToken = await attemptTokenRefresh();
    if (refreshedToken) {
      response = await fetch(url, {
        ...rest,
        credentials: 'include',
        headers: buildHeaders(refreshedToken),
        body: serializeBody(),
      });
    }
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload?.code || 'HTTP_ERROR',
      payload?.message || payload?.error || `Request failed with status ${response.status}`,
      payload?.errors,
      payload?.requestId
    );
  }

  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}
