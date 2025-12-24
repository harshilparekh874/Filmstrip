
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
      // Parallel fetch of all social data
      const [friends, allUsers, activityFeed, rawPending, outgoingRequests, challenges] = await Promise.all([
        socialRepo.getFriends(userId).catch(() => []),
        userRepo.getUsers().catch(() => []),
        activityRepo.getActivityFeed(userId).catch(() => []),
        socialRepo.getPendingRequests(userId).catch(() => []),
        socialRepo.getOutgoingRequests(userId).catch(() => []),
        socialRepo.getChallenges(userId).catch(() => [])
      ]);
      
      const usersList = Array.isArray(allUsers) ? allUsers : [];
      
      // Enrich pending requests with sender user details
      const enrichedPending = (Array.isArray(rawPending) ? rawPending : []).map(req => {
          const sender = usersList.find(u => u.id === req.id);
          return {
              id: req.id,
              from: sender || req.from || { id: req.id, name: 'New Request', avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${req.id}` }
          };
      });
      
      set({ 
        friends: Array.isArray(friends) ? friends : [], 
        allUsers: usersList, 
        activityFeed: Array.isArray(activityFeed) ? activityFeed : [], 
        pendingRequests: enrichedPending, 
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
    if (get().requestingIds.has(friendId)) return;
    
    // Optimistic Update: Mark as sent immediately to avoid double clicks
    set(state => ({ 
        requestingIds: new Set(state.requestingIds).add(friendId),
        outgoingRequests: Array.from(new Set([...state.outgoingRequests, friendId]))
    }));
    
    try {
        await socialRepo.addFriendRequest(userId, friendId);
        // Refresh social state to sync with server
        await get().fetchSocial(userId);
    } catch (err: any) {
        // If it's a conflict error (already exists), we don't rollback
        if (err.message?.includes('duplicate key')) {
            await get().fetchSocial(userId);
            return;
        }

        console.error("Failed to send request:", err);
        // Rollback only on real network/logic failures
        set(state => ({
            outgoingRequests: state.outgoingRequests.filter(id => id !== friendId)
        }));
        alert(`Follow Failed: ${err.message || 'Check connection'}`);
    } finally {
        set(state => {
            const next = new Set(state.requestingIds);
            next.delete(friendId);
            return { requestingIds: next };
        });
    }
  },

  acceptRequest: async (userId: string, senderId: string) => {
    try {
        await socialRepo.acceptFriendRequest(userId, senderId);
        await get().fetchSocial(userId);
    } catch (err) {
        console.error("Failed to accept request:", err);
    }
  },

  rejectRequest: async (userId: string, senderId: string) => {
    try {
        await socialRepo.rejectFriendRequest(userId, senderId);
        await get().fetchSocial(userId);
    } catch (err) {
        console.error("Failed to reject request:", err);
    }
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
