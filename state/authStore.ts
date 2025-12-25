
import { create } from 'zustand';
import { User } from '../core/types/models';
import { storage } from '../data/storage/WebStorage';
import { cloudClient } from '../data/api/cloudClient';
import { useMovieStore } from './movieStore';
import { useSocialStore } from './socialStore';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  emailContext: string | null;
  userIdContext: string | null;
  
  initialize: () => Promise<void>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<{ isNewUser: boolean; userId?: string }>;
  login: (userId: string) => Promise<boolean>;
  signup: (userData: any) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  emailContext: null,
  userIdContext: null,
  
  initialize: async () => {
    set({ isLoading: true });
    const cachedUser = await storage.getItem<User>('auth_user_data');
    
    if (cachedUser) {
      // Set the cached user immediately for perceived speed
      set({ user: cachedUser });
      
      // PROACTIVE SYNC: Force a refresh of the user profile from the cloud
      try {
        const users = await cloudClient.get(`/users`, { userId: cachedUser.id }) as User[];
        const freshUser = users && users.length > 0 ? users[0] : null;
        
        if (freshUser) {
          // Compare and update if changed
          if (JSON.stringify(freshUser) !== JSON.stringify(cachedUser)) {
            await storage.setItem('auth_user_data', freshUser);
            set({ user: freshUser });
          }
          
          // Trigger data syncs
          useMovieStore.getState().fetchData(freshUser.id, true);
          useSocialStore.getState().fetchSocial(freshUser.id, true);
        } else {
          // If profile vanished from server, clear local
          await storage.removeItem('auth_user_data');
          set({ user: null });
        }
      } catch (err) {
        // Offline or error: stick with cached and attempt silent data sync
        useMovieStore.getState().fetchData(cachedUser.id, true);
        useSocialStore.getState().fetchSocial(cachedUser.id, true);
      }
    }
    set({ isLoading: false });
  },

  sendOtp: async (email: string) => {
    await cloudClient.post('/auth/otp', { email });
    set({ emailContext: email });
  },

  verifyOtp: async (code: string) => {
    const email = get().emailContext;
    if (!email) throw new Error("Email context lost.");
    const res = await cloudClient.post('/auth/verify', { email, code }) as any;
    if (res.userId) {
        set({ userIdContext: res.userId });
    }
    return res;
  },

  login: async (userId: string) => {
    try {
        const users = await cloudClient.get(`/users`, { userId }) as User[];
        const user = users && users.length > 0 ? users[0] : null;
        if (user) {
          await storage.setItem('auth_user_data', user);
          set({ user });
          useMovieStore.getState().fetchData(user.id, true);
          useSocialStore.getState().fetchSocial(user.id, true);
          return true;
        }
        return false;
    } catch (err) {
        console.error("Login lookup failed:", err);
        return false;
    }
  },

  signup: async (userData: any) => {
    const email = get().emailContext;
    const userId = get().userIdContext;
    const { code, email: discardedEmail, ...profileFields } = userData;

    const finalData = { 
        ...profileFields, 
        id: userId,
        email: email,
        name: `${userData.firstName} ${userData.lastName}`.trim(),
        createdAt: Date.now()
    };

    delete (finalData as any).movieSearch;
    delete (finalData as any).movieResults;

    const results = await cloudClient.post('/auth/signup', finalData) as User[];
    const user = Array.isArray(results) ? results[0] : results;
    
    await storage.setItem('auth_user_data', user);
    set({ user });
  },

  updateUser: async (updates: Partial<User>) => {
    const currentUser = get().user;
    if (!currentUser) return;
    
    const results = await cloudClient.put(`/users/${currentUser.id}`, updates) as User[];
    const updatedUser = Array.isArray(results) ? results[0] : results;
    
    await storage.setItem('auth_user_data', updatedUser);
    set({ user: updatedUser });
  },

  logout: async () => {
    await storage.removeItem('auth_user_data');
    localStorage.removeItem('supabase.auth.token');
    set({ user: null, emailContext: null, userIdContext: null });
  }
}));
