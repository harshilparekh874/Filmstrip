
/**
 * cloudClient.ts - Production Ready (Supabase Integration)
 */
import { cloudServerMock } from './cloudServerMock';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_URL = rawUrl.replace(/\/+$/, '');
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const isProduction = !!(SUPABASE_URL && SUPABASE_KEY);

/**
 * Route Mapping: Maps mock API paths to actual Supabase tables
 */
const getTableFromUrl = (url: string): string => {
  const path = url.replace(/^\/+/, '').split('?')[0].toLowerCase();
  
  if (path.startsWith('users')) return 'users';
  if (path.startsWith('entries')) return 'entries';
  if (path.includes('social/friends')) return 'friendships';
  if (path.includes('social/requests')) return 'friendships';
  if (path.includes('social/request') || path.includes('social/accept')) return 'friendships';
  if (path.startsWith('activity')) return 'activity';
  if (path.startsWith('challenges')) return 'challenges';
  
  return path.split('/')[0];
};

const supabaseRequest = async (method: string, url: string, body?: any) => {
  const table = getTableFromUrl(url);
  const token = localStorage.getItem('supabase.auth.token');
  
  const headers: Record<string, string> = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  let targetUrl = `${SUPABASE_URL}/rest/v1/${table}`;
  let options: RequestInit = { method, headers };

  if (method === 'GET') {
    const params = new URLSearchParams();
    const pathParts = url.replace(/^\/+/, '').split('/');
    if (pathParts.length > 1 && pathParts[1] && !pathParts[1].includes('?')) {
        params.append('id', `eq.${pathParts[1]}`);
    }

    if (body?.userId) {
        if (table === 'users') {
            params.append('id', `eq.${body.userId}`);
        } else if (table === 'friendships') {
            if (url.includes('pending')) {
                params.append('friendId', `eq.${body.userId}`);
                params.append('status', `eq.PENDING`);
            } else if (url.includes('outgoing')) {
                params.append('userId', `eq.${body.userId}`);
                params.append('status', `eq.PENDING`);
            } else {
                params.append('or', `(userId.eq.${body.userId},friendId.eq.${body.userId})`);
                params.append('status', `eq.ACCEPTED`);
            }
        } else if (table === 'challenges') {
            params.append('or', `(creatorId.eq.${body.userId},recipientId.eq.${body.userId})`);
        } else {
            params.append('userId', `eq.${body.userId}`);
        }
    }

    const queryString = params.toString();
    if (queryString) targetUrl += `?${queryString}`;
  }

  if (body && method !== 'GET') {
    const cleanedBody = { ...body };
    if (table === 'users' && cleanedBody.userId) {
        cleanedBody.id = cleanedBody.userId;
        delete cleanedBody.userId;
    }
    options.body = JSON.stringify(cleanedBody);

    if (method === 'PUT' || method === 'PATCH') {
        const id = url.split('/').pop();
        targetUrl += `?id=eq.${id}`;
    }
  }

  try {
    const response = await fetch(targetUrl, options);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Unknown Error' }));
      
      // Handle 404 specially as it often means a missing table in Supabase
      if (response.status === 404 || (err.message?.includes('relation') && err.message?.includes('does not exist'))) {
          alert(`DATABASE ERROR: Resource "${table}" not found.\n\nThis usually means you need to run the SQL script provided in the README to create your database tables.`);
          throw new Error(`Table "${table}" missing.`);
      }
      
      throw new Error(err.message || 'Database error.');
    }
    return response.json();
  } catch (err: any) {
    console.error(`Supabase Error [${method} ${url}]:`, err);
    throw err;
  }
};

export const cloudClient = {
  get: async (url: string, params?: any) => {
    if (!isProduction) return cloudServerMock.handleRequest('GET', url, params);
    return supabaseRequest('GET', url, params);
  },
  
  post: async (url: string, body: any) => {
    if (!isProduction) return cloudServerMock.handleRequest('POST', url, body);
    
    if (url === '/auth/otp') {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
            method: 'POST',
            headers: { 
                'apikey': SUPABASE_KEY, 
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ email: body.email })
        });
        return response.ok ? { success: true } : response.json().then(r => { throw new Error(r.msg || r.message || "OTP Failed"); });
    }

    if (url === '/auth/verify') {
        const verify = async (type: string) => {
            return fetch(`${SUPABASE_URL}/auth/v1/verify`, {
                method: 'POST',
                headers: { 
                    'apikey': SUPABASE_KEY, 
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ email: body.email, token: body.code, type })
            });
        };

        let response = await verify('email');
        if (!response.ok) {
            const secondResponse = await verify('signup');
            if (secondResponse.ok) response = secondResponse;
        }

        const res = await response.json();
        if (!response.ok) {
            console.error("Verification failed:", res);
            throw new Error(res.msg || res.error_description || "Invalid code (403).");
        }

        localStorage.setItem('supabase.auth.token', res.access_token);
        return { success: true, isNewUser: !res.user?.last_sign_in_at, userId: res.user?.id };
    }

    if (url === '/social/request') return supabaseRequest('POST', '/friendships', { ...body, status: 'PENDING' });
    if (url === '/social/accept') {
        const idQuery = `userId=eq.${body.senderId}&friendId=eq.${body.userId}`;
        return fetch(`${SUPABASE_URL}/rest/v1/friendships?${idQuery}`, {
            method: 'PATCH',
            headers: { 
                'apikey': SUPABASE_KEY, 
                'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || SUPABASE_KEY}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ status: 'ACCEPTED' })
        });
    }

    return supabaseRequest('POST', url, body);
  },

  put: async (url: string, body: any) => {
    if (!isProduction) return cloudServerMock.handleRequest('PUT', url, body);
    return supabaseRequest('PATCH', url, body);
  },

  delete: async (url: string) => {
    if (!isProduction) return cloudServerMock.handleRequest('DELETE', url);
    const params = new URLSearchParams(url.split('?')[1]);
    const movieId = params.get('movieId');
    const userId = params.get('userId');
    const table = getTableFromUrl(url);
    
    return fetch(`${SUPABASE_URL}/rest/v1/${table}?movieId=eq.${movieId}&userId=eq.${userId}`, {
        method: 'DELETE',
        headers: { 
            'apikey': SUPABASE_KEY, 
            'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || SUPABASE_KEY}` 
        }
    });
  }
};
