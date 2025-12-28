
import { User, ActivityEvent, Friendship, UserMovieEntry, SocialChallenge } from '../../core/types/models';

/**
 * CLOUD SERVER SIMULATOR (v3.3 - Fixed Identity Assignment & Username Collision)
 */

const CLOUD_DB_KEY = 'reel_reason_global_cloud_db';

interface GlobalDB {
  users: User[];
  entries: UserMovieEntry[];
  friendships: Friendship[];
  activity: ActivityEvent[];
  challenges: SocialChallenge[];
  pendingOtps: Record<string, { code: string; expires: number }>;
}

const getDb = (): GlobalDB => {
  const data = localStorage.getItem(CLOUD_DB_KEY);
  return data ? JSON.parse(data) : { users: [], entries: [], friendships: [], activity: [], challenges: [], pendingOtps: {} };
};

const saveDb = (db: GlobalDB) => {
  localStorage.setItem(CLOUD_DB_KEY, JSON.stringify(db));
};

const logToSystem = (type: 'MAIL' | 'DB' | 'AUTH' | 'GAME', message: string, payload?: any) => {
  const event = new CustomEvent('reelreason_system_log', {
    detail: { type, message, payload, timestamp: Date.now() }
  });
  window.dispatchEvent(event);
};

export const cloudServerMock = {
  handleRequest: async (method: string, url: string, data?: any) => {
    await new Promise(r => setTimeout(r, 60)); 
    const db = getDb();

    // DELETE HANDLING
    if (method === 'DELETE') {
        if (url.includes('/challenges')) {
            const params = new URLSearchParams(url.split('?')[1]);
            const id = params.get('id');
            const exists = db.challenges.find(c => c.id === id);
            if (exists) {
                db.challenges = db.challenges.filter(c => c.id !== id);
                saveDb(db);
                logToSystem('GAME', `Challenge ${id} terminated.`);
                return { success: true };
            }
        }
        if (url.includes('/entries')) {
            const params = new URLSearchParams(url.split('?')[1]);
            const userId = params.get('userId');
            const movieId = params.get('movieId');
            db.entries = db.entries.filter(e => !(e.userId === userId && e.movieId === movieId));
            saveDb(db);
            return { success: true };
        }
    }

    // AUTH ROUTES
    if (url === '/auth/otp' && method === 'POST') {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      db.pendingOtps[data.email] = { code, expires: Date.now() + 1000 * 60 * 10 };
      saveDb(db);
      logToSystem('MAIL', `Verification code sent to ${data.email}`, { code });
      return { success: true };
    }

    if (url === '/auth/verify' && method === 'POST') {
      const entry = db.pendingOtps[data.email];
      if (!entry || entry.code !== data.code) {
        logToSystem('AUTH', `Failed login attempt for ${data.email} - Invalid Code`);
        throw new Error("Invalid or expired code.");
      }
      delete db.pendingOtps[data.email];
      saveDb(db);
      const user = db.users.find(u => u.email === data.email);
      
      // FIXED: Generate a fresh ID for new users immediately so it's ready for the Profile step
      const userId = user ? user.id : 'u_' + Math.random().toString(36).substr(2, 9);
      
      return { success: true, isNewUser: !user, userId: userId };
    }

    if (url === '/auth/signup' && method === 'POST') {
      // FIXED: Actually check if username exists
      const isTaken = db.users.some(u => u.username?.toLowerCase() === data.username?.toLowerCase());
      if (isTaken) {
        throw new Error("This username is already taken. Please try another.");
      }

      const newUser: User = {
        ...data,
        id: data.id || 'u_' + Math.random().toString(36).substr(2, 9),
        isVerified: true,
        createdAt: Date.now(),
        token: 'fake_jwt_' + Math.random().toString(36)
      };
      db.users.push(newUser);
      saveDb(db);
      logToSystem('AUTH', `New user registered: ${newUser.username}`);
      return newUser;
    }

    // USER ROUTES
    if (url === '/users' && method === 'GET') {
      if (data?.userId) return db.users.filter(u => u.id === data.userId);
      return db.users;
    }
    
    if (url.startsWith('/users/') && method === 'GET') {
      const id = url.split('/').pop();
      const user = db.users.find(u => u.id === id);
      if (user) return user;
      throw new Error("User not found");
    }

    if (url.startsWith('/users/') && method === 'PUT') {
      const id = url.split('/').pop();
      const idx = db.users.findIndex(u => u.id === id);
      if (idx > -1) {
        db.users[idx] = { ...db.users[idx], ...data };
        saveDb(db);
        return db.users[idx];
      }
      throw new Error("User not found");
    }

    // MOVIE ENTRY ROUTES
    if (url === '/entries' && method === 'POST') {
      const idx = db.entries.findIndex(e => e.userId === data.userId && e.movieId === data.movieId);
      if (idx > -1) {
        db.entries[idx] = { ...data, timestamp: data.timestamp || Date.now() };
      } else {
        db.entries.push({ ...data, timestamp: data.timestamp || Date.now() });
      }
      
      db.activity.unshift({
        id: Math.random().toString(36).substr(2, 9),
        userId: data.userId,
        movieId: data.movieId,
        type: data.status,
        metadata: { rating: data.rating, droppedReason: data.droppedReason },
        timestamp: Date.now()
      });
      saveDb(db);
      return { success: true };
    }

    if (url === '/entries' && method === 'GET') {
      return data.userId ? db.entries.filter(e => e.userId === data.userId) : db.entries;
    }

    // CHALLENGE ROUTES
    if (url === '/challenges' && method === 'POST') {
      const newChallenge: SocialChallenge = {
        ...data,
        id: 'ch_' + Math.random().toString(36).substr(2, 9),
        turnUserId: data.turnUserId || data.creatorId,
        status: data.status || 'PENDING',
        timestamp: Date.now()
      };
      db.challenges.push(newChallenge);
      saveDb(db);
      logToSystem('GAME', `Multiplayer ${newChallenge.type} started.`);
      return newChallenge;
    }

    if (url === '/challenges' && method === 'GET') {
      const userId = data.userId;
      return db.challenges.filter(c => c.creatorId === userId || c.recipientId === userId);
    }

    if (url.startsWith('/challenges/') && method === 'PUT') {
        const id = url.split('/').pop();
        const idx = db.challenges.findIndex(c => c.id === id);
        if (idx > -1) {
          const prevStatus = db.challenges[idx].status;
          db.challenges[idx] = { ...db.challenges[idx], ...data };
          
          if (data.status === 'COMPLETED' && prevStatus !== 'COMPLETED') {
            db.activity.unshift({
                id: Math.random().toString(36).substr(2, 9),
                userId: db.challenges[idx].recipientId,
                type: 'CHALLENGE_COMPLETED',
                metadata: { challengeType: db.challenges[idx].type, challengeId: id },
                timestamp: Date.now()
            });
            logToSystem('GAME', `Challenge ${id} finalized!`);
          }
          
          saveDb(db);
          return db.challenges[idx];
        }
        throw new Error("Challenge not found");
    }

    if (url === '/activity' && method === 'GET') return db.activity;

    // SOCIAL ROUTES
    if (url === '/social/friends' && method === 'GET') {
      const userId = data.userId;
      const friendships = db.friendships.filter(f => (f.userId === userId || f.friendId === userId) && f.status === 'ACCEPTED');
      const friendIds = friendships.map(f => f.userId === userId ? f.friendId : f.userId);
      return db.users.filter(u => friendIds.includes(u.id));
    }

    if (url === '/social/requests/pending' && method === 'GET') {
      const pending = db.friendships.filter(f => f.friendId === data.userId && f.status === 'PENDING');
      return pending.map(f => ({
        id: f.userId,
        from: db.users.find(u => u.id === f.userId)
      })).filter(r => r.from);
    }

    if (url === '/social/requests/outgoing' && method === 'GET') {
      const outgoing = db.friendships.filter(f => f.userId === data.userId && f.status === 'PENDING');
      return outgoing.map(f => f.friendId);
    }

    if (url === '/social/request' && method === 'POST') {
      const { userId, friendId } = data;
      const exists = db.friendships.find(f => 
        (f.userId === userId && f.friendId === friendId) ||
        (f.userId === friendId && f.friendId === userId)
      );
      if (!exists) {
        db.friendships.push({ userId, friendId, status: 'PENDING' });
        saveDb(db);
      }
      return { success: true };
    }

    if (url === '/social/accept' && method === 'POST') {
      const { userId, senderId } = data;
      const idx = db.friendships.findIndex(f => f.userId === senderId && f.friendId === userId && f.status === 'PENDING');
      if (idx > -1) {
        db.friendships[idx].status = 'ACCEPTED';
        db.activity.unshift({
          id: Math.random().toString(36).substr(2, 9),
          userId: userId,
          type: 'FRIEND_ADDED',
          metadata: { friendId: senderId },
          timestamp: Date.now()
        });
        saveDb(db);
      }
      return { success: true };
    }

    if (url === '/social/reject' && method === 'POST') {
      const { userId, senderId } = data;
      db.friendships = db.friendships.filter(f => !(f.userId === senderId && f.friendId === userId));
      saveDb(db);
      return { success: true };
    }

    return []; 
  }
};
