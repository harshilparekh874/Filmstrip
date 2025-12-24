
import { cloudClient } from '../api/cloudClient';
import { User, SocialChallenge } from '../../core/types/models';

export const socialRepo = {
  getFriends: async (userId: string): Promise<User[]> => {
    return await cloudClient.get('/social/friends', { userId }) as User[];
  },

  getPendingRequests: async (userId: string): Promise<{ id: string, from: User }[]> => {
    const res = await cloudClient.get('/social/requests/pending', { userId }) as any[];
    if (!Array.isArray(res)) return [];
    
    return res.map(f => {
      // In Supabase, the joined 'from' field will be available if using select=*,from:userId(*)
      const senderId = f.userId || f.id;
      return {
        id: senderId, 
        from: f.from || { id: senderId, name: 'New Request' }
      };
    }).filter(r => r.id);
  },

  getOutgoingRequests: async (userId: string): Promise<string[]> => {
    const res = await cloudClient.get('/social/requests/outgoing', { userId }) as any[];
    if (!Array.isArray(res)) return [];
    return res.map(f => typeof f === 'string' ? f : f.friendId).filter(Boolean);
  },

  addFriendRequest: async (userId: string, friendId: string): Promise<void> => {
    await cloudClient.post('/social/request', { userId, friendId });
  },

  acceptFriendRequest: async (userId: string, senderId: string): Promise<void> => {
    await cloudClient.post('/social/accept', { userId, senderId });
  },

  rejectFriendRequest: async (userId: string, senderId: string): Promise<void> => {
    await cloudClient.post('/social/reject', { userId, senderId });
  },

  // Challenges
  getChallenges: async (userId: string): Promise<SocialChallenge[]> => {
    return await cloudClient.get('/challenges', { userId }) as SocialChallenge[];
  },

  createChallenge: async (challenge: Partial<SocialChallenge>): Promise<SocialChallenge> => {
    return await cloudClient.post('/challenges', challenge) as SocialChallenge;
  },

  updateChallenge: async (id: string, updates: Partial<SocialChallenge>): Promise<SocialChallenge> => {
    return await cloudClient.put(`/challenges/${id}`, updates) as SocialChallenge;
  }
};
