
import { User, Movie, UserMovieEntry, Friendship, ActivityEvent } from '../../core/types/models';

const DB_KEYS = {
  USERS: 'reelreason_db_users',
  MOVIES: 'reelreason_db_movies',
  ENTRIES: 'reelreason_db_entries',
  FRIENDSHIPS: 'reelreason_db_friendships',
  ACTIVITY: 'reelreason_db_activity'
};

// Seed data only used if DB is empty
export const SEED_USERS: User[] = [
  { 
    id: 'u2', 
    email: 'ava@example.com',
    firstName: 'Ava',
    lastName: 'Montgomery',
    name: 'Ava Montgomery', 
    username: 'ava', 
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ava',
    favoriteGenres: ['Sci-Fi', 'Drama'],
    // Fix: Added missing properties required by User interface
    isVerified: true,
    createdAt: Date.now()
  },
  { 
    id: 'u3', 
    email: 'leo@example.com',
    firstName: 'Leo',
    lastName: 'Chen',
    name: 'Leo Chen', 
    username: 'leochen', 
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Leo',
    favoriteGenres: ['Action', 'Thriller'],
    // Fix: Added missing properties required by User interface
    isVerified: true,
    createdAt: Date.now()
  },
];

const load = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const save = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Database State
export let users: User[] = load(DB_KEYS.USERS, [...SEED_USERS]);
export let movies: Movie[] = load(DB_KEYS.MOVIES, []);
export let entries: UserMovieEntry[] = load(DB_KEYS.ENTRIES, []);
export let friendships: Friendship[] = load(DB_KEYS.FRIENDSHIPS, [
  { userId: 'current_user', friendId: 'u2', status: 'ACCEPTED' },
]);
export let activity: ActivityEvent[] = load(DB_KEYS.ACTIVITY, []);

export const syncDb = () => {
  save(DB_KEYS.USERS, users);
  save(DB_KEYS.MOVIES, movies);
  save(DB_KEYS.ENTRIES, entries);
  save(DB_KEYS.FRIENDSHIPS, friendships);
  save(DB_KEYS.ACTIVITY, activity);
};

export const delay = (ms = 400) => new Promise(res => setTimeout(res, ms));

export const addUserToDb = (user: User) => {
  const idx = users.findIndex(u => u.id === user.id);
  if (idx > -1) {
    users[idx] = user;
  } else {
    users.push(user);
  }
  syncDb();
};

export const addMovieToDb = (movie: Movie) => {
  if (!movies.find(m => m.id === movie.id)) {
    movies.push(movie);
    syncDb();
  }
};

export const addActivityToDb = (event: ActivityEvent) => {
  activity.unshift(event);
  if (activity.length > 100) activity.pop(); // Cap feed size
  syncDb();
};
