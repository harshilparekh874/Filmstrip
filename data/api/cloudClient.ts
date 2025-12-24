
/**
 * cloudClient.ts - Production Ready (Supabase Integration)
 */
import { cloudServerMock } from './cloudServerMock';

// These come from your Vercel Environment Variables
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL;
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const isProduction = !!(SUPABASE_URL && SUPABASE_KEY);

/**
 * For a truly "Global" launch, we use Supabase.
 * It handles Database, Real Email Auth, and Scaling.
 */
const supabaseRequest = async (method: string, url: string, body?: any) => {
  const headers: Record<string, string> = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const table = url.split('/')[1].split('?')[0];
  const targetUrl = `${SUPABASE_URL}/rest/v1/${table}`;

  let finalUrl = targetUrl;
  let options: RequestInit = { method, headers };

  if (method === 'GET' && body?.userId) {
    finalUrl += `?userId=eq.${body.userId}`;
  }

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(finalUrl, options);
  if (!response.ok) {
    const err = await response.json();
    throw err; // Propagate the whole error object
  }
  return response.json();
};

export const cloudClient = {
  get: async (url: string, params?: any) => {
    if (!isProduction) return cloudServerMock.handleRequest('GET', url, params);
    return supabaseRequest('GET', url, params);
  },
  
  post: async (url: string, body: any) => {
    if (!isProduction) {
        if (url.startsWith('/auth')) return cloudServerMock.handleRequest('POST', url, body);
        return cloudServerMock.handleRequest('POST', url, body);
    }
    
    // For Production Auth
    if (url === '/auth/otp') {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: body.email })
        });
        const res = await response.json();
        if (res.error) throw res.error; // Throws to catch block in Login.tsx
        return { success: true };
    }

    if (url === '/auth/verify') {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: body.email, 
                token: body.code, 
                type: 'email' // 'email' is the standard type for OTP numeric codes
            })
        });
        const res = await response.json();
        if (res.error) throw res.error;
        
        localStorage.setItem('supabase.auth.token', res.access_token);
        // If they just verified but we don't have their name in the user table, they are "new"
        return { success: true, isNewUser: !res.user?.last_sign_in_at, userId: res.user?.id };
    }

    return supabaseRequest('POST', url, body);
  },

  put: async (url: string, body: any) => {
    if (!isProduction) return cloudServerMock.handleRequest('PUT', url, body);
    return supabaseRequest('PUT', url, body);
  },

  delete: async (url: string) => {
    if (!isProduction) return cloudServerMock.handleRequest('DELETE', url);
    const table = url.split('/')[1].split('?')[0];
    const params = new URLSearchParams(url.split('?')[1]);
    const movieId = params.get('movieId');
    const userId = params.get('userId');
    
    return fetch(`${SUPABASE_URL}/rest/v1/${table}?movieId=eq.${movieId}&userId=eq.${userId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
  }
};
