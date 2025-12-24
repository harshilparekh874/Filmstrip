
import { create } from 'zustand';
import { User } from '../core/types/models';
import { storage } from '../data/storage/WebStorage';
import { cloudClient } from '../data/api/cloudClient';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  emailContext: string | null;
  
  initialize: () => Promise<void>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<{ isNewUser: boolean; userId?: string }>;
  login: (userId: string) => Promise<void>;
  signup: (userData: Partial<User>) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  emailContext: null,
  
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
    if (!email) throw new Error("Email context lost.");
    const res = await cloudClient.post('/auth/verify', { email, code }) as any;
    return res;
  },

  login: async (userId: string) => {
    const user = await cloudClient.get(`/users/${userId}`) as User;
    if (user) {
      await storage.setItem('auth_user_data', user);
      set({ user });
    }
  },

  signup: async (userData: Partial<User>) => {
    const email = get().emailContext;
    const finalData = { ...userData, email };
    const user = await cloudClient.post('/auth/signup', finalData) as User;
    await storage.setItem('auth_user_data', user);
    set({ user });
  },

  updateUser: async (updates: Partial<User>) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const updatedUser = await cloudClient.put(`/users/${currentUser.id}`, updates) as User;
    await storage.setItem('auth_user_data', updatedUser);
    set({ user: updatedUser });
  },

  logout: async () => {
    await storage.removeItem('auth_user_data');
    set({ user: null, emailContext: null });
  }
}));
