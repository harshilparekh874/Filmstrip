
import React, { useEffect, useState, useMemo } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive turn state
  const isMyTurn = localChallenge?.turnUserId === user?.id;
  const opponentId = localChallenge?.creatorId === user?.id ? localChallenge?.recipientId : localChallenge?.creatorId;
  const opponent = allUsers.find(u => u.id === opponentId);

  // 1. Initial Data Fetching (Social & Specific Challenge)
  useEffect(() => {
    const init = async () => {
      if (!user?.id || !id) return;
      
      // If challenge not in store, fetch social data
      if (!challenges.find(c => c.id === id)) {
        await fetchSocial(user.id);
      }
    };
    init();
  }, [id, user?.id, fetchSocial, challenges]);

  // 2. Sync localChallenge when store updates
  useEffect(() => {
    const found = challenges.find(c => c.id === id);
    if (found) {
      setLocalChallenge(found);
    }
  }, [challenges, id]);

  // 3. Resolve Movie Metadata
  useEffect(() => {
    const resolveMovies = async () => {
      if (!localChallenge) return;

      const missingIds = localChallenge.movieIds.filter(mId => !movies.find(m => m.id === mId));
      
      if (missingIds.length > 0) {
        console.log(`[Game] Fetching ${missingIds.length} missing movies...`);
        try {
          const fetched = await Promise.all(
            missingIds.map(mId => movieRepo.getMovieById(mId))
          );
          seedMovies(fetched.filter(Boolean) as Movie[]);
        } catch (err) {
          console.error("Failed to fetch game movies", err);
          setError("Failed to load movie data.");
        }
      } else {
        // All movies present
        setLoading(false);
      }
    };

    resolveMovies();
  }, [localChallenge, movies, seedMovies]);

  // 4. Polling for Turn Updates
  useEffect(() => {
    if (!user?.id || !id) return;
    const interval = setInterval(() => {
      // Only poll if it's NOT my turn
      if (localChallenge && localChallenge.turnUserId !== user.id) {
        fetchSocial(user.id);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user?.id, id, localChallenge, fetchSocial]);

  // Game Primitives
  const gameMovies = useMemo(() => {
    if (!localChallenge) return [];
    return localChallenge.movieIds.map(mId => movies.find(m => m.id === mId)).filter(Boolean) as Movie[];
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

  if (error) return <div className="p-20 text-center text-red-500 font-bold">{error}</div>;

  if (loading || !localChallenge) return (
    <div className="flex flex-col h-[70vh] items-center justify-center gap-4">
        <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] animate-pulse">Syncing Battle Data...</p>
    </div>
  );

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
                 <span className="text-indigo-600 dark:text-indigo-400 font-black ml-2 animate-pulse">YOUR TURN</span>
             ) : (
                 <span className="text-slate-400 ml-2">Waiting for {opponent?.firstName || 'opponent'}...</span>
             )}
          </p>
        </div>
        
        <div className={`px-6 py-3 rounded-2xl flex items-center gap-4 shadow-xl transition-colors ${isMyTurn ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
            <div className="text-2xl">{opponent?.avatarUrl && <img src={opponent.avatarUrl} className={`w-8 h-8 rounded-full border-2 ${isMyTurn ? 'border-white/20' : 'border-slate-300 dark:border-slate-700'}`} />}</div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Vs</p>
                <p className="font-bold">{opponent?.name || 'Friend'}</p>
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
                        <div key={`empty-${idx}`} className="bg-slate-100 dark:bg-slate-800/50 p-20 rounded-[3rem] text-center border-2 border-dashed border-slate-200 dark:border-slate-800 transition-colors flex items-center justify-center">
                            <div className="animate-pulse h-4 w-20 bg-slate-300 dark:bg-slate-700 rounded" />
                        </div>
                    );
                    return (
                        <button 
                            key={movie.id}
                            disabled={!isMyTurn}
                            onClick={() => handleBracketChoice(movie.id)}
                            className="group relative flex flex-col items-center animate-in zoom-in-95 duration-200 focus:outline-none disabled:cursor-not-allowed"
                        >
                            <div className="w-full aspect-[2/3] max-w-[280px] rounded-[2.5rem] overflow-hidden shadow-2xl transition group-hover:scale-105 group-active:scale-95 border-4 border-transparent group-hover:border-indigo-500">
                                <img src={movie.posterUrl} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-200" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                    <span className="bg-indigo-600 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest text-sm shadow-xl">Pick Winner</span>
                                </div>
                            </div>
                            <div className="mt-6 text-center">
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{movie.title}</h3>
                                <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">{movie.year}</p>
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
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-10 transition-opacity ${!isMyTurn ? 'opacity-50' : ''}`}>
            <div className="lg:col-span-8 space-y-4">
                {tiers.map(tier => (
                    <div key={tier} className="flex gap-4 group">
                        <div className={`w-16 h-24 sm:w-20 sm:h-28 flex items-center justify-center rounded-3xl font-black text-3xl sm:text-4xl shadow-lg flex-shrink-0 transition ${
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
                            {tierAssignments[tier].map((mId: string) => {
                                const movie = movies.find(m => m.id === mId);
                                if (!movie) return null;
                                return (
                                    <div key={mId} className="w-12 h-18 sm:w-16 sm:h-22 rounded-lg overflow-hidden shadow-md">
                                        <img src={movie.posterUrl} className="w-full h-full object-cover" />
                                    </div>
                                );
                            })}
                            {tierAssignments[tier].length === 0 && (
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
                                    <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-md">
                                        <img src={movie.posterUrl} className="w-full h-full object-cover" />
                                        {isMyTurn && (
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
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest leading-relaxed">Shelf is clear!<br/>Battle complete.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
