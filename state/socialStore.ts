
import { create } from 'zustand';
import { User, ActivityEvent, SocialChallenge } from '../core/types/models';
import { socialRepo } from '../data/repositories/socialRepo';
import { userRepo } from '../data/repositories/userRepo';
import { activityRepo } from '../data/repositories/activityRepo';

interface SocialState {
  friends: User[];
  allUsers: User[];
  pendingRequests: { id: string, from: User }[];
  outgoingRequests: string[];
  activityFeed: ActivityEvent[];
  challenges: SocialChallenge[];
  isLoading: boolean;
  requestingIds: Set<string>; // Track in-flight requests

  fetchSocial: (userId: string) => Promise<void>;
  sendRequest: (userId: string, friendId: string) => Promise<void>;
  acceptRequest: (userId: string, senderId: string) => Promise<void>;
  rejectRequest: (userId: string, senderId: string) => Promise<void>;
  
  // Challenges
  createChallenge: (challenge: Partial<SocialChallenge>) => Promise<SocialChallenge>;
  updateChallenge: (id: string, updates: Partial<SocialChallenge>) => Promise<void>;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  friends: [],
  allUsers: [],
  pendingRequests: [],
  outgoingRequests: [],
  activityFeed: [],
  challenges: [],
  isLoading: false,
  requestingIds: new Set(),

  fetchSocial: async (userId: string) => {
    set({ isLoading: true });
    try {
      const [friends, allUsers, activityFeed, pendingRequests, outgoingRequests, challenges] = await Promise.all([
        socialRepo.getFriends(userId).catch(() => []),
        userRepo.getUsers().catch(() => []),
        activityRepo.getActivityFeed(userId).catch(() => []),
        socialRepo.getPendingRequests(userId).catch(() => []),
        socialRepo.getOutgoingRequests(userId).catch(() => []),
        socialRepo.getChallenges(userId).catch(() => [])
      ]);
      
      set({ 
        friends: Array.isArray(friends) ? friends : [], 
        allUsers: Array.isArray(allUsers) ? allUsers : [], 
        activityFeed: Array.isArray(activityFeed) ? activityFeed : [], 
        pendingRequests: Array.isArray(pendingRequests) ? pendingRequests : [], 
        outgoingRequests: Array.isArray(outgoingRequests) ? outgoingRequests : [], 
        challenges: Array.isArray(challenges) ? challenges : [], 
        isLoading: false 
      });
    } catch (err) {
      console.error("Social fetch failed", err);
      set({ isLoading: false });
    }
  },

  sendRequest: async (userId: string, friendId: string) => {
    // Prevent double clicking
    if (get().requestingIds.has(friendId)) return;
    
    set(state => ({ requestingIds: new Set(state.requestingIds).add(friendId) }));
    
    try {
        await socialRepo.addFriendRequest(userId, friendId);
        const outgoingRequests = await socialRepo.getOutgoingRequests(userId);
        set({ outgoingRequests: Array.isArray(outgoingRequests) ? outgoingRequests : [] });
    } catch (err) {
        console.error("Failed to send request:", err);
    } finally {
        set(state => {
            const next = new Set(state.requestingIds);
            next.delete(friendId);
            return { requestingIds: next };
        });
    }
  },

  acceptRequest: async (userId: string, senderId: string) => {
    await socialRepo.acceptFriendRequest(userId, senderId);
    const [friends, activityFeed, pendingRequests] = await Promise.all([
      socialRepo.getFriends(userId),
      activityRepo.getActivityFeed(userId),
      socialRepo.getPendingRequests(userId)
    ]);
    set({ 
      friends: Array.isArray(friends) ? friends : [], 
      activityFeed: Array.isArray(activityFeed) ? activityFeed : [], 
      pendingRequests: Array.isArray(pendingRequests) ? pendingRequests : [] 
    });
  },

  rejectRequest: async (userId: string, senderId: string) => {
    await socialRepo.rejectFriendRequest(userId, senderId);
    const pendingRequests = await socialRepo.getPendingRequests(userId);
    set({ pendingRequests: Array.isArray(pendingRequests) ? pendingRequests : [] });
  },

  createChallenge: async (challenge: Partial<SocialChallenge>) => {
    const res = await socialRepo.createChallenge(challenge);
    set(state => ({ challenges: [...state.challenges, res] }));
    return res;
  },

  updateChallenge: async (id: string, updates: Partial<SocialChallenge>) => {
    const res = await socialRepo.updateChallenge(id, updates);
    set(state => ({
      challenges: state.challenges.map(c => c.id === id ? res : c)
    }));
  }
}));
