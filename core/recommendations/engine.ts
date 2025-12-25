
import { Movie, UserMovieEntry, Recommendation, User } from '../types/models';
import { GoogleGenAI } from '@google/genai';

export const getRecommendations = (
  allMovies: Movie[],
  userEntries: UserMovieEntry[],
  friendEntries: UserMovieEntry[],
  currentUserId: string
): Recommendation[] => {
  const recommendations: Recommendation[] = [];
  const seenMovieIds = new Set(userEntries.map(e => e.movieId));
  
  const watchedMovies = allMovies.filter(m => userEntries.some(e => e.movieId === m.id && e.status === 'WATCHED'));
  const genreWeights: Record<string, number> = {};
  watchedMovies.flatMap(m => m.genres).forEach(g => {
    genreWeights[g] = (genreWeights[g] || 0) + 1;
  });

  allMovies.forEach(movie => {
    if (seenMovieIds.has(movie.id)) return;
    let score = 0;
    const reasons: string[] = [];

    const friendWatchers = friendEntries.filter(fe => fe.movieId === movie.id && fe.status === 'WATCHED');
    if (friendWatchers.length > 0) {
      score += friendWatchers.length * 5;
      reasons.push(`${friendWatchers.length} friends liked this.`);
    }

    let genreScore = 0;
    movie.genres.forEach(g => {
      if (genreWeights[g]) genreScore += genreWeights[g];
    });

    if (genreScore > 0) {
      score += genreScore * 2;
      reasons.push(`Matches your genre taste.`);
    }

    if (score === 0) {
        score = 1;
        reasons.push("Trending now.");
    }

    recommendations.push({
      movieId: movie.id,
      score,
      reasons: Array.from(new Set(reasons)).slice(0, 2)
    });
  });

  return recommendations.sort((a, b) => b.score - a.score).slice(0, 15);
};

export const findSimilarByGenre = (source: Movie, pool: Movie[], count = 10): Movie[] => {
  if (!source || !source.genres || source.genres.length === 0) return [];
  const sourceGenres = new Set(source.genres.map(g => g.toLowerCase()));
  const threshold = source.genres.length >= 2 ? 2 : 1;

  return pool
    .filter(m => m.id !== source.id) 
    .map(m => {
      const matches = m.genres.filter(g => sourceGenres.has(g.toLowerCase()));
      return { movie: m, matchCount: matches.length };
    })
    .filter(x => x.matchCount >= threshold) 
    .sort((a, b) => b.matchCount - a.matchCount) 
    .slice(0, count)
    .map(x => x.movie);
};

export const generateFormalGroupReasons = async (
  sourceMovie: Movie,
  sourceEntry: UserMovieEntry,
  targetMovies: Movie[],
  user: User
): Promise<Record<string, string>> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || targetMovies.length === 0) return {};

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const prompt = `
      Task: Movie link justification.
      User: ${user.name}
      Base Movie: ${sourceMovie.title} (${sourceMovie.year})
      
      Explain why someone who liked "${sourceMovie.title}" would enjoy these specifically:
      ${targetMovies.map(m => `- ${m.title}`).join('\n')}
      
      Return a clean JSON object: { "Movie Title": "One short sentence link" }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    // Directly access .text property
    let rawText = response.text || '{}';
    if (rawText.includes('```json')) {
      rawText = rawText.split('```json')[1].split('```')[0].trim();
    }
    
    return JSON.parse(rawText);
  } catch (err) {
    return {};
  }
};

export const generateDetailReason = async (
  movie: Movie,
  user: User,
  userEntries: UserMovieEntry[],
  allMovies: Movie[]
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return '';

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const prompt = `Why should ${user.name} watch ${movie.title}? They love ${user.favoriteGenres.join(', ')}. Short one sentence.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || 'Matches your patterns.';
  } catch (err) {
    return 'Analysis based on preference patterns.';
  }
};
