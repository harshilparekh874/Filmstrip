
export type WatchStatus = 'WATCHED' | 'WATCH_LATER' | 'DROPPED';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  username: string;
  avatarUrl: string;
  favoriteGenres: string[];
  favoriteMovieId?: string;
  isVerified: boolean;
  token?: string;
  createdAt: number;
}

export interface Movie {
  id: string;
  title: string;
  year: number;
  posterUrl?: string;
  genres: string[];
  runtimeMins?: number;
}

export interface UserMovieEntry {
  userId: string;
  movieId: string;
  status: WatchStatus;
  rating?: number;
  droppedReason?: string;
  droppedAtTimestamp?: number;
  watchedAtTimestamp?: number;
  notes?: string;
  timestamp?: number;
}

export interface Friendship {
  userId: string;
  friendId: string;
  status: 'PENDING' | 'ACCEPTED';
}

export type ChallengeType = 'BRACKET' | 'TIERLIST';
export type ChallengeStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED';

export interface SocialChallenge {
  id: string;
  creatorId: string;
  recipientId: string;
  turnUserId: string; // Whose turn it is
  type: ChallengeType;
  size: 10 | 16 | 20 | 32 | 50 | 64;
  status: ChallengeStatus;
  movieIds: string[];
  results?: any; // Stores multiplayer game state
  timestamp: number;
}

export type ActivityEventType = 'WATCHED' | 'DROPPED' | 'WATCH_LATER' | 'RATED' | 'FRIEND_ADDED' | 'CHALLENGE_COMPLETED';

export interface ActivityEvent {
  id: string;
  userId: string;
  type: ActivityEventType;
  movieId?: string;
  metadata?: {
    droppedReason?: string;
    rating?: number;
    friendId?: string;
    challengeType?: ChallengeType;
    challengeId?: string;
  };
  timestamp: number;
}

export interface Recommendation {
  movieId: string;
  score: number;
  reasons: string[];
}
