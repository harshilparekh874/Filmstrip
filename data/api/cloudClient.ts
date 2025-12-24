
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
                        // Supabase requires a redirect setup even for OTP in some regions
                        emailRedirectTo: window.location.origin 
                    }
                })
            });
            
            const res = await response.json().catch(() => ({}));
            if (!response.ok) {
                // If 500, Supabase usually returns { msg: "...", error_description: "..." }
                throw new Error(res.msg || res.error_description || res.message || `Supabase Auth Error ${response.status}`);
            }
            return { success: true };
        } catch (err: any) {
            console.error("Supabase OTP Fetch Fatal:", err);
            throw err;
        }
    }

    if (url === '/auth/verify') {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: body.email, 
                token: body.code, 
                type: 'signup' 
            })
        });
        
        let res = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            // Try secondary type 'email' which is used in some Supabase configs
            const secondTry = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: body.email, 
                    token: body.code, 
                    type: 'email' 
                })
            });
            res = await secondTry.json().catch(() => ({}));
            if (!secondTry.ok) throw new Error(res.msg || res.error_description || "Invalid verification code.");
        }

        localStorage.setItem('supabase.auth.token', res.access_token);
        return { 
            success: true, 
            isNewUser: !res.user?.last_sign_in_at, 
            userId: res.user?.id 
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
