
import React, { useEffect } from 'react';
import { useAuthStore } from '../../state/authStore';
import { useSocialStore } from '../../state/socialStore';
import { useMovieStore } from '../../state/movieStore';

export const ActivityFeed: React.FC = () => {
  const { user } = useAuthStore();
  const { activityFeed, allUsers, fetchSocial, isLoading } = useSocialStore();
  const { movies, fetchData: fetchMovies } = useMovieStore();

  useEffect(() => {
    if (user) {
      fetchSocial(user.id);
      fetchMovies(user.id);
    }
  }, [user, fetchSocial, fetchMovies]);

  if (isLoading && activityFeed.length === 0) return <div>Loading feed...</div>;

  const getEventText = (event: any, actorName: string, movieTitle: string) => {
    switch (event.type) {
      case 'WATCHED':
        return <span><strong>{actorName}</strong> watched <strong>{movieTitle}</strong> and gave it a <strong>{event.metadata.rating}/10</strong>.</span>;
      case 'DROPPED':
        return <span><strong>{actorName}</strong> dropped <strong>{movieTitle}</strong>. Reason: <em>"{event.metadata.droppedReason}"</em>.</span>;
      case 'WATCH_LATER':
        return <span><strong>{actorName}</strong> added <strong>{movieTitle}</strong> to their watch list.</span>;
      case 'FRIEND_ADDED':
        return <span><strong>{actorName}</strong> connected with a new friend.</span>;
      default:
        return <span><strong>{actorName}</strong> performed an action.</span>;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Activity Feed</h1>
        <p className="text-slate-500 mt-1">Updates from you and your friends</p>
      </header>

      <div className="space-y-4">
        {activityFeed.map(event => {
          const actor = allUsers.find(u => u.id === event.userId);
          const movie = movies.find(m => m.id === event.movieId);
          const time = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const date = new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

          if (!actor) return null;

          return (
            <div key={event.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex gap-4 items-start">
              <img src={actor.avatarUrl} className="w-12 h-12 rounded-full border border-slate-100" alt="avatar" />
              <div className="flex-1">
                <p className="text-slate-800 leading-relaxed">
                  {getEventText(event, actor.name, movie?.title || 'a movie')}
                </p>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  {date} at {time}
                </p>
              </div>
              {movie?.posterUrl && (
                <img src={movie.posterUrl} className="w-12 aspect-[2/3] rounded-md object-cover opacity-80" alt="movie" />
              )}
            </div>
          );
        })}

        {activityFeed.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed">
            <p className="text-slate-400">No activity yet. Start tracking or add friends!</p>
          </div>
        )}
      </div>
    </div>
  );
};
