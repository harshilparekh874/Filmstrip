
import { cloudClient } from '../api/cloudClient';
import { User, SocialChallenge } from '../../core/types/models';

export const socialRepo = {
  getFriends: async (userId: string): Promise<User[]> => {
    return await cloudClient.get('/social/friends', { userId }) as User[];
  },

  getPendingRequests: async (userId: string): Promise<{ id: string, from: User }[]> => {
    const res = await cloudClient.get('/social/requests/pending', { userId }) as any[];
    // Supabase returns an array of friendship objects, we need to map to the UI format
    return res.map(f => ({
      id: f.userId, // The ID of the person who sent it
      from: f.from || { id: f.userId, name: 'Unknown User' } // Fallback if join didn't happen
    }));
  },

  getOutgoingRequests: async (userId: string): Promise<string[]> => {
    const res = await cloudClient.get('/social/requests/outgoing', { userId }) as any[];
    // Supabase returns objects [{friendId: '...'}], we need just the strings
    return Array.isArray(res) ? res.map(f => f.friendId) : [];
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
