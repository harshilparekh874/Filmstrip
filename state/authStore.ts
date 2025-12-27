
import { create } from 'zustand';
import { User } from '../core/types/models';
import { storage } from '../data/storage/WebStorage';
import { cloudClient } from '../data/api/cloudClient';
import { useMovieStore } from './movieStore';
import { useSocialStore } from './socialStore';

interface AuthState {
  user: User | null;
  rememberedUsers: User[];
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
  forgetAccount: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  rememberedUsers: [],
  isLoading: true,
  emailContext: null,
  userIdContext: null,
  
  initialize: async () => {
    set({ isLoading: true });
    
    // 1. Load the list of "Remembered" accounts for this device
    const remembered = await storage.getItem<User[]>('remembered_accounts') || [];
    set({ rememberedUsers: remembered });

    // 2. Check for an active session
    const cachedUser = await storage.getItem<User>('auth_user_data');
    
    if (cachedUser) {
      set({ user: cachedUser });
      
      // CRITICAL SYNC: Proactively fetch fresh user data and lists from "cloud"
      try {
        const users = await cloudClient.get(`/users`, { userId: cachedUser.id }) as User[];
        const freshUser = (Array.isArray(users) && users.length > 0) ? users[0] : null;
        
        if (freshUser) {
          await storage.setItem('auth_user_data', freshUser);
          set({ user: freshUser });
          
          // Force immediate high-priority data fetch to restore watched list and social state
          await Promise.all([
            useMovieStore.getState().fetchData(freshUser.id, true),
            useSocialStore.getState().fetchSocial(freshUser.id, true)
          ]);
        }
      } catch (err) {
        // Fail gracefully to cache if offline, but still try to sync data
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
          // 1. Save active session
          await storage.setItem('auth_user_data', user);
          
          // 2. Update remembered list (Device Trust)
          const currentRemembered = await storage.getItem<User[]>('remembered_accounts') || [];
          const filtered = currentRemembered.filter(u => u.id !== user.id);
          const updatedRemembered = [user, ...filtered].slice(0, 5); // Keep last 5
          await storage.setItem('remembered_accounts', updatedRemembered);
          
          set({ user, rememberedUsers: updatedRemembered });

          // 3. Hard sync all data immediately
          await Promise.all([
            useMovieStore.getState().fetchData(user.id, true),
            useSocialStore.getState().fetchSocial(user.id, true)
          ]);
          return true;
        }
        return false;
    } catch (err) {
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

    const user = await cloudClient.post('/auth/signup', finalData) as User;
    
    // Save active session and add to remembered list
    await storage.setItem('auth_user_data', user);
    const currentRemembered = await storage.getItem<User[]>('remembered_accounts') || [];
    const updatedRemembered = [user, ...currentRemembered.filter(u => u.id !== user.id)].slice(0, 5);
    await storage.setItem('remembered_accounts', updatedRemembered);

    set({ user, rememberedUsers: updatedRemembered });
  },

  updateUser: async (updates: Partial<User>) => {
    const currentUser = get().user;
    if (!currentUser) return;
    
    const updatedUser = await cloudClient.put(`/users/${currentUser.id}`, updates) as User;
    await storage.setItem('auth_user_data', updatedUser);
    
    // Also update in remembered list
    const currentRemembered = await storage.getItem<User[]>('remembered_accounts') || [];
    const updatedRemembered = currentRemembered.map(u => u.id === updatedUser.id ? updatedUser : u);
    await storage.setItem('remembered_accounts', updatedRemembered);

    set({ user: updatedUser, rememberedUsers: updatedRemembered });
  },

  logout: async () => {
    await storage.removeItem('auth_user_data');
    localStorage.removeItem('supabase.auth.token');
    set({ user: null, emailContext: null, userIdContext: null });
  },

  forgetAccount: async (userId: string) => {
    const currentRemembered = await storage.getItem<User[]>('remembered_accounts') || [];
    const updated = currentRemembered.filter(u => u.id !== userId);
    await storage.setItem('remembered_accounts', updated);
    set({ rememberedUsers: updated });
  }
}));
