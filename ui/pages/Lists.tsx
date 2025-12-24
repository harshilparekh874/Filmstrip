
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../../state/authStore';
import { useMovieStore } from '../../state/movieStore';
import { MovieCard } from '../components/MovieCard';
import { WatchStatus, Movie, UserMovieEntry } from '../../core/types/models';

export const Lists: React.FC = () => {
  const { status } = useParams<{ status: string }>();
  const { user } = useAuthStore();
  const { movies, userEntries, fetchData, isLoading } = useMovieStore();
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    if (user) fetchData(user.id);
  }, [user, fetchData, status]);

  const isTvShow = (movie: Movie) => {
    return movie.id.includes('-tv-') || movie.genres.includes('TV Show');
  };

  const filteredEntries = userEntries.filter(e => e.status === (status as WatchStatus));
  
  const items = filteredEntries
    .map(e => ({
      movie: movies.find(m => m.id === e.movieId),
      entry: e
    }))
    .filter(item => item.movie)
    .filter(item => item.movie?.title.toLowerCase().includes(filterQuery.toLowerCase())) as { movie: Movie, entry: UserMovieEntry }[];

  const moviesOnly = items.filter(item => !isTvShow(item.movie));
  const tvShowsOnly = items.filter(item => isTvShow(item.movie));

  const titles: Record<string, string> = {
    'WATCHED': 'Seen It',
    'WATCH_LATER': 'Watchlist',
    'DROPPED': 'Dropped'
  };

  const icons: Record<string, string> = {
    'WATCHED': '✅',
    'WATCH_LATER': '🕒',
    'DROPPED': '✖️'
  };

  if (isLoading && movies.length === 0) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
    </div>
  );

  const MovieGrid = ({ title, data }: { title: string, data: typeof items }) => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{title}</h2>
        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
        <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">
          {data.length}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {data.map(({ movie, entry }) => (
          <div key={movie.id} className="space-y-2 group">
            <MovieCard 
              movie={movie} 
              badge={entry.rating ? `${entry.rating}/10` : undefined}
            />
            {status === 'DROPPED' && (
              <div className="text-[10px] bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-xl border border-red-100 dark:border-red-900/30 font-black uppercase tracking-tight truncate shadow-sm">
                Reason: {entry.droppedReason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
              <span>{icons[status || ''] || '🎬'}</span>
              {titles[status || ''] || 'List'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
              {items.length} total items
            </p>
          </div>
        </div>

        {/* Filter Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder={`Search ${titles[status || '']?.toLowerCase() || 'list'}...`}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 outline-none transition"
          />
          <span className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-600">🔍</span>
        </div>
      </header>

      {items.length > 0 ? (
        <div className="space-y-12">
          {moviesOnly.length > 0 && (
            <MovieGrid title="Movies" data={moviesOnly} />
          )}
          
          {tvShowsOnly.length > 0 && (
            <MovieGrid title="TV Shows" data={tvShowsOnly} />
          )}

          {items.length > 0 && moviesOnly.length === 0 && tvShowsOnly.length === 0 && (
             <div className="text-center py-20">
               <p className="text-slate-400 italic">No matches for "{filterQuery}"</p>
             </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-20 rounded-[3rem] text-center border-2 border-dashed border-slate-200 dark:border-slate-800 transition-colors">
          <div className="text-5xl mb-6">🍿</div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
            {filterQuery ? "No matches found" : "Your list is empty"}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm">
            {filterQuery 
              ? `Check your spelling or try another title.`
              : `Explore and add content to your ${titles[status || '']?.toLowerCase()}!`}
          </p>
        </div>
      )}
    </div>
  );
};
