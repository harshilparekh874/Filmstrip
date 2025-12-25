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
  const { challenges, updateChallenge, cancelChallenge, allUsers, fetchSocial } = useSocialStore();
  const { movies, seedMovies, search, searchResults, clearSearch, isSearching } = useMovieStore();

  const [localChallenge, setLocalChallenge] = useState<SocialChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const hasAttemptedResolution = useRef(false);
  const isInitialLoadRef = useRef(true);

  // Guess Game Specific State
  const [guessQuery, setGuessQuery] = useState('');
  const [hintLevel, setHintLevel] = useState(0); // 0: Cast, 1: Genres, 2: Overview
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const found = challenges.find(c => c.id === id);
    if (found) setLocalChallenge(found);
  }, [challenges, id]);

  useEffect(() => {
    const init = async () => {
      if (!user?.id || !id) return;
      const found = challenges.find(c => c.id === id);
      if (!found && isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        try { await fetchSocial(user.id); } catch (err) { setError("Failed to load battle data."); }
      }
    };
    init();
  }, [id, user?.id, fetchSocial]);

  // Resolve Movie Metadata in background
  useEffect(() => {
    const resolveMovies = async () => {
      if (!localChallenge || hasAttemptedResolution.current) return;
      const missingIds = localChallenge.movieIds.filter(mId => !movies.find(m => m.id === mId));
      if (missingIds.length > 0) {
        hasAttemptedResolution.current = true;
        try {
          const fetched = await Promise.all(missingIds.map(mId => movieRepo.getMovieById(mId).catch(() => null)));
          const validMovies = fetched.filter(Boolean) as Movie[];
          if (validMovies.length > 0) seedMovies(validMovies);
        } catch (err) { console.error("Failed to fetch game movies", err); }
      }
    };
    resolveMovies();
  }, [localChallenge, movies, seedMovies]);

  // Handle Search for Guessing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (guessQuery.length > 2) search(guessQuery);
      else clearSearch();
    }, 400);
    return () => clearTimeout(timer);
  }, [guessQuery]);

  // Timer Logic
  useEffect(() => {
    if (localChallenge?.type === 'GUESS_THE_MOVIE' && localChallenge.status === 'ACTIVE' && localChallenge.turnUserId === user?.id) {
        if (timeLeft === null) {
            const limit = (localChallenge.config?.timeLimitMins || 5) * 60;
            const elapsed = Math.floor((Date.now() - (localChallenge.results?.startTime || Date.now())) / 1000);
            setTimeLeft(Math.max(0, limit - elapsed));
        }

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev !== null && prev <= 1) {
                    handleGameOver();
                    return 0;
                }
                return prev !== null ? prev - 1 : null;
            });
        }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [localChallenge, user?.id]);

  const isMyTurn = localChallenge?.turnUserId === user?.id;
  const opponentId = localChallenge?.creatorId === user?.id ? localChallenge?.recipientId : localChallenge?.creatorId;
  const opponent = allUsers.find(u => u.id === opponentId);

  const gameMovies = useMemo(() => {
    if (!localChallenge) return [];
    return localChallenge.movieIds.map(mId => {
      return movies.find(m => m.id === mId) || { id: mId, title: 'Syncing...', posterUrl: '' } as Movie;
    });
  }, [localChallenge, movies]);

  const quizState = useMemo(() => {
      if (localChallenge?.type !== 'GUESS_THE_MOVIE') return null;
      return localChallenge.results || {
          index: 0,
          correct: [],
          skipped: [],
          startTime: Date.now()
      };
  }, [localChallenge]);

  // Added currentQuizMovie memo to resolve 'Cannot find name' errors in JSX
  const currentQuizMovie = useMemo(() => {
    if (!quizState) return null;
    return gameMovies[quizState.index] || null;
  }, [quizState, gameMovies]);

  const handleEndBattle = async () => {
    if (!id || !user) return;
    if (window.confirm("End this battle? No one will win and it will be removed for both players.")) {
        setIsEnding(true);
        try {
            await cancelChallenge(id);
            navigate('/social');
        } catch (err) {
            console.error("Failed to end battle", err);
        } finally {
            setIsEnding(false);
        }
    }
  };

  const handleNextTurn = async (newResults: any, isFinal: boolean = false) => {
    if (!id || !user || !localChallenge) return;
    await updateChallenge(id, {
      status: isFinal ? 'COMPLETED' : 'ACTIVE',
      results: newResults,
      turnUserId: isFinal ? localChallenge.creatorId : localChallenge.turnUserId
    });
  };

  const handleGameOver = () => {
      if (!localChallenge) return;
      handleNextTurn(quizState, true);
  };

  const handleGuess = (guessMovieId: string) => {
      if (!isMyTurn || !quizState) return;
      const currentMovie = gameMovies[quizState.index];
      const isCorrect = guessMovieId === currentMovie.id;

      const nextResults = { ...quizState };
      if (isCorrect) nextResults.correct = [...nextResults.correct, currentMovie.id];
      else return; 

      setGuessQuery('');
      setHintLevel(0);
      clearSearch();

      if (quizState.index + 1 >= gameMovies.length) {
          handleNextTurn(nextResults, true);
      } else {
          handleNextTurn({ ...nextResults, index: quizState.index + 1 });
      }
  };

  const handleSkip = () => {
    if (!isMyTurn || !quizState) return;
    const currentMovie = gameMovies[quizState.index];
    const nextResults = {
        ...quizState,
        skipped: [...quizState.skipped, currentMovie.id],
        index: quizState.index + 1
    };

    setGuessQuery('');
    setHintLevel(0);
    clearSearch();

    if (nextResults.index >= gameMovies.length) {
        handleNextTurn(nextResults, true);
    } else {
        handleNextTurn(nextResults);
    }
  };

  const handleBracketChoice = (winnerId: string) => {
    if (!isMyTurn || !localChallenge?.results?.bracketState) return;
    const { items, winners, index, round } = localChallenge.results.bracketState;
    const nextWinners = [...winners, winnerId];
    let nextState = { items, winners: nextWinners, index: index + 2, round };

    if (nextState.index >= items.length) {
      if (nextWinners.length === 1) {
        handleNextTurn({ bracketState: nextState, finalWinner: nextWinners[0] }, true);
      } else {
        nextState = { items: nextWinners, winners: [], index: 0, round: round + 1 };
        handleNextTurn({ bracketState: nextState });
      }
    } else {
        handleNextTurn({ bracketState: nextState });
    }
  };

  if (!localChallenge) return <div className="flex h-[70vh] items-center justify-center"><div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>;

  if (localChallenge.status === 'COMPLETED') {
      const isQuiz = localChallenge.type === 'GUESS_THE_MOVIE';
      return (
          <div className="space-y-10 pb-32 animate-in fade-in duration-500 text-center max-w-2xl mx-auto">
              <header>
                <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Battle Finalized!</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Check out the results below.</p>
              </header>

              {isQuiz ? (
                  <div className="grid grid-cols-2 gap-6">
                      <div className="bg-emerald-50 dark:bg-emerald-900/10 p-8 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/30">
                          <p className="text-4xl font-black text-emerald-600">{localChallenge.results?.correct?.length || 0}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mt-2">Correct Guesses</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                          <p className="text-4xl font-black text-slate-400">{localChallenge.results?.skipped?.length || 0}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Skipped / Missed</p>
                      </div>
                  </div>
              ) : (
                <div className="max-w-md mx-auto bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl border border-indigo-100 dark:border-indigo-900/30">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400 mb-6">The Champion</p>
                    {(() => {
                        const winner = movies.find(m => m.id === localChallenge.results.finalWinner);
                        return winner ? (
                            <div className="space-y-6">
                                <img src={winner.posterUrl} className="w-48 mx-auto rounded-3xl shadow-xl border-4 border-indigo-600" />
                                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">{winner.title}</h2>
                            </div>
                        ) : null;
                    })()}
                </div>
              )}

              <div className="flex flex-col gap-4">
                  <button onClick={() => navigate('/social')} className="px-10 py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-3xl hover:bg-indigo-700 transition">Back to Social Hub</button>
                  <button onClick={handleEndBattle} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline">Permanently Remove Battle Records</button>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-10 pb-32 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
              <button onClick={() => navigate(-1)} className="text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest">← Exit</button>
              <button 
                onClick={handleEndBattle} 
                disabled={isEnding}
                className="px-4 py-1.5 border border-red-200 dark:border-red-900/40 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-red-50 dark:hover:bg-red-900/10 transition"
              >
                {isEnding ? 'Ending...' : 'End Battle'}
              </button>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {localChallenge.type === 'BRACKET' ? 'Bracket Fight' : (localChallenge.type === 'TIERLIST' ? 'Tier List' : 'Guess the Movie')}
          </h1>
          <div className="flex items-center gap-3 mt-2">
              <p className="text-slate-500 dark:text-slate-400">
                Playing with <strong>{opponent?.firstName || 'Friend'}</strong> • 
                {isMyTurn ? <span className="text-indigo-600 dark:text-indigo-400 font-black ml-2 animate-pulse uppercase">Your Turn</span> : <span className="text-slate-400 ml-2">Waiting...</span>}
              </p>
          </div>
        </div>
        
        {timeLeft !== null && (
            <div className={`px-6 py-4 rounded-3xl border shadow-xl flex items-center gap-4 transition-colors ${timeLeft < 30 ? 'bg-red-500 border-red-600 text-white animate-pulse' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
                <div className="text-2xl">⏳</div>
                <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Time Left</p>
                    <p className="text-xl font-black font-mono">
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </p>
                </div>
            </div>
        )}
      </header>

      {localChallenge.type === 'GUESS_THE_MOVIE' && currentQuizMovie && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Silhouette Poster Column */}
              <div className="lg:col-span-4 space-y-6">
                  <div className="relative aspect-[2/3] rounded-[2.5rem] overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-2xl border-4 border-white dark:border-slate-800">
                      <img 
                        src={currentQuizMovie.posterUrl} 
                        className="w-full h-full object-cover select-none pointer-events-none" 
                        style={{ filter: 'brightness(0) contrast(0)' }} 
                      />
                      <div className="absolute inset-0 bg-indigo-600/5 mix-blend-multiply" />
                      <div className="absolute top-4 left-4 right-4 text-center">
                          <span className="px-4 py-1.5 bg-black/40 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                              Movie {quizState!.index + 1} of {localChallenge.size}
                          </span>
                      </div>
                  </div>
                  <button 
                    onClick={handleSkip}
                    disabled={!isMyTurn}
                    className="w-full py-4 border-2 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Skip this Movie
                  </button>
              </div>

              {/* Hints & Input Column */}
              <div className="lg:col-span-8 space-y-8">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                      <div className="space-y-3">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Initial Hint: Starring</h3>
                          <div className="flex flex-wrap gap-2">
                              {currentQuizMovie.cast?.slice(0, 2).map(c => (
                                  <span key={c.id} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold dark:text-slate-200">{c.name}</span>
                              ))}
                              {(!currentQuizMovie.cast || currentQuizMovie.cast.length === 0) && <span className="text-slate-400 text-xs italic">Cast details syncing...</span>}
                          </div>
                      </div>

                      <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Secondary Hint: Genres</h3>
                            {hintLevel < 1 && (
                                <button onClick={() => setHintLevel(1)} className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:underline">Unlock (+ Hint)</button>
                            )}
                          </div>
                          {hintLevel >= 1 ? (
                              <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-left-2">
                                  {currentQuizMovie.genres.map(g => (
                                      <span key={g} className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest">{g}</span>
                                  ))}
                              </div>
                          ) : (
                              <div className="h-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] text-slate-300 uppercase font-black">Locked</div>
                          )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Final Hint: Plot</h3>
                            {hintLevel < 2 && (
                                <button onClick={() => setHintLevel(2)} className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:underline">Unlock Plot (+ Hint)</button>
                            )}
                          </div>
                          {hintLevel >= 2 ? (
                              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic animate-in fade-in slide-in-from-top-2">
                                  "{currentQuizMovie.overview || 'No description available.'}"
                              </p>
                          ) : (
                              <div className="h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] text-slate-300 uppercase font-black">Plot hidden</div>
                          )}
                      </div>
                  </div>

                  <div className="relative">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Make your Guess</label>
                      <input 
                        type="text" 
                        value={guessQuery}
                        onChange={(e) => setGuessQuery(e.target.value)}
                        placeholder="Type movie title..."
                        disabled={!isMyTurn}
                        className="w-full p-6 bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-900/40 rounded-3xl text-xl font-bold outline-none focus:border-indigo-500 shadow-xl transition-all dark:text-white"
                      />
                      
                      {searchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 mt-4 overflow-hidden z-50 animate-in slide-in-from-top-2">
                              {searchResults.map(movie => (
                                  <button 
                                    key={movie.id}
                                    onClick={() => handleGuess(movie.id)}
                                    className="w-full p-5 text-left flex items-center gap-5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors"
                                  >
                                      <img src={movie.posterUrl} className="w-10 h-14 rounded shadow-sm object-cover" />
                                      <div>
                                          <p className="font-bold text-slate-900 dark:text-slate-100">{movie.title}</p>
                                          <p className="text-xs text-slate-500">{movie.year}</p>
                                      </div>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {localChallenge.type === 'BRACKET' && localChallenge.results?.bracketState && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {[localChallenge.results.bracketState.items[localChallenge.results.bracketState.index], localChallenge.results.bracketState.items[localChallenge.results.bracketState.index + 1]].map((mId, idx) => {
                  const movie = movies.find(m => m.id === mId);
                  return movie ? (
                      <button key={movie.id} disabled={!isMyTurn} onClick={() => handleBracketChoice(movie.id)} className="group mx-auto">
                          <img src={movie.posterUrl} className="w-64 aspect-[2/3] rounded-[2.5rem] border-4 border-transparent group-hover:border-indigo-500 transition shadow-2xl" />
                          <h3 className="mt-4 text-xl font-black dark:text-white line-clamp-1">{movie.title}</h3>
                      </button>
                  ) : <div key={`empty-${idx}`} className="w-64 h-96 bg-slate-200 animate-pulse rounded-[2.5rem]" />;
              })}
          </div>
      )}
    </div>
  );
};
