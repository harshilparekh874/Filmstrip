
/**
 * cloudClient.ts - Production Ready (Supabase Integration)
 */
import { cloudServerMock } from './cloudServerMock';

// Sanitize URL: Remove trailing slashes to prevent //auth/v1/otp paths
const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_URL = rawUrl.replace(/\/+$/, '');
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const isProduction = !!(SUPABASE_URL && SUPABASE_KEY);

/**
 * For a truly "Global" launch, we use Supabase.
 */
const supabaseRequest = async (method: string, url: string, body?: any) => {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // Clean the incoming URL part
  const cleanPath = url.replace(/^\/+/, '');
  const table = cleanPath.split('?')[0].split('/')[0];
  
  const targetUrl = `${SUPABASE_URL}/rest/v1/${table}`;

  let finalUrl = targetUrl;
  let options: RequestInit = { method, headers };

  if (method === 'GET' && body?.userId) {
    finalUrl += `?userId=eq.${body.userId}`;
  }

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(finalUrl, options);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Unknown Supabase Error' }));
      throw err;
    }
    return response.json();
  } catch (err: any) {
    console.error(`Supabase REST Error [${method} ${url}]:`, err);
    throw err;
  }
};

export const cloudClient = {
  get: async (url: string, params?: any) => {
    if (!isProduction) return cloudServerMock.handleRequest('GET', url, params);
    return supabaseRequest('GET', url, params);
  },
  
  post: async (url: string, body: any) => {
    if (!isProduction) {
        return cloudServerMock.handleRequest('POST', url, body);
    }
    
    // Auth logic for Supabase GoTrue API
    if (url === '/auth/otp') {
        try {
            const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
                method: 'POST',
                headers: { 
                    'apikey': SUPABASE_KEY, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    email: body.email,
                    options: {
                        emailRedirectTo: window.location.origin 
                    }
                })
            });
            
            const res = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(res.msg || res.error_description || res.message || `Auth Error ${response.status}`);
            }
            return { success: true };
        } catch (err: any) {
            throw err;
        }
    }

    if (url === '/auth/verify') {
        // We try 'signup' first, then 'magiclink' - Supabase uses different types 
        // depending on if the user exists yet or not.
        const tryVerify = async (type: 'signup' | 'magiclink' | 'email') => {
            const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: body.email, 
                    token: body.code, 
                    type
                })
            });
            return { ok: response.ok, data: await response.json().catch(() => ({})) };
        };

        let res = await tryVerify('signup');
        if (!res.ok) res = await tryVerify('magiclink');
        if (!res.ok) res = await tryVerify('email');

        if (!res.ok) {
            throw new Error(res.data.msg || res.data.error_description || "Invalid verification code.");
        }

        localStorage.setItem('supabase.auth.token', res.data.access_token);
        return { 
            success: true, 
            isNewUser: !res.data.user?.last_sign_in_at, 
            userId: res.data.user?.id 
        };
    }

    if (url === '/auth/signup') {
        return supabaseRequest('POST', '/users', body);
    }

    return supabaseRequest('POST', url, body);
  },

  put: async (url: string, body: any) => {
    if (!isProduction) return cloudServerMock.handleRequest('PUT', url, body);
    return supabaseRequest('PUT', url, body);
  },

  delete: async (url: string) => {
    if (!isProduction) return cloudServerMock.handleRequest('DELETE', url);
    const params = new URLSearchParams(url.split('?')[1]);
    const movieId = params.get('movieId');
    const userId = params.get('userId');
    
    return fetch(`${SUPABASE_URL}/rest/v1/entries?movieId=eq.${movieId}&userId=eq.${userId}`, {
        method: 'DELETE',
        headers: { 
            'apikey': SUPABASE_KEY, 
            'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || SUPABASE_KEY}` 
        }
    });
  }
};
