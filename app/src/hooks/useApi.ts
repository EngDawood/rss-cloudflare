import { useState, useCallback, useRef, useEffect } from 'react';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status?: number;
}

export function useApi(token: string, onUnauthorized: (message: string) => void) {
  const [isApiLoading, setIsApiLoading] = useState(false);

  // Keep onUnauthorized stable via ref so callApi doesn't need it as a dep
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const callApi = useCallback(async <T = any>(action: string, params: any = {}): Promise<ApiResponse<T>> => {
    setIsApiLoading(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, params })
      });

      if (response.status === 401) {
        onUnauthorizedRef.current('Unauthorized: Please set a valid access token.');
        return { error: 'Unauthorized', status: 401 };
      }

      const resData = await response.json();
      if (!response.ok) {
        return { error: resData.error || 'Server error', status: response.status };
      }
      return { data: resData.data, status: response.status };
    } catch (err: any) {
      return { error: err.message || 'Network fetch failed' };
    } finally {
      setIsApiLoading(false);
    }
  }, [token]); // only re-creates when token changes

  return { callApi, isApiLoading };
}
