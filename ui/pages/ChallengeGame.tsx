
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../state/authStore';
import { useSocialStore } from '../../state/socialStore';
import { useMovieStore } from '../../state/movieStore';
import { Movie, SocialChallenge } from '../../core/types/models';
import { movieRepo } from '../../data/repositories/movieRepo';

export const ChallengeGame: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { challenges, updateChallenge, allUsers, fetchSocial } = useSocialStore();
  const { movies, seedMovies } = useMovieStore();

  const [localChallenge, setLocalChallenge] = useState<SocialChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedResolution = useRef(false);
  const isInitialLoadRef = useRef(true);

  // 1. Sync localChallenge immediately if it's already in the store (e.g. just created)
  useEffect(() => {
    const found = challenges.find(c => c.id === id);
    if (found) {
        setLocalChallenge(found);
    }
  }, [challenges, id]);

  // 2. Initial Data Fetching (fallback only)
  useEffect(() => {
    const init = async () => {
      if (!user?.id || !id) return;
      
      const found = challenges.find(c => c.id === id);
      if (!found && isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        try {
            await fetchSocial(user.id);
        } catch (err) {
            setError("Failed to load battle data.");
        }
      }
    };
    init();
  }, [id, user?.id, fetchSocial]);

  // 3. Resolve Movie Metadata in background
  useEffect(() => {
    const resolveMovies = async () => {
      if (!localChallenge || hasAttemptedResolution.current) return;
      
      const missingIds = localChallenge.movieIds.filter(mId => !movies.find(m => m.id === mId));
      
      if (missingIds.length > 0) {
        hasAttemptedResolution.current = true;
        try {
          const fetched = await Promise.all(
            missingIds.map(mId => movieRepo.getMovieById(mId).catch(() => null))
          );
          const validMovies = fetched.filter(Boolean) as Movie[];
          if (validMovies.length > 0) {
            seedMovies(validMovies);
          }
        } catch (err) {
          console.error("Failed to fetch game movies background", err);
        }
      }
    };

    resolveMovies();
  }, [localChallenge, movies, seedMovies]);

  // 4. Polling for Turn Updates (Crucial for multiplayer sync)
  useEffect(() => {
    if (!user?.id || !id) return;
    
    const interval = setInterval(() => {
        // Always poll if game is ongoing to catch state changes
        fetchSocial(user.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [user?.id, id, fetchSocial]);

  // Derive turn state
  const isMyTurn = localChallenge?.turnUserId === user?.id;
  const opponentId = localChallenge?.creatorId === user?.id ? localChallenge?.recipientId : localChallenge?.creatorId;
  const opponent = allUsers.find(u => u.id === opponentId);

  // Game Primitives
  const gameMovies = useMemo(() => {
    if (!localChallenge) return [];
    return localChallenge.movieIds.map(mId => {
      return movies.find(m => m.id === mId) || { 
        id: mId, 
        title: 'Loading Movie...', 
        year: 0, 
        genres: [],
        posterUrl: 'https://via.placeholder.com/300x450?text=Syncing...' 
      } as any;
    });
  }, [localChallenge, movies]);

  const tiers = ['S', 'A', 'B', 'C', 'D', 'F'];
  const tierAssignments = useMemo(() => localChallenge?.results?.tierAssignments || {
    S: [], A: [], B: [], C: [], D: [], F: []
  }, [localChallenge]);

  const unassignedItems = useMemo(() => {
    const assignedIds = new Set(Object.values(tierAssignments).flat() as string[]);
    return gameMovies.filter(m => !assignedIds.has(m.id));
  }, [gameMovies, tierAssignments]);

  const bracketState = useMemo(() => localChallenge?.results?.bracketState || {
    items: localChallenge?.movieIds || [],
    winners: [],
    index: 0,
    round: 1
  }, [localChallenge]);

  const handleNextTurn = async (newResults: any, isFinal: boolean = false) => {
    if (!id || !user || !localChallenge) return;
    
    // Switch turn to opponent
    await updateChallenge(id, {
      status: isFinal ? 'COMPLETED' : 'ACTIVE',
      turnUserId: opponentId, 
      results: newResults
    });
  };

  const handleBracketChoice = (winnerId: string) => {
    if (!isMyTurn) return;

    const { items, winners, index, round } = bracketState;
    const nextWinners = [...winners, winnerId];
    let nextState = { ...bracketState, winners: nextWinners, index: index + 2 };

    const isRoundOver = nextState.index >= items.length;
    
    if (isRoundOver) {
      if (nextWinners.length === 1) {
        handleNextTurn({ ...nextState, finalWinner: nextWinners[0] }, true);
        return;
      } else {
        nextState = { items: nextWinners, winners: [], index: 0, round: round + 1 };
      }
    }

    handleNextTurn({ bracketState: nextState });
  };

  const assignTier = (movie: Movie, tier: string) => {
    if (!isMyTurn) return;

    const nextAssignments = { ...tierAssignments };
    Object.keys(nextAssignments).forEach(k => {
      nextAssignments[k] = nextAssignments[k].filter((id: string) => id !== movie.id);
    });
    nextAssignments[tier].push(movie.id);

    const isFinal = unassignedItems.length === 1;
    handleNextTurn({ tierAssignments: nextAssignments }, isFinal);
  };

  if (error) return (
    <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-red-100 dark:border-red-900/30">
      <h2 className="text-xl font-bold text-red-500">Battle Sync Failed</h2>
      <p className="text-slate-500 dark:text-slate-400 mt-2">{error}</p>
      <button onClick={() => navigate('/social')} className="mt-6 text-indigo-600 font-bold uppercase text-xs tracking-widest">Return to Social</button>
    </div>
  );

  // Critical loading check: if we don't have the challenge metadata yet
  if (!localChallenge) return (
    <div className="flex flex-col h-[70vh] items-center justify-center gap-4">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] animate-pulse">Establishing Connection...</p>
    </div>
  );

  // If completed, show final state
  if (localChallenge.status === 'COMPLETED') {
      return (
          <div className="space-y-10 pb-32 animate-in fade-in duration-500 text-center">
              <header>
                <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Battle Finalized!</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">The results are in for your {localChallenge.type.toLowerCase()}.</p>
              </header>

              {localChallenge.type === 'BRACKET' ? (
                  <div className="max-w-md mx-auto bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl border border-indigo-100 dark:border-indigo-900/30">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400 mb-6">The Champion</p>
                      {(() => {
                          const winner = movies.find(m => m.id === localChallenge.results.finalWinner);
                          return winner ? (
                              <div className="space-y-6">
                                  <img src={winner.posterUrl} className="w-48 mx-auto rounded-3xl shadow-xl border-4 border-indigo-600" />
                                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">{winner.title}</h2>
                                  <p className="text-slate-500">{winner.year}</p>
                              </div>
                          ) : <div className="animate-pulse h-64 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-400">Loading Winner...</div>;
                      })()}
                  </div>
              ) : (
                  <div className="max-w-2xl mx-auto space-y-4">
                      {tiers.map(tier => (
                          <div key={tier} className="flex gap-4 p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                              <div className={`w-12 h-12 flex items-center justify-center rounded-2xl font-black text-xl text-white ${
                                tier === 'S' ? 'bg-red-500' : tier === 'A' ? 'bg-orange-500' : tier === 'B' ? 'bg-yellow-400' : 'bg-slate-400'
                              }`}>{tier}</div>
                              <div className="flex flex-wrap gap-2">
                                  {tierAssignments[tier].map((mId: string) => {
                                      const movie = movies.find(m => m.id === mId);
                                      return movie ? <img key={mId} src={movie.posterUrl} className="h-12 rounded shadow" /> : <div key={mId} className="w-8 h-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />;
                                  })}
                              </div>
                          </div>
                      ))}
                  </div>
              )}

              <button 
                onClick={() => navigate('/social')}
                className="px-10 py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-3xl hover:bg-indigo-700 transition shadow-xl"
              >
                Back to Social Hub
              </button>
          </div>
      );
  }

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <button onClick={() => navigate(-1)} className="text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest mb-4">← Exit Battle</button>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {localChallenge.type === 'BRACKET' ? 'Bracket Fight' : 'Tier List'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
             Battle with <strong>{opponent?.firstName || 'Friend'}</strong> • 
             {isMyTurn ? (
                 <span className="text-indigo-600 dark:text-indigo-400 font-black ml-2 animate-pulse uppercase">Your Turn</span>
             ) : (
                 <span className="text-slate-400 ml-2">Waiting for {opponent?.firstName || 'opponent'}...</span>
             )}
          </p>
        </div>
        
        <div className={`px-6 py-3 rounded-2xl flex items-center gap-4 shadow-xl transition-colors ${isMyTurn ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
            <div className="text-2xl">{opponent?.avatarUrl && <img src={opponent.avatarUrl} className={`w-8 h-8 rounded-full border-2 ${isMyTurn ? 'border-white/20' : 'border-slate-300 dark:border-slate-700'}`} />}</div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Vs</p>
                <p className="font-bold truncate max-w-[100px]">{opponent?.firstName || 'Friend'}</p>
            </div>
        </div>
      </header>

      {!isMyTurn && (
          <div className="fixed inset-0 z-40 bg-slate-900/5 pointer-events-none flex items-center justify-center">
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-10 py-5 rounded-full shadow-2xl border border-slate-200 dark:border-slate-800 pointer-events-auto flex items-center gap-4 animate-in slide-in-from-top-10">
                  <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                      {opponent?.firstName || 'Friend'} is deciding...
                  </span>
              </div>
          </div>
      )}

      {localChallenge.type === 'BRACKET' && (
        <div className="space-y-12 relative">
            <div className="text-center">
                <span className="px-6 py-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-black uppercase tracking-[0.2em]">
                    Round {bracketState.round} • Match {Math.floor(bracketState.index/2) + 1}
                </span>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 items-center relative transition-opacity ${!isMyTurn ? 'opacity-40 grayscale' : ''}`}>
                {[bracketState.items[bracketState.index], bracketState.items[bracketState.index + 1]].map((mId, idx) => {
                    const movie = movies.find(m => m.id === mId);
                    
                    if (!movie) return (
                        <div key={`empty-${idx}-${mId}`} className="w-full aspect-[2/3] max-w-[280px] bg-slate-100 dark:bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center animate-pulse">
                            <span className="text-[10px] font-black uppercase text-slate-400">Syncing...</span>
                        </div>
                    );

                    return (
                        <button 
                            key={movie.id}
                            disabled={!isMyTurn}
                            onClick={() => handleBracketChoice(movie.id)}
                            className="group relative flex flex-col items-center animate-in zoom-in-95 duration-200 focus:outline-none disabled:cursor-not-allowed mx-auto w-full"
                        >
                            <div className="w-full aspect-[2/3] max-w-[280px] rounded-[2.5rem] overflow-hidden shadow-2xl transition group-hover:scale-105 group-active:scale-95 border-4 border-transparent group-hover:border-indigo-500">
                                {movie.posterUrl ? <img src={movie.posterUrl} className="w-full h-full object-cover" alt={movie.title} /> : <div className="w-full h-full bg-slate-300" />}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-200" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                    <span className="bg-indigo-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm shadow-xl">Pick Winner</span>
                                </div>
                            </div>
                            <div className="mt-6 text-center max-w-[280px]">
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2">{movie.title}</h3>
                                <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">{movie.year > 0 ? movie.year : 'TBD'}</p>
                            </div>
                        </button>
                    );
                })}

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-16 h-16 bg-indigo-600 text-white rounded-full font-black text-xl shadow-2xl border-4 border-white dark:border-slate-900 z-10 pointer-events-none">
                    VS
                </div>
            </div>
        </div>
      )}

      {localChallenge.type === 'TIERLIST' && (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-10 transition-opacity ${!isMyTurn ? 'opacity-50 grayscale-[0.5]' : ''}`}>
            <div className="lg:col-span-8 space-y-4">
                {tiers.map(tier => (
                    <div key={tier} className="flex gap-4 group">
                        <div className={`w-16 h-24 sm:w-20 sm:h-28 flex items-center justify-center rounded-3xl font-black text-3xl sm:text-4xl shadow-lg flex-shrink-0 transition-transform hover:scale-105 ${
                            tier === 'S' ? 'bg-red-500 text-white' :
                            tier === 'A' ? 'bg-orange-500 text-white' :
                            tier === 'B' ? 'bg-yellow-400 text-white' :
                            tier === 'C' ? 'bg-green-500 text-white' :
                            tier === 'D' ? 'bg-blue-500 text-white' :
                            'bg-slate-400 text-white'
                        }`}>
                            {tier}
                        </div>
                        <div className="flex-1 min-h-[6rem] sm:min-h-[7rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-wrap gap-3 transition-colors overflow-hidden">
                            {(tierAssignments[tier] || []).map((mId: string) => {
                                const movie = movies.find(m => m.id === mId);
                                return (
                                    <div key={mId} className="w-12 h-18 sm:w-16 sm:h-22 rounded-lg overflow-hidden shadow-md flex-shrink-0 bg-slate-100 dark:bg-slate-800">
                                        {movie?.posterUrl ? <img src={movie.posterUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full animate-pulse" />}
                                    </div>
                                );
                            })}
                            {tierAssignments[tier]?.length === 0 && (
                                <div className="flex-1 flex items-center justify-center text-slate-300 dark:text-slate-700 text-[10px] font-black uppercase tracking-widest">
                                    Empty Tier
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="lg:col-span-4">
                <div className="sticky top-24 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-6 flex items-center justify-between">
                        The Shelf
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500">{unassignedItems.length}</span>
                    </h3>
                    
                    {unassignedItems.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {unassignedItems.map(movie => (
                                <div key={movie.id} className="group relative">
                                    <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-md bg-slate-100 dark:bg-slate-800">
                                        {movie.posterUrl ? <img src={movie.posterUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full animate-pulse" />}
                                        {isMyTurn && movie.title !== 'Loading Movie...' && (
                                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 p-2">
                                                <div className="grid grid-cols-2 gap-1">
                                                    {tiers.map(t => (
                                                        <button 
                                                            key={t}
                                                            onClick={() => assignTier(movie, t)}
                                                            className="w-7 h-7 rounded-md bg-white text-slate-900 font-bold text-xs hover:bg-indigo-600 hover:text-white transition"
                                                        >
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center animate-in zoom-in-95">
                            <div className="text-3xl mb-3">🏅</div>
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest leading-relaxed">Shelf is clear!<br/>Waiting for turn end.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
