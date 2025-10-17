export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8010';

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      const message = response.status === 403 ? 'Account is disabled. No permission to access.' : 'Unauthorized';
      throw new Error(message);
    }
    const message = await response.text();
    throw new Error(message || `请求失败：${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`.replace(/([^:]\/)\/+/g, '$1/'), {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    credentials: 'include',
    ...init,
  });
  return parseResponse<T>(response);
}
