
/**
 * cloudClient.ts - Production Ready (Supabase Integration)
 */
import { cloudServerMock } from './cloudServerMock';

// These come from your Vercel Environment Variables
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/$/, '');
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

  // Extract table name correctly
  const pathParts = url.split('/').filter(Boolean);
  const table = pathParts[0]?.split('?')[0];
  
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
      const err = await response.json();
      throw err;
    }
    return response.json();
  } catch (err: any) {
    console.error(`Supabase Request Error [${method} ${url}]:`, err);
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
    
    // Auth logic for Supabase
    if (url === '/auth/otp') {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: body.email })
        });
        const res = await response.json();
        if (res.error || !response.ok) throw res.error || { message: 'Failed to send OTP' };
        return { success: true };
    }

    if (url === '/auth/verify') {
        // We try 'signup' first, as it is the default for new OTP users in Supabase
        const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: body.email, 
                token: body.code, 
                type: 'signup' 
            })
        });
        let res = await response.json();
        
        // If 'signup' fails, it might be an existing user session, try 'magiclink' logic
        if (res.error) {
            const secondTry = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: body.email, 
                    token: body.code, 
                    type: 'magiclink' 
                })
            });
            res = await secondTry.json();
        }

        if (res.error) throw res.error;
        
        localStorage.setItem('supabase.auth.token', res.access_token);
        return { 
            success: true, 
            isNewUser: !res.user?.last_sign_in_at, 
            userId: res.user?.id 
        };
    }

    // In production, /auth/signup is just creating a row in the public 'users' table
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
