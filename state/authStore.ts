
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
    
    const remembered = await storage.getItem<User[]>('remembered_accounts') || [];
    set({ rememberedUsers: remembered });

    const cachedUser = await storage.getItem<User>('auth_user_data');
    
    if (cachedUser) {
      set({ user: cachedUser });
      
      try {
        const users = await cloudClient.get(`/users`, { userId: cachedUser.id }) as User[];
        const freshUser = (Array.isArray(users) && users.length > 0) ? users[0] : null;
        
        if (freshUser) {
          await storage.setItem('auth_user_data', freshUser);
          set({ user: freshUser });
          
          await Promise.all([
            useMovieStore.getState().fetchData(freshUser.id, true),
            useSocialStore.getState().fetchSocial(freshUser.id, true)
          ]);
        }
      } catch (err) {
        useMovieStore.getState().fetchData(cachedUser.id, true);
        useSocialStore.getState().fetchSocial(cachedUser.id, true);
      }
    }
    set({ isLoading: false });
  },

  sendOtp: async (email: string) => {
    try {
      await cloudClient.post('/auth/otp', { email });
      set({ emailContext: email });
    } catch (err: any) {
      if (err.message?.includes('429')) {
        throw new Error("Too many requests. Please wait a minute before trying again.");
      }
      throw err;
    }
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
          
          const currentRemembered = await storage.getItem<User[]>('remembered_accounts') || [];
          const filtered = currentRemembered.filter(u => u.id !== user.id);
          const updatedRemembered = [user, ...filtered].slice(0, 5);
          await storage.setItem('remembered_accounts', updatedRemembered);
          
          set({ user, rememberedUsers: updatedRemembered });

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
    
    if (!userId || !email) {
        console.error("Signup failed: Missing Context", { userId, email });
        throw new Error("Session expired. Please verify your email again.");
    }

    const { code, email: discardedEmail, ...profileFields } = userData;

    // Fix: Use ISO string for timestamps to be safe with standard Postgres columns
    const finalData = { 
        ...profileFields, 
        id: userId,
        email: email,
        name: `${userData.firstName} ${userData.lastName}`.trim(),
        createdAt: new Date().toISOString()
    };

    try {
        const user = await cloudClient.post('/auth/signup', finalData) as User;
        
        if (!user || !user.id) throw new Error("Registration failed.");

        await storage.setItem('auth_user_data', user);
        const currentRemembered = await storage.getItem<User[]>('remembered_accounts') || [];
        const updatedRemembered = [user, ...currentRemembered.filter(u => u.id !== user.id)].slice(0, 5);
        await storage.setItem('remembered_accounts', updatedRemembered);

        set({ user, rememberedUsers: updatedRemembered });
    } catch (err: any) {
        console.error("Signup API Error:", err);
        throw new Error(err.message || "Could not create account. Try a different username.");
    }
  },

  updateUser: async (updates: Partial<User>) => {
    const currentUser = get().user;
    if (!currentUser) return;
    
    const updatedUser = await cloudClient.put(`/users/${currentUser.id}`, updates) as User;
    await storage.setItem('auth_user_data', updatedUser);
    
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
