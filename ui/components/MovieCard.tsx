
import React from 'react';
import { Link } from 'react-router-dom';
import { Movie } from '../../core/types/models';

interface MovieCardProps {
  movie: Movie;
  subtitle?: string;
  badge?: string;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, subtitle, badge }) => {
  const getCategory = () => {
    if (movie.genres && movie.genres.length > 0) return movie.genres[0];
    if (movie.id.includes('-tv-')) return 'TV Show';
    if (movie.id.includes('-movie-')) return 'Movie';
    return '';
  };

  const category = getCategory();

  return (
    <Link to={`/movie/${movie.id}`} className="group block">
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-sm group-hover:shadow-xl dark:group-hover:shadow-indigo-900/20 transition-all duration-300 bg-slate-200 dark:bg-slate-800">
        <img 
          src={movie.posterUrl} 
          alt={movie.title}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          loading="lazy"
        />
        {badge && (
          <div className="absolute top-2 right-2 bg-indigo-600 dark:bg-indigo-500 text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase shadow-lg">
            {badge}
          </div>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate leading-tight" title={movie.title}>
          {movie.title}
        </h3>
        {subtitle ? (
          <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400 font-medium line-clamp-2">
            {subtitle}
          </p>
        ) : (
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            {movie.year}{category ? ` • ${category}` : ''}
          </p>
        )}
      </div>
    </Link>
  );
};
