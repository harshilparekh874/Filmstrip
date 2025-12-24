
import { cloudClient } from '../api/cloudClient';
import { User } from '../../core/types/models';

export const userRepo = {
  getUsers: async (): Promise<User[]> => {
    return await cloudClient.get('/users') as User[];
  },
  
  getUserById: async (id: string): Promise<User | undefined> => {
    return await cloudClient.get(`/users/${id}`) as User;
  }
};
