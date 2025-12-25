
import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  const { fetchData: fetchMovies } = useMovieStore();
  const [userQuery, setUserQuery] = useState('');

  // Initial Load
  useEffect(() => {
    if (currentUser?.id) {
      fetchSocial(currentUser.id);
      fetchMovies(currentUser.id);
    }
  }, [currentUser, fetchSocial, fetchMovies]);

  // High Frequency Silent Polling
  useEffect(() => {
    if (!currentUser?.id) return;
    const interval = setInterval(() => {
      fetchSocial(currentUser.id, true);
    }, 4000);
    return () => clearInterval(interval);
  }, [currentUser?.id, fetchSocial]);

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
      case 'WATCHED': return <span className="dark:text-slate-200"><strong>{name}</strong> watched <strong>{movieTitle}</strong> and gave it a <strong>{event.metadata?.rating}/10</strong>.</span>;
      case 'DROPPED': return <span className="dark:text-slate-200"><strong>{name}</strong> dropped <strong>{movieTitle}</strong>: <em>"{event.metadata?.droppedReason}"</em>.</span>;
      case 'WATCH_LATER': return <span className="dark:text-slate-200"><strong>{name}</strong> added <strong>{movieTitle}</strong> to their watch list.</span>;
      case 'FRIEND_ADDED':
        const friend = allUsers?.find(u => u.id === event.metadata?.friendId);
        return <span className="dark:text-slate-200"><strong>{name}</strong> connected with <strong>{friend?.name || 'a new friend'}</strong>.</span>;
      case 'CHALLENGE_COMPLETED': return <span className="dark:text-slate-200"><strong>{name}</strong> completed a <strong>{event.metadata?.challengeType?.toLowerCase()}</strong> battle!</span>;
      default: return <span className="dark:text-slate-200"><strong>{name}</strong> updated their list.</span>;
    }
  };

  // ONLY show a full screen loader if we have NO data at all
  if (isLoading && allUsers.length === 0) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
    </div>
  );

  return (
    <div className="space-y-10 overflow-anchor-none">
      <header className="space-y-4">
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Social Hub</h1>
        <div className="relative">
          <input
            type="text"
            placeholder="Find someone..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 outline-none transition"
          />
          <span className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-600">🔍</span>
        </div>
      </header>

      {/* Persistent list containers to prevent layout shifting */}
      <div className="min-h-[100px]">
          {activeChallenges.length > 0 && (
              <section className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden mb-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
                <h2 className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                    Ongoing Battles
                </h2>
                <div className="space-y-4">
                    {activeChallenges.map(challenge => {
                        const oppId = challenge.creatorId === currentUser?.id ? challenge.recipientId : challenge.creatorId;
                        const opponent = allUsers?.find(u => u.id === oppId);
                        const getIcon = () => {
                          if (challenge.type === 'BRACKET') return '🥊';
                          if (challenge.type === 'TIERLIST') return '📊';
                          return '🕵️';
                        };
                        return (
                            <div key={challenge.id} className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="text-2xl">{getIcon()}</div>
                                    <div>
                                        <p className="font-bold text-sm">{challenge.type.replace(/_/g, ' ')} w/ {opponent?.firstName || 'Friend'}</p>
                                        <p className="text-[10px] uppercase font-black opacity-60 tracking-widest">{challenge.size} Movies</p>
                                    </div>
                                </div>
                                <Link to={`/social/challenge/${challenge.id}`} className="px-5 py-2 bg-white text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition shadow-lg">Play</Link>
                            </div>
                        );
                    })}
                </div>
              </section>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Activity</h2>
          <div className="space-y-4">
            {activityFeed.map(event => {
              const actor = allUsers?.find(u => u.id === event.userId);
              if (!actor) return null;
              return (
                <div key={event.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-4 items-start">
                  <Link to={`/social/friend/${actor.id}`}>
                    <img src={actor.avatarUrl} className="w-12 h-12 rounded-full border border-slate-100 dark:border-slate-800 object-cover" alt="avatar" />
                  </Link>
                  <div className="flex-1">
                    <p className="text-slate-800 dark:text-slate-300 leading-relaxed text-sm">{getEventText(event, actor.name, 'a movie')}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-2 font-black uppercase tracking-widest">{new Date(event.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Friends</h2>
          <div className="space-y-3">
            {friends.map(friend => (
              <Link key={friend.id} to={`/social/friend/${friend.id}`} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 hover:bg-slate-50 transition">
                <img src={friend.avatarUrl} className="w-10 h-10 rounded-full object-cover" />
                <div className="overflow-hidden">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{friend.name}</h4>
                  <p className="text-xs text-slate-400">@{friend.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
