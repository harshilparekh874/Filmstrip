
import { cloudClient } from '../api/cloudClient';
import { User, SocialChallenge } from '../../core/types/models';

export const socialRepo = {
  getFriends: async (userId: string): Promise<User[]> => {
    const rawFriends = await cloudClient.get('/social/friends', { userId }) as any[];
    if (!Array.isArray(rawFriends)) return [];
    
    // Normalize response: Mock DB returns full users, Supabase returns friendship objects if joined incorrectly
    // But our current cloudClient GET /social/friends with ACCEPTED filter should return user objects directly
    // based on our manual matching in cloudClient.
    return rawFriends as User[];
  },

  getPendingRequests: async (userId: string): Promise<{ id: string }[]> => {
    const res = await cloudClient.get('/social/requests/pending', { userId }) as any[];
    if (!Array.isArray(res)) return [];
    
    // In a pending request, 'userId' is the sender. 
    // We return their ID so the recipient can look them up in the allUsers list.
    return res.map(f => ({
      id: f.userId || f.id
    })).filter(r => r.id);
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
