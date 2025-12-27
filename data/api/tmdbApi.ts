
import { Movie, CastMember } from '../../core/types/models';

const TMDB_API_KEY: string = 'd7c9932ca6eaed0388919da906dcedc0';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

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
  const isTv = m.media_type === 'tv' || (!m.title && m.name);
  const dateStr = isTv ? m.first_air_date : m.release_date;
  
  const resolvedGenres = m.genres 
    ? m.genres.map((g: any) => {
        const name = typeof g === 'string' ? g : g.name;
        return name === 'Science Fiction' ? 'Sci-Fi' : name;
      })
    : (m.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean);

  // VIRTUAL GENRE INJECTION: Handle Hindi language specifically
  if (m.original_language === 'hi' && !resolvedGenres.includes('Hindi Language')) {
    resolvedGenres.unshift('Hindi Language');
  }

  const cast: CastMember[] = m.credits?.cast?.slice(0, 10).map((c: any) => ({
    id: c.id,
    name: c.name,
    character: c.character,
    profilePath: c.profile_path ? `${IMAGE_BASE_URL}${c.profile_path}` : undefined
  })) || [];

  return {
    id: `tmdb-${isTv ? 'tv' : 'movie'}-${m.id}`,
    title: isTv ? m.name : m.title,
    year: dateStr ? new Date(dateStr).getFullYear() : 0,
    posterUrl: m.poster_path ? `${IMAGE_BASE_URL}${m.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Poster',
    genres: resolvedGenres,
    runtimeMins: m.runtime || (m.episode_run_time ? m.episode_run_time[0] : 0),
    overview: m.overview || '',
    tagline: m.tagline || '',
    cast: cast
  };
};

export const tmdbApi = {
  getPopularMovies: async (): Promise<Movie[]> => {
    const pages = [1, 2, 3];
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
    const m = await fetchTmdb(`/${type}/${numericId}?language=en-US&append_to_response=credits`);
    return mapToMovie({ ...m, media_type: type });
  },

  getSimilarMovies: async (tmdbId: string): Promise<Movie[]> => {
    const parts = tmdbId.split('-');
    const type = parts[1] === 'tv' ? 'tv' : 'movie';
    const numericId = parts[2];
    
    const source = await tmdbApi.getMovieDetails(tmdbId);
    if (!source) return [];

    const [similarData, recsData] = await Promise.all([
      fetchTmdb(`/${type}/${numericId}/similar?language=en-US&page=1`),
      fetchTmdb(`/${type}/${numericId}/recommendations?language=en-US&page=1`)
    ]);

    const rawResults = [...(similarData.results || []), ...(recsData.results || [])];
    const seen = new Set<number>();
    const moviePool = rawResults
        .filter(m => {
          if (seen.has(m.id) || m.id.toString() === numericId) return false;
          seen.add(m.id);
          return true;
        })
        .map(m => mapToMovie({ ...m, media_type: type }));

    return moviePool
      .map(target => {
        let score = 0;
        const commonGenres = target.genres.filter(g => source.genres.includes(g));
        score += commonGenres.length * 15;
        
        const isAnimationSource = source.genres.includes('Animation');
        const isAnimationTarget = target.genres.includes('Animation');
        const isHindiSource = source.genres.includes('Hindi Language');
        const isHindiTarget = target.genres.includes('Hindi Language');

        if (isAnimationSource) {
           if (isAnimationTarget) score += 100;
           else score -= 80;
        }

        // Keep Hindi language with Hindi language if it's a core preference
        if (isHindiSource && isHindiTarget) score += 150;

        const yearDiff = Math.abs(source.year - target.year);
        if (yearDiff <= 3) score += 50;
        else if (yearDiff <= 10) score += 30;
        else if (yearDiff >= 30) score -= 60;
        else if (yearDiff >= 50) score -= 150;

        if (source.year > 2000 && target.year < 1980) score -= 100;

        return { movie: target, score };
      })
      .sort((a, b) => b.score - a.score)
      .filter(item => item.score > -50)
      .map(item => item.movie);
  }
};
