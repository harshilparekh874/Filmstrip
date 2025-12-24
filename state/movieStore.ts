
import { create } from 'zustand';
import { Movie, UserMovieEntry, Recommendation } from '../core/types/models';
import { movieRepo } from '../data/repositories/movieRepo';
import { getRecommendations, findSimilarByGenre } from '../core/recommendations/engine';
import { tmdbApi } from '../data/api/tmdbApi';

export interface GroupedRecommendation {
  sourceMovie: Movie;
  sourceEntry: UserMovieEntry;
  movies: Movie[];
}

interface MovieState {
  movies: Movie[]; 
  userEntries: UserMovieEntry[];
  friendEntries: UserMovieEntry[];
  recommendations: Recommendation[];
  groupedRecommendations: GroupedRecommendation[];
  searchResults: Movie[]; 
  isLoading: boolean;
  isSearching: boolean;
  
  fetchData: (userId: string, force?: boolean) => Promise<void>;
  seedMovies: (newMovies: Movie[]) => void;
  search: (query: string) => Promise<void>;
  updateEntry: (entry: UserMovieEntry) => Promise<void>;
  deleteEntry: (userId: string, movieId: string) => Promise<void>;
  clearSearch: () => void;
}

export const useMovieStore = create<MovieState>((set, get) => ({
  movies: [],
  userEntries: [],
  friendEntries: [],
  recommendations: [],
  groupedRecommendations: [],
  searchResults: [],
  isLoading: false,
  isSearching: false,

  seedMovies: (newMovies: Movie[]) => {
    set(state => {
      const existingIds = new Set(state.movies.map(m => m.id));
      const filtered = newMovies.filter(m => !existingIds.has(m.id));
      if (filtered.length === 0) return state;
      return { movies: [...state.movies, ...filtered] };
    });
  },

  fetchData: async (userId: string, force: boolean = false) => {
    if (get().isLoading && !force) return;
    set({ isLoading: true });
    
    try {
      const [userEntries, popularMovies, friendEntries] = await Promise.all([
        movieRepo.getUserEntries(userId),
        movieRepo.getAllMovies(),
        movieRepo.getFriendEntries(userId)
      ]);

      const historyIds = new Set([
        ...userEntries.map(e => e.movieId),
        ...friendEntries.map(e => e.movieId)
      ]);
      
      const missingMovies = await Promise.all(
        Array.from(historyIds)
          .filter(id => !popularMovies.find(m => m.id === id))
          .map(id => movieRepo.getMovieById(id))
      );
      
      let pool = [...popularMovies, ...(missingMovies.filter(Boolean) as Movie[])];

      const lastThree = [...userEntries]
        .filter(e => e.status === 'WATCHED')
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 3);

      const similarBatches = await Promise.all(
        lastThree.map(e => tmdbApi.getSimilarMovies(e.movieId))
      );

      similarBatches.flat().forEach(m => {
        if (!pool.find(p => p.id === m.id)) pool.push(m);
      });

      const grouped = lastThree.map(e => {
        const src = pool.find(m => m.id === e.movieId);
        if (!src) return null;
        const matches = findSimilarByGenre(src, pool, 10);
        if (matches.length === 0) return null;
        return { sourceMovie: src, sourceEntry: e, movies: matches };
      }).filter(Boolean) as GroupedRecommendation[];

      set({ 
        movies: pool, 
        userEntries, 
        friendEntries, 
        recommendations: getRecommendations(pool, userEntries, friendEntries, userId),
        groupedRecommendations: grouped,
        isLoading: false 
      });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  search: async (query: string) => {
    if (!query) {
      set({ searchResults: [] });
      return;
    }
    set({ isSearching: true });
    try {
      const results = await movieRepo.searchMovies(query);
      set({ searchResults: results, isSearching: false });
    } catch (err) {
      set({ isSearching: false });
    }
  },

  clearSearch: () => set({ searchResults: [] }),

  updateEntry: async (entry: UserMovieEntry) => {
    const state = get();
    const updatedEntry = { ...entry, timestamp: entry.timestamp || Date.now() };
    
    let targetMovie = state.movies.find(m => m.id === updatedEntry.movieId) 
                   || state.searchResults.find(m => m.id === updatedEntry.movieId);
    
    if (!targetMovie) {
        targetMovie = await movieRepo.getMovieById(updatedEntry.movieId) || undefined;
    }

    const updatedPool = [...state.movies];
    if (targetMovie && !updatedPool.find(m => m.id === targetMovie.id)) {
        updatedPool.push(targetMovie);
    }

    if (updatedEntry.status === 'WATCHED' && targetMovie) {
        const related = await tmdbApi.getSimilarMovies(targetMovie.id);
        related.forEach(m => {
            if (!updatedPool.find(p => p.id === m.id)) updatedPool.push(m);
        });
    }

    const existingIndex = state.userEntries.findIndex(e => e.movieId === updatedEntry.movieId);
    let newEntries = [...state.userEntries];
    if (existingIndex > -1) newEntries[existingIndex] = updatedEntry;
    else newEntries.push(updatedEntry);
    
    const lastThree = newEntries
      .filter(e => e.status === 'WATCHED')
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 3);

    const newGrouped = lastThree.map(e => {
      const src = updatedPool.find(m => m.id === e.movieId);
      if (!src) return null;
      const matches = findSimilarByGenre(src, updatedPool, 10);
      if (matches.length === 0) return null;
      return { sourceMovie: src, sourceEntry: e, movies: matches };
    }).filter(Boolean) as GroupedRecommendation[];

    set({ 
      userEntries: newEntries, 
      movies: updatedPool,
      groupedRecommendations: newGrouped,
      recommendations: getRecommendations(updatedPool, newEntries, state.friendEntries, updatedEntry.userId)
    });

    movieRepo.updateEntry(updatedEntry);
  },

  deleteEntry: async (userId: string, movieId: string) => {
    const state = get();
    const newEntries = state.userEntries.filter(e => e.movieId !== movieId);
    set({ userEntries: newEntries });
    await movieRepo.deleteEntry(userId, movieId);
    get().fetchData(userId, true);
  }
}));
