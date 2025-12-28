
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
  createdAt: number | string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath?: string;
}

export interface Movie {
  id: string;
  title: string;
  year: number;
  posterUrl?: string;
  genres: string[];
  runtimeMins?: number;
  overview?: string;
  tagline?: string;
  cast?: CastMember[];
}

export interface UserMovieEntry {
  userId: string;
  movieId: string;
  status: WatchStatus;
  rating?: number;
  droppedReason?: string;
  droppedAtTimestamp?: number | string;
  watchedAtTimestamp?: number | string;
  notes?: string;
  timestamp?: number | string;
}

export interface Friendship {
  userId: string;
  friendId: string;
  status: 'PENDING' | 'ACCEPTED';
}

export type ChallengeType = 'BRACKET' | 'TIERLIST' | 'GUESS_THE_MOVIE';
export type ChallengeStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED';

export interface SocialChallenge {
  id: string;
  creatorId: string;
  recipientId: string;
  turnUserId: string; 
  type: ChallengeType;
  size: 5 | 10 | 16 | 20 | 32 | 50 | 64;
  status: ChallengeStatus;
  movieIds: string[];
  results?: any; 
  config?: {
    timeLimitMins?: number;
  };
  timestamp: number | string;
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
  timestamp: number | string;
}

export interface Recommendation {
  movieId: string;
  score: number;
  reasons: string[];
}
