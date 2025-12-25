
import { create } from 'zustand';
import { Movie, UserMovieEntry, Recommendation } from '../core/types/models';
import { movieRepo } from '../data/repositories/movieRepo';
import { getRecommendations, findSimilarByGenre } from '../core/recommendations/engine';
import { tmdbApi } from '../data/api/tmdbApi';
import { LetterboxdMovie } from '../core/utils/csvParser';

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
  batchImportWatched: (userId: string, lbMovies: LetterboxdMovie[], onProgress: (p: number) => void) => Promise<void>;
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

      const sortedUserEntries = userEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const historyIds = new Set([...sortedUserEntries.map(e => e.movieId), ...friendEntries.map(e => e.movieId)]);
      
      const missingMovies = await Promise.all(
        Array.from(historyIds).filter(id => !popularMovies.find(m => m.id === id)).map(id => movieRepo.getMovieById(id))
      );
      
      let pool = [...popularMovies, ...(missingMovies.filter(Boolean) as Movie[])];

      const lastThree = [...sortedUserEntries]
        .filter(e => e.status === 'WATCHED')
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 3);

      const similarBatches = await Promise.all(lastThree.map(e => tmdbApi.getSimilarMovies(e.movieId)));
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
        userEntries: sortedUserEntries, 
        friendEntries, 
        recommendations: getRecommendations(pool, sortedUserEntries, friendEntries, userId),
        groupedRecommendations: grouped,
        isLoading: false 
      });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  search: async (query: string) => {
    if (!query) { set({ searchResults: [] }); return; }
    set({ isSearching: true });
    try {
      const results = await movieRepo.searchMovies(query);
      set({ searchResults: results, isSearching: false });
    } catch (err) { set({ isSearching: false }); }
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
    if (targetMovie && !updatedPool.find(m => m.id === targetMovie.id)) updatedPool.push(targetMovie);

    if (updatedEntry.status === 'WATCHED' && targetMovie) {
        const related = await tmdbApi.getSimilarMovies(targetMovie.id);
        related.forEach(m => {
            if (!updatedPool.find(p => p.id === m.id)) updatedPool.push(m);
        });
    }

    const existingIndex = state.userEntries.findIndex(e => e.movieId === updatedEntry.movieId);
    let newEntries = [...state.userEntries];
    if (existingIndex > -1) newEntries[existingIndex] = updatedEntry;
    else newEntries.unshift(updatedEntry);
    
    newEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const lastThree = newEntries.filter(e => e.status === 'WATCHED').slice(0, 3);
    const newGrouped = lastThree.map(e => {
      const src = updatedPool.find(m => m.id === e.movieId);
      if (!src) return null;
      const matches = findSimilarByGenre(src, updatedPool, 10);
      return { sourceMovie: src, sourceEntry: e, movies: matches };
    }).filter(g => g && g.movies.length > 0) as GroupedRecommendation[];

    set({ 
      userEntries: newEntries, 
      movies: updatedPool,
      groupedRecommendations: newGrouped,
      recommendations: getRecommendations(updatedPool, newEntries, state.friendEntries, updatedEntry.userId)
    });

    movieRepo.updateEntry(updatedEntry);
  },

  batchImportWatched: async (userId: string, lbMovies: LetterboxdMovie[], onProgress: (p: number) => void) => {
    set({ isLoading: true });
    let completed = 0;
    
    await get().fetchData(userId, true);
    const existingMovieIds = new Set(get().userEntries.map(e => e.movieId));
    
    for (let i = 0; i < lbMovies.length; i++) {
      const lb = lbMovies[i];
      try {
        /**
         * ROBUST DISAMBIGUATION LOGIC
         * 1. Search TMDB using the Movie Title from CSV as a clean string.
         */
        const results = await tmdbApi.searchMovies(lb.name);
        
        /**
         * 2. Verification Step:
         * We look through the results to find a movie that matches the YEAR 
         * defined in the CSV column. This prevents "Parasite" (1982) from 
         * being selected if your CSV says "Parasite" (2019).
         */
        let match = null;
        if (results.length > 0) {
          if (lb.year > 0) {
            // Find EXACT year match
            match = results.find(m => m.year === lb.year);
            
            // If no exact match (sometimes release dates vary by 1 year in different countries),
            // check within a 1-year window.
            if (!match) {
              match = results.find(m => Math.abs(m.year - lb.year) <= 1);
            }
          }
          
          // If we still have no year match, or the CSV lacked a year,
          // we only pick the first result if the title is an exact case-insensitive match.
          if (!match && results[0].title.toLowerCase() === lb.name.toLowerCase()) {
            match = results[0];
          }
        }
        
        if (match && !existingMovieIds.has(match.id)) {
          const parsedDate = new Date(lb.dateWatched);
          const baseTime = isNaN(parsedDate.getTime()) ? Date.now() : parsedDate.getTime();
          
          // Row offset ensures original CSV order is preserved even for same-day watches.
          const finalTimestamp = baseTime - (i * 1000);

          const entry: UserMovieEntry = {
            userId,
            movieId: match.id,
            status: 'WATCHED',
            timestamp: finalTimestamp
          };
          
          await get().updateEntry(entry);
          existingMovieIds.add(match.id);
        }
      } catch (err) {
        console.warn(`Failed to sync: ${lb.name}`, err);
      }
      completed++;
      onProgress(Math.floor((completed / lbMovies.length) * 100));
    }

    set({ isLoading: false });
    await get().fetchData(userId, true);
  },

  deleteEntry: async (userId: string, movieId: string) => {
    const state = get();
    const newEntries = state.userEntries.filter(e => e.movieId !== movieId);
    set({ userEntries: newEntries });
    await movieRepo.deleteEntry(userId, movieId);
    get().fetchData(userId, true);
  }
}));
