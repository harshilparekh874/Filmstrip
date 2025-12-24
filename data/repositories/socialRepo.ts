
import { cloudClient } from '../api/cloudClient';
import { SocialChallenge } from '../../core/types/models';

export const socialRepo = {
  getFriendIds: async (userId: string): Promise<string[]> => {
    const res = await cloudClient.get('/social/friends', { userId }) as any[];
    if (!Array.isArray(res)) return [];
    
    // In an accepted friendship, 'userId' or 'friendId' could be the other person.
    return res.map(f => f.userId === userId ? f.friendId : f.userId).filter(Boolean);
  },

  getPendingRequestIds: async (userId: string): Promise<string[]> => {
    const res = await cloudClient.get('/social/requests/pending', { userId }) as any[];
    if (!Array.isArray(res)) return [];
    
    // In a pending request sent TO me, 'userId' is the sender.
    return res.map(f => f.userId || f.id).filter(Boolean);
  },

  getOutgoingRequestIds: async (userId: string): Promise<string[]> => {
    const res = await cloudClient.get('/social/requests/outgoing', { userId }) as any[];
    if (!Array.isArray(res)) return [];
    
    // In an outgoing request sent BY me, 'friendId' is the person I'm following.
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
