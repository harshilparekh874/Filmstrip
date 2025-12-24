
import { cloudClient } from '../api/cloudClient';
import { tmdbApi } from '../api/tmdbApi';
import { Movie, UserMovieEntry } from '../../core/types/models';

export const movieRepo = {
  getAllMovies: async (): Promise<Movie[]> => {
    // Fetch a pool of popular movies to fuel the recommendation engine
    try {
      return await tmdbApi.getPopularMovies();
    } catch (err) {
      console.error("Failed to fetch movie pool", err);
      return [];
    }
  },

  getMovieById: async (id: string): Promise<Movie | undefined> => {
    if (id.startsWith('tmdb-')) {
      return await tmdbApi.getMovieDetails(id) || undefined;
    }
    return undefined;
  },

  searchMovies: async (query: string): Promise<Movie[]> => {
    return await tmdbApi.searchMovies(query);
  },

  getUserEntries: async (userId: string): Promise<UserMovieEntry[]> => {
    return await cloudClient.get('/entries', { userId }) as UserMovieEntry[];
  },

  getFriendEntries: async (userId: string): Promise<UserMovieEntry[]> => {
    const allEntries = await cloudClient.get('/entries') as UserMovieEntry[];
    return allEntries.filter(e => e.userId !== userId);
  },

  updateEntry: async (entry: UserMovieEntry): Promise<void> => {
    await cloudClient.post('/entries', entry);
  },

  deleteEntry: async (userId: string, movieId: string): Promise<void> => {
    await cloudClient.delete(`/entries?userId=${userId}&movieId=${movieId}`);
  }
};
