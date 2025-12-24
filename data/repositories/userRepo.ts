
import { cloudClient } from '../api/cloudClient';
import { User } from '../../core/types/models';

export const userRepo = {
  getUsers: async (): Promise<User[]> => {
    const res = await cloudClient.get('/users');
    return Array.isArray(res) ? res : [];
  },
  
  getUserById: async (id: string): Promise<User | undefined> => {
    try {
      const res = await cloudClient.get(`/users`, { userId: id });
      // Supabase REST returns an array, extract the first match
      if (Array.isArray(res) && res.length > 0) {
        return res[0] as User;
      }
      // Fallback for mock environment or direct ID paths
      if (res && !Array.isArray(res) && (res as any).id === id) {
        return res as User;
      }
      return undefined;
    } catch (err) {
      console.error(`Failed to fetch user ${id}:`, err);
      return undefined;
    }
  }
};
