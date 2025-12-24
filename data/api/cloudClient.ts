
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
  // Note: In a full production build, we would use the @supabase/supabase-js library.
  // To keep this lightweight and compatible with your current structure, 
  // we route through a standard fetch pattern that maps to Supabase's REST API.
  
  const headers: Record<string, string> = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // Mapping our internal simple routes to Supabase tables
  // url e.g. /entries -> entries table
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
    throw new Error(err.message || 'Database error');
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
        // Handle special auth routes in mock
        if (url.startsWith('/auth')) return cloudServerMock.handleRequest('POST', url, body);
        return cloudServerMock.handleRequest('POST', url, body);
    }
    
    // For Production Auth, we'd use Supabase Auth specifically
    if (url === '/auth/otp') {
        const { error } = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: body.email })
        }).then(res => res.json());
        if (error) throw error;
        return { success: true };
    }

    if (url === '/auth/verify') {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: body.email, token: body.code, type: 'magiclink' })
        }).then(res => res.json());
        if (res.error) throw res.error;
        localStorage.setItem('supabase.auth.token', res.access_token);
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
    // Simple delete mapping
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
