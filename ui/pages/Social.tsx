
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../state/authStore';
import { useSocialStore } from '../../state/socialStore';
import { useMovieStore } from '../../state/movieStore';

export const Social: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const { 
    friends = [], 
    allUsers = [], 
    pendingRequests = [], 
    outgoingRequests = [],
    activityFeed = [], 
    challenges = [],
    requestingIds = new Set(),
    fetchSocial, 
    sendRequest, 
    acceptRequest,
    rejectRequest,
    isLoading 
  } = useSocialStore();
  const { movies = [], fetchData: fetchMovies } = useMovieStore();
  
  const [userQuery, setUserQuery] = useState('');

  useEffect(() => {
    if (currentUser?.id) {
      fetchSocial(currentUser.id);
      fetchMovies(currentUser.id);
    }
  }, [currentUser, fetchSocial, fetchMovies]);

  const filteredDiscovery = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u?.id !== currentUser?.id && 
      !friends?.some(f => f.id === u.id) &&
      (userQuery === '' || 
       u?.name?.toLowerCase().includes(userQuery.toLowerCase()) || 
       u?.username?.toLowerCase().includes(userQuery.toLowerCase()))
    );
  }, [allUsers, currentUser, friends, userQuery]);

  const activeChallenges = useMemo(() => {
    return challenges?.filter(c => c.status !== 'COMPLETED') || [];
  }, [challenges]);

  const getEventText = (event: any, actorName: string, movieTitle: string) => {
    const isMe = actorName === currentUser?.name;
    const name = isMe ? 'You' : actorName;

    switch (event.type) {
      case 'WATCHED':
        return <span className="dark:text-slate-200"><strong>{name}</strong> watched <strong>{movieTitle}</strong> and gave it a <strong>{event.metadata?.rating}/10</strong>.</span>;
      case 'DROPPED':
        return <span className="dark:text-slate-200"><strong>{name}</strong> dropped <strong>{movieTitle}</strong> because it was <em>"{event.metadata?.droppedReason}"</em>.</span>;
      case 'WATCH_LATER':
        return <span className="dark:text-slate-200"><strong>{name}</strong> added <strong>{movieTitle}</strong> to their watch list.</span>;
      case 'FRIEND_ADDED':
        const friend = allUsers?.find(u => u.id === event.metadata?.friendId);
        return <span className="dark:text-slate-200"><strong>{name}</strong> connected with <strong>{friend?.name || 'a new friend'}</strong>.</span>;
      case 'CHALLENGE_COMPLETED':
        return <span className="dark:text-slate-200"><strong>{name}</strong> just completed a <strong>{event.metadata?.challengeType?.toLowerCase()}</strong> battle!</span>;
      default:
        return <span className="dark:text-slate-200"><strong>{name}</strong> updated their list.</span>;
    }
  };

  if (isLoading && activityFeed.length === 0) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="space-y-4">
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Social Hub</h1>
        <div className="relative">
          <input
            type="text"
            placeholder="Search for people to follow..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 outline-none transition"
          />
          <span className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-600">🔍</span>
        </div>
      </header>

      {/* Challenges Section */}
      {activeChallenges.length > 0 && (
          <section className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                Ongoing Battles
            </h2>
            <div className="space-y-4">
                {activeChallenges.map(challenge => {
                    const opponentId = challenge.creatorId === currentUser?.id ? challenge.recipientId : challenge.creatorId;
                    const opponent = allUsers?.find(u => u.id === opponentId);
                    
                    const getGameLabel = () => {
                      if (challenge.type === 'BRACKET') return 'Bracket Fight';
                      if (challenge.type === 'TIERLIST') return 'Tier List';
                      if (challenge.type === 'GUESS_THE_MOVIE') return 'Guess Game';
                      return 'Battle';
                    };

                    const getGameIcon = () => {
                      if (challenge.type === 'BRACKET') return '🥊';
                      if (challenge.type === 'TIERLIST') return '📊';
                      if (challenge.type === 'GUESS_THE_MOVIE') return '🕵️';
                      return '🎲';
                    };

                    return (
                        <div key={challenge.id} className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="text-2xl">{getGameIcon()}</div>
                                <div>
                                    <p className="font-bold text-sm">{getGameLabel()} w/ {opponent?.firstName || 'Friend'}</p>
                                    <p className="text-[10px] uppercase font-black opacity-60 tracking-widest">{challenge.size} Movies</p>
                                </div>
                            </div>
                            <Link 
                                to={`/social/challenge/${challenge.id}`}
                                className="px-5 py-2 bg-white text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition shadow-lg"
                            >
                                Play Now
                            </Link>
                        </div>
                    );
                })}
            </div>
          </section>
      )}

      {/* Friend Requests Section */}
      {pendingRequests.length > 0 && (
        <section className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-100 dark:border-amber-900/30 animate-in slide-in-from-top-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-amber-900 dark:text-amber-400 mb-4 ml-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Friend Requests
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map(req => (
              <div key={req.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <img src={req.from?.avatarUrl} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 object-cover" />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{req.from?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">@{req.from?.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => currentUser && acceptRequest(currentUser.id, req.id)}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => currentUser && rejectRequest(currentUser.id, req.id)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Discovery Section */}
      <section className="bg-slate-100 dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 transition-colors">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-6 ml-1">Community Discovery</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredDiscovery.length > 0 ? (
            filteredDiscovery.slice(0, 6).map(user => {
              const isRequested = outgoingRequests?.includes(user.id);
              const isProcessing = requestingIds.has(user.id);

              return (
                <div key={user.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <img src={user.avatarUrl} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 object-cover" />
                    <div className="overflow-hidden">
                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-500">@{user.username}</p>
                    </div>
                  </div>
                  {isRequested ? (
                    <button disabled className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase rounded-xl">Sent</button>
                  ) : (
                    <button 
                      onClick={() => currentUser && sendRequest(currentUser.id, user.id)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {isProcessing ? 'Sending...' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-slate-400 text-sm italic col-span-2 text-center py-4">Searching for new connections...</p>
          )}
        </div>
      </section>

      {/* Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">Activity Feed</h2>
          <div className="space-y-4">
            {activityFeed.map(event => {
              const actor = allUsers?.find(u => u.id === event.userId);
              const movie = movies?.find(m => m.id === event.movieId);
              if (!actor) return null;
              return (
                <div key={event.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-4 items-start hover:border-indigo-200 dark:hover:border-indigo-900 transition duration-300">
                  <Link to={`/social/friend/${actor.id}`}>
                    <img src={actor.avatarUrl} className="w-12 h-12 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-800 object-cover" alt="avatar" />
                  </Link>
                  <div className="flex-1">
                    <p className="text-slate-800 dark:text-slate-300 leading-relaxed text-sm">{getEventText(event, actor.name, movie?.title || 'a movie')}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-2 font-black uppercase tracking-widest">{new Date(event.timestamp).toLocaleDateString()}</p>
                  </div>
                  {movie?.posterUrl && (
                    <Link to={`/movie/${movie.id}`} className="flex-shrink-0 group">
                      <img src={movie.posterUrl} className="w-12 aspect-[2/3] rounded-xl object-cover shadow-sm group-hover:scale-105 transition duration-300" alt="movie" />
                    </Link>
                  )}
                </div>
              );
            })}
            {activityFeed.length === 0 && <p className="text-slate-500 italic text-center p-8">No activity yet. Connect with others!</p>}
          </div>
        </div>

        {/* Friends Sidebar */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Friends</h2>
          {friends.length > 0 ? (
            <div className="space-y-3">
              {friends.map(friend => (
                <Link key={friend.id} to={`/social/friend/${friend.id}`} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm">
                  <img src={friend.avatarUrl} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 object-cover" />
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{friend.name}</h4>
                    <p className="text-xs text-slate-400 dark:text-slate-600">@{friend.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 italic text-center p-8 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">No friends yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};
