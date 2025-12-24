
import { Movie } from '../../core/types/models';

/**
 * TMDB API - Production Bridge
 * In Production: Route these through your backend to hide the API KEY.
 */
const TMDB_API_KEY: string = 'd7c9932ca6eaed0388919da906dcedc0';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Change this to true if you have implemented a proxy route on your real backend
const USE_PROXY = !!(import.meta as any).env?.VITE_API_URL;

const fetchTmdb = async (endpoint: string) => {
  if (USE_PROXY) {
    const apiUrl = (import.meta as any).env.VITE_API_URL;
    const response = await fetch(`${apiUrl}/tmdb/proxy?endpoint=${encodeURIComponent(endpoint)}`);
    return response.json();
  }
  
  const response = await fetch(`${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`);
  return response.json();
};

const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

const mapToMovie = (m: any): Movie => {
  const isTv = m.media_type === 'tv' || !m.title;
  const dateStr = isTv ? m.first_air_date : m.release_date;
  
  const resolvedGenres = m.genres 
    ? m.genres.map((g: any) => {
        const name = typeof g === 'string' ? g : g.name;
        return name === 'Science Fiction' ? 'Sci-Fi' : name;
      })
    : (m.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean);

  return {
    id: `tmdb-${isTv ? 'tv' : 'movie'}-${m.id}`,
    title: isTv ? m.name : m.title,
    year: dateStr ? new Date(dateStr).getFullYear() : 0,
    posterUrl: m.poster_path ? `${IMAGE_BASE_URL}${m.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Poster',
    genres: resolvedGenres,
    runtimeMins: 0
  };
};

export const tmdbApi = {
  getPopularMovies: async (): Promise<Movie[]> => {
    // Fetch 5 pages to get the Top 100
    const pages = [1, 2, 3, 4, 5];
    const results = await Promise.all(
        pages.map(page => fetchTmdb(`/trending/all/week?page=${page}`))
    );
    
    const allResults = results.flatMap(r => r.results || []);
    const seen = new Set();
    
    return allResults
        .filter(m => {
            const duplicate = seen.has(m.id);
            seen.add(m.id);
            return !duplicate && (m.media_type === 'movie' || m.media_type === 'tv');
        })
        .map(mapToMovie);
  },

  getTopRatedMovies: async (page = 1): Promise<Movie[]> => {
    const data = await fetchTmdb(`/movie/top_rated?language=en-US&page=${page}`);
    return (data.results || []).map(m => mapToMovie({ ...m, media_type: 'movie' }));
  },

  searchMovies: async (query: string): Promise<Movie[]> => {
    if (!query) return [];
    const data = await fetchTmdb(`/search/multi?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`);
    return (data.results || [])
      .filter((m: any) => m.media_type === 'movie' || m.media_type === 'tv')
      .map(mapToMovie);
  },

  getMovieDetails: async (tmdbId: string): Promise<Movie | null> => {
    const parts = tmdbId.split('-');
    const type = parts[1] === 'tv' ? 'tv' : 'movie';
    const numericId = parts[2];
    const m = await fetchTmdb(`/${type}/${numericId}?language=en-US`);
    return mapToMovie({ ...m, media_type: type });
  },

  getSimilarMovies: async (tmdbId: string): Promise<Movie[]> => {
    const parts = tmdbId.split('-');
    const type = parts[1] === 'tv' ? 'tv' : 'movie';
    const numericId = parts[2];
    const data = await fetchTmdb(`/${type}/${numericId}/recommendations?language=en-US&page=1`);
    return (data.results || []).slice(0, 20).map(m => mapToMovie({ ...m, media_type: type }));
  }
};
