
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
  cancelChallenge: (id: string) => Promise<void>;
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
      // Parallel fetch of all raw IDs and global user list
      const [friendIds, allUsers, activityFeed, pendingIds, outgoingIds, challenges] = await Promise.all([
        socialRepo.getFriendIds(userId).catch(() => []),
        userRepo.getUsers().catch(() => []),
        activityRepo.getActivityFeed(userId).catch(() => []),
        socialRepo.getPendingRequestIds(userId).catch(() => []),
        socialRepo.getOutgoingRequestIds(userId).catch(() => []),
        socialRepo.getChallenges(userId).catch(() => [])
      ]);
      
      const usersList = Array.isArray(allUsers) ? allUsers : [];
      
      // HYDRATION: Map IDs to full User objects
      const friends = friendIds.map(id => usersList.find(u => u.id === id)).filter(Boolean) as User[];
      const outgoingRequests = outgoingIds;
      
      const pendingRequests = pendingIds.map(id => {
          const sender = usersList.find(u => u.id === id);
          return {
              id: id,
              from: sender || { 
                id: id, 
                name: 'New Connection', 
                avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${id}`,
                username: 'user'
              } as User
          };
      });
      
      set({ 
        friends, 
        allUsers: usersList, 
        activityFeed: Array.isArray(activityFeed) ? activityFeed : [], 
        pendingRequests, 
        outgoingRequests, 
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
    
    set(state => ({ 
        requestingIds: new Set(state.requestingIds).add(friendId),
        outgoingRequests: Array.from(new Set([...state.outgoingRequests, friendId]))
    }));
    
    try {
        await socialRepo.addFriendRequest(userId, friendId);
        await get().fetchSocial(userId);
    } catch (err: any) {
        if (err.message?.includes('duplicate key')) {
            await get().fetchSocial(userId);
            return;
        }
        console.error("Failed to send request:", err);
        set(state => ({
            outgoingRequests: state.outgoingRequests.filter(id => id !== friendId)
        }));
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
  },

  cancelChallenge: async (id: string) => {
    await socialRepo.deleteChallenge(id);
    set(state => ({
      challenges: state.challenges.filter(c => c.id !== id)
    }));
  }
}));
