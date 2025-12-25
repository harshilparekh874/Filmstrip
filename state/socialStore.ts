
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
  requestingIds: Set<string>; 

  fetchSocial: (userId: string, isSilent?: boolean) => Promise<void>;
  sendRequest: (userId: string, friendId: string) => Promise<void>;
  acceptRequest: (userId: string, senderId: string) => Promise<void>;
  rejectRequest: (userId: string, senderId: string) => Promise<void>;
  
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

  fetchSocial: async (userId: string, isSilent: boolean = false) => {
    if (!isSilent) set({ isLoading: true });
    try {
      const [friendIds, allUsers, activityFeed, pendingIds, outgoingIds, challenges] = await Promise.all([
        socialRepo.getFriendIds(userId).catch(() => []),
        userRepo.getUsers().catch(() => []),
        activityRepo.getActivityFeed(userId).catch(() => []),
        socialRepo.getPendingRequestIds(userId).catch(() => []),
        socialRepo.getOutgoingRequestIds(userId).catch(() => []),
        socialRepo.getChallenges(userId).catch(() => [])
      ]);
      
      const usersList = Array.isArray(allUsers) ? allUsers : [];
      const friends = friendIds.map(id => usersList.find(u => u.id === id)).filter(Boolean) as User[];
      
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
        outgoingRequests: outgoingIds, 
        challenges: Array.isArray(challenges) ? challenges : [], 
        isLoading: false 
      });
    } catch (err) {
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
        await get().fetchSocial(userId, true);
    } catch (err) {
        set(state => ({ outgoingRequests: state.outgoingRequests.filter(id => id !== friendId) }));
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
        await get().fetchSocial(userId, true);
    } catch (err) {}
  },

  rejectRequest: async (userId: string, senderId: string) => {
    try {
        await socialRepo.rejectFriendRequest(userId, senderId);
        await get().fetchSocial(userId, true);
    } catch (err) {}
  },

  createChallenge: async (challenge: Partial<SocialChallenge>) => {
    const movieIds = challenge.movieIds || [];
    let initialResults: any = {};

    if (challenge.type === 'BRACKET') {
      initialResults = {
        bracketState: {
          items: movieIds,
          winners: [],
          index: 0,
          round: 1
        }
      };
    } else if (challenge.type === 'GUESS_THE_MOVIE') {
      initialResults = {
        index: 0,
        correct: [],
        skipped: [],
        startTime: Date.now()
      };
    } else if (challenge.type === 'TIERLIST') {
      initialResults = {
        tierState: {
          queue: movieIds,
          tiers: {
            'S': [], 'A': [], 'B': [], 'C': [], 'D': []
          }
        }
      };
    }

    try {
      const res = await socialRepo.createChallenge({
        ...challenge,
        results: initialResults
      });
      
      const finalChallenge = Array.isArray(res) ? res[0] : res;

      if (!finalChallenge || !finalChallenge.id) {
          throw new Error("Invalid response from server during challenge creation");
      }
      
      set(state => ({ challenges: [...state.challenges, finalChallenge] }));
      return finalChallenge;
    } catch (err) {
      console.error("Store error during creation:", err);
      throw err;
    }
  },

  updateChallenge: async (id: string, updates: Partial<SocialChallenge>) => {
    const res = await socialRepo.updateChallenge(id, updates);
    const updated = Array.isArray(res) ? res[0] : res;
    set(state => ({
      challenges: state.challenges.map(c => c.id === id ? updated : c)
    }));
  },

  cancelChallenge: async (id: string) => {
    await socialRepo.deleteChallenge(id);
    set(state => ({
      challenges: state.challenges.filter(c => c.id !== id)
    }));
  }
}));
