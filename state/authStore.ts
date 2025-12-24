
import { create } from 'zustand';
import { User } from '../core/types/models';
import { storage } from '../data/storage/WebStorage';
import { cloudClient } from '../data/api/cloudClient';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  emailContext: string | null;
  userIdContext: string | null;
  
  initialize: () => Promise<void>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<{ isNewUser: boolean; userId?: string }>;
  login: (userId: string) => Promise<boolean>;
  signup: (userData: Partial<User>) => Promise<void>;
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
    const storedUser = await storage.getItem<User>('auth_user_data');
    if (storedUser) {
      set({ user: storedUser });
    }
    set({ isLoading: false });
  },

  sendOtp: async (email: string) => {
    await cloudClient.post('/auth/otp', { email });
    set({ emailContext: email });
  },

  verifyOtp: async (code: string) => {
    const email = get().emailContext;
    if (!email) throw new Error("Email context lost. Please restart.");
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
          return true;
        }
        return false;
    } catch (err) {
        console.error("Login lookup failed:", err);
        return false;
    }
  },

  signup: async (userData: Partial<User>) => {
    const email = get().emailContext;
    const userId = get().userIdContext;
    
    const finalData = { 
        ...userData, 
        id: userId,
        email,
        name: `${userData.firstName} ${userData.lastName}`.trim(),
    };

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
