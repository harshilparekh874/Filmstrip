
import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../../state/authStore';
import { useMovieStore, GroupedRecommendation } from '../../state/movieStore';
import { MovieCard } from '../components/MovieCard';
import { generateFormalGroupReasons } from '../../core/recommendations/engine';

const RecommendationRow: React.FC<{ group: GroupedRecommendation }> = ({ group }) => {
  const { user } = useAuthStore();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    const fetchReasons = async () => {
      if (!user || group.movies.length === 0) return;
      setLoadingAI(true);
      try {
        const res = await generateFormalGroupReasons(group.sourceMovie, group.sourceEntry, group.movies, user);
        setReasons(res);
      } catch (err) {
        console.warn("AI reasoning unavailable.");
      } finally {
        setLoadingAI(false);
      }
    };
    fetchReasons();
  }, [group, user]);

  return (
    <section className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Because you watched <span className="text-indigo-600 dark:text-indigo-400">"{group.sourceMovie.title}"</span>
        </h2>
        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-6 gap-y-10">
        {group.movies.map(movie => {
          const matchCount = movie.genres.filter(g => group.sourceMovie.genres.includes(g)).length;
          const defaultLabel = `${matchCount} Genre match${matchCount > 1 ? 'es' : ''}`;
          
          return (
            <MovieCard 
              key={movie.id} 
              movie={movie} 
              subtitle={reasons[movie.title] || (loadingAI ? 'Scanning patterns...' : defaultLabel)}
            />
          );
        })}
      </div>
    </section>
  );
};

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    movies, 
    recommendations, 
    groupedRecommendations,
    userEntries, 
    searchResults, 
    isLoading, 
    isSearching, 
    fetchData, 
    search, 
    clearSearch 
  } = useMovieStore();
  
  const [query, setQuery] = useState('');

  // Initial Fetch
  useEffect(() => {
    if (user) {
      fetchData(user.id);
    }
  }, [user, fetchData]);

  // Background Polling for Multi-device Sync
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      fetchData(user.id, true);
    }, 10000); // Check every 10 seconds silently
    return () => clearInterval(interval);
  }, [user?.id, fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) search(query);
      else clearSearch();
    }, 500);
    return () => clearTimeout(timer);
  }, [query, search, clearSearch]);

  const watchedCount = useMemo(() => userEntries.filter(e => e.status === 'WATCHED').length, [userEntries]);
  const droppedCount = useMemo(() => userEntries.filter(e => e.status === 'DROPPED').length, [userEntries]);
  const laterCount = useMemo(() => userEntries.filter(e => e.status === 'WATCH_LATER').length, [userEntries]);

  const mainRecommendations = useMemo(() => recommendations.slice(0, 15), [recommendations]);

  if (isLoading && userEntries.length === 0) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
    </div>
  );

  return (
    <div className="space-y-12 pb-20 overflow-anchor-none">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Welcome back, {user?.firstName}!</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Explore recommendations based on your unique taste.</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search for movies or shows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 outline-none transition"
          />
          <span className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-600">🔍</span>
          {isSearching && (
            <div className="absolute right-3 top-3.5">
              <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
      </header>

      {query && (
        <section className="bg-white dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 min-h-[300px] transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Search Results</h2>
            <button onClick={() => setQuery('')} className="text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest">Close Results</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {searchResults.map(movie => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        </section>
      )}

      {!query && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Watched', count: watchedCount, color: 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/10 dark:text-green-400 dark:border-green-900/30' },
            { label: 'Watchlist', count: laterCount, color: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-900/30' },
            { label: 'Dropped', count: droppedCount, color: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-900/30' },
          ].map(stat => (
            <div key={stat.label} className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${stat.color}`}>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{stat.label}</p>
              <p className="text-4xl font-black mt-1">{stat.count}</p>
            </div>
          ))}
        </div>
      )}

      {!query && (
        <div className="space-y-24">
          {groupedRecommendations.length > 0 && groupedRecommendations.map((group) => (
            <RecommendationRow key={`row-${group.sourceMovie.id}`} group={group} />
          ))}

          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Trending & Personal Hits</h2>
              <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            </div>
            
            {mainRecommendations.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                {mainRecommendations.map(rec => {
                  const movie = movies.find(m => m.id === rec.movieId);
                  if (!movie) return null;
                  return <MovieCard key={movie.id} movie={movie} subtitle={rec.reasons[0]} />;
                })}
              </div>
            ) : !isLoading && (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-slate-400 italic">No recommendations available. Start marking movies as watched!</p>
              </div>
            )}
          </section>

          {!isLoading && watchedCount === 0 && (
             <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[3.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
               <div className="text-4xl mb-4">🎥</div>
               <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Start Your Collection</h3>
               <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2">Mark movies as "Watched" to unlock personalized rows based on genre affinity.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
