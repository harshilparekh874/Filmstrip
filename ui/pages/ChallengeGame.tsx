
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
  const { challenges, updateChallenge, cancelChallenge, allUsers, fetchSocial, isLoading: socialLoading } = useSocialStore();
  const { movies, seedMovies, search, searchResults, clearSearch } = useMovieStore();

  const [localChallenge, setLocalChallenge] = useState<SocialChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [showWrongShake, setShowWrongShake] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false); // New state for post-guess reveal
  
  const hasAttemptedResolution = useRef(false);
  const isInitialLoadRef = useRef(true);
  const hasEverSeenChallenge = useRef(false);
  const storeHasSyncedRef = useRef(false);

  // Guess Game Specific State
  const [guessQuery, setGuessQuery] = useState('');
  const [hintLevel, setHintLevel] = useState(0); 
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<any>(null);

  // 1. DATA SYNC & DELETION POLLING
  useEffect(() => {
    if (socialLoading) return;
    const found = challenges.find(c => c.id === id);
    if (found) {
      setLocalChallenge(found);
      isInitialLoadRef.current = false;
      hasEverSeenChallenge.current = true;
      storeHasSyncedRef.current = true;
    } else {
      if (hasEverSeenChallenge.current && storeHasSyncedRef.current && !isEnding && !isInitialLoadRef.current) {
        alert("Battle terminated. Your opponent has ended this session.");
        navigate('/social');
      }
    }
  }, [challenges, id, navigate, isEnding, socialLoading]);

  // Turn detection
  useEffect(() => {
    if (!user?.id || !id) return;
    const interval = setInterval(() => {
      fetchSocial(user.id);
    }, 4000);
    return () => clearInterval(interval);
  }, [id, user?.id, fetchSocial]);

  // Initial Fetch
  useEffect(() => {
    const init = async () => {
      if (!user?.id || !id) return;
      const found = challenges.find(c => c.id === id);
      if (!found) {
        try { await fetchSocial(user.id); } catch (err) { setError("Failed to sync battle data."); }
      }
    };
    init();
  }, [id, user?.id, fetchSocial]);

  // 2. MOVIE METADATA RESOLUTION (Including Cast)
  useEffect(() => {
    const resolveMovies = async () => {
      if (!localChallenge || hasAttemptedResolution.current) return;
      // We check for cast presence specifically to ensure hints are ready
      const missingOrIncomplete = localChallenge.movieIds.filter(mId => {
        const m = movies.find(storeM => storeM.id === mId);
        return !m || !m.cast || m.cast.length === 0;
      });

      if (missingOrIncomplete.length > 0) {
        hasAttemptedResolution.current = true;
        try {
          const fetched = await Promise.all(missingOrIncomplete.map(mId => movieRepo.getMovieById(mId).catch(() => null)));
          const validMovies = fetched.filter(Boolean) as Movie[];
          if (validMovies.length > 0) seedMovies(validMovies);
        } catch (err) { console.error("Failed to fetch game movies", err); }
      }
    };
    resolveMovies();
  }, [localChallenge, movies, seedMovies]);

  // 3. GUESS GAME TIMER & SEARCH
  useEffect(() => {
    const timer = setTimeout(() => {
      if (guessQuery.length > 2) search(guessQuery);
      else clearSearch();
    }, 400);
    return () => clearTimeout(timer);
  }, [guessQuery]);

  useEffect(() => {
    if (localChallenge?.type === 'GUESS_THE_MOVIE' && localChallenge.status === 'ACTIVE' && localChallenge.turnUserId === user?.id) {
        if (timeLeft === null) {
            const limit = (localChallenge.config?.timeLimitMins || 5) * 60;
            const startTime = localChallenge.results?.startTime || Date.now();
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setTimeLeft(Math.max(0, limit - elapsed));
        }

        if (!timerRef.current) {
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
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [localChallenge, user?.id, timeLeft]);

  const isMyTurn = localChallenge?.turnUserId === user?.id;
  const opponentId = localChallenge?.creatorId === user?.id ? localChallenge?.recipientId : localChallenge?.creatorId;
  const opponent = allUsers.find(u => u.id === opponentId);

  const gameMovies = useMemo(() => {
    if (!localChallenge) return [];
    return localChallenge.movieIds.map(mId => {
      const found = movies.find(m => m.id === mId);
      if (found) return found;
      return { 
        id: mId, 
        title: 'Syncing DNA...', 
        posterUrl: 'https://via.placeholder.com/300x450?text=Syncing+Movie...',
        genres: [],
        year: 0,
        cast: []
      } as Movie;
    });
  }, [localChallenge, movies]);

  const quizState = useMemo(() => {
      if (localChallenge?.type !== 'GUESS_THE_MOVIE') return null;
      return localChallenge.results || { index: 0, correct: [], skipped: [], startTime: Date.now() };
  }, [localChallenge]);

  const currentQuizMovie = useMemo(() => {
    if (!quizState) return null;
    return gameMovies[quizState.index] || null;
  }, [quizState, gameMovies]);

  const handleEndBattle = async () => {
    if (!id || !user) return;
    if (window.confirm("End this battle? It will be removed for both players.")) {
        setIsEnding(true);
        try {
            await cancelChallenge(id);
            navigate('/social');
        } catch (err) {
            setIsEnding(false);
        }
    }
  };

  const handleNextTurn = async (newResults: any, isFinal: boolean = false) => {
    if (!id || !user || !localChallenge) return;
    const nextTurnUserId = isFinal 
        ? localChallenge.creatorId 
        : (user.id === localChallenge.creatorId ? localChallenge.recipientId : localChallenge.creatorId);

    await updateChallenge(id, {
      status: isFinal ? 'COMPLETED' : 'ACTIVE',
      results: newResults,
      turnUserId: nextTurnUserId
    });
  };

  const handleGameOver = () => {
      if (!localChallenge) return;
      handleNextTurn(localChallenge.results, true);
  };

  const handleGuess = async (guessMovieId: string) => {
      if (!isMyTurn || !quizState || !currentQuizMovie || isRevealing) return;
      
      const isCorrect = guessMovieId === currentQuizMovie.id;
      if (!isCorrect) {
          setShowWrongShake(true);
          setTimeout(() => setShowWrongShake(false), 500);
          return;
      }

      // Success Reveal Animation
      setIsRevealing(true);
      
      const nextResults = { 
          ...quizState, 
          correct: [...quizState.correct, currentQuizMovie.id],
          index: quizState.index + 1
      };

      setGuessQuery('');
      setHintLevel(0);
      clearSearch();

      // Wait 1.5s for player to see the poster before moving on
      setTimeout(() => {
        setIsRevealing(false);
        if (nextResults.index >= gameMovies.length) {
            handleNextTurn(nextResults, true);
        } else {
            handleNextTurn(nextResults);
        }
      }, 1500);
  };

  const handleSkip = () => {
    if (!isMyTurn || !quizState || !currentQuizMovie || isRevealing) return;
    const nextResults = {
        ...quizState,
        skipped: [...quizState.skipped, currentQuizMovie.id],
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

  if (!localChallenge) return (
    <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
      <div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Summoning Battleground...</p>
    </div>
  );

  if (localChallenge.status === 'COMPLETED') {
      const isQuiz = localChallenge.type === 'GUESS_THE_MOVIE';
      return (
          <div className="space-y-10 pb-32 animate-in fade-in duration-500 text-center max-w-2xl mx-auto">
              <header>
                <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Battle Finalized!</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Check out the results below.</p>
              </header>

              {isQuiz && (
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
              )}

              <div className="flex flex-col gap-4 mt-10">
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
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Guess the Movie</h1>
          <div className="flex items-center gap-3 mt-2">
              <p className="text-slate-500 dark:text-slate-400">
                Playing with <strong>{opponent?.firstName || 'Friend'}</strong> • 
                {isMyTurn ? <span className="text-indigo-600 dark:text-indigo-400 font-black ml-2 animate-pulse uppercase tracking-widest">Your Turn!</span> : <span className="text-slate-400 ml-2 italic">Waiting for {opponent?.firstName || 'friend'}...</span>}
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

      {/* GUESS THE MOVIE UI */}
      {localChallenge.type === 'GUESS_THE_MOVIE' && quizState && currentQuizMovie && (
          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-10 items-start transition-opacity duration-300 ${!isMyTurn ? 'opacity-80' : ''}`}>
              <div className="lg:col-span-4 space-y-6">
                  {/* Poster Display: Mystery Card until Reveal */}
                  <div className={`relative aspect-[2/3] rounded-[2.5rem] overflow-hidden bg-indigo-600 shadow-2xl border-4 border-white dark:border-slate-800 transition-all ${showWrongShake ? 'animate-bounce' : ''}`}>
                      {!isRevealing ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white">
                             <div className="text-6xl mb-4 drop-shadow-lg">🕵️‍♂️</div>
                             <p className="font-black text-[10px] uppercase tracking-[0.3em] opacity-80 text-center">Mystery Film</p>
                             <div className="mt-8 flex gap-1">
                                {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: `${i*200}ms` }} />)}
                             </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 animate-in zoom-in-95 duration-500">
                          <img src={currentQuizMovie.posterUrl} className="w-full h-full object-cover" alt="Revealed" />
                          <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center">
                             <div className="bg-white text-emerald-600 px-6 py-3 rounded-full font-black uppercase tracking-widest shadow-2xl animate-bounce">CORRECT!</div>
                          </div>
                        </div>
                      )}
                      
                      <div className="absolute top-4 left-4 right-4 text-center">
                          <span className="px-4 py-1.5 bg-black/40 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                              Movie {quizState!.index + 1} of {localChallenge.size}
                          </span>
                      </div>
                  </div>
                  <button 
                    onClick={handleSkip}
                    disabled={!isMyTurn || isRevealing}
                    className={`w-full py-4 border-2 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase text-xs tracking-widest rounded-2xl transition ${(!isMyTurn || isRevealing) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    Skip this Movie
                  </button>
              </div>

              <div className="lg:col-span-8 space-y-8">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                      {/* Hint 1: Cast */}
                      <div className="space-y-3">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Initial Hint: Starring</h3>
                          <div className="flex flex-wrap gap-2">
                              {currentQuizMovie.cast && currentQuizMovie.cast.length > 0 ? (
                                  currentQuizMovie.cast.slice(0, 3).map(c => (
                                      <span key={c.id} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/50">
                                        {c.name}
                                      </span>
                                  ))
                              ) : (
                                  <div className="flex items-center gap-2 text-slate-400 text-xs italic">
                                      <div className="animate-spin h-3 w-3 border-2 border-indigo-400 border-t-transparent rounded-full" />
                                      Syncing cast details...
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Hint 2: Genres */}
                      <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Secondary Hint: Genres</h3>
                            {hintLevel < 1 && isMyTurn && !isRevealing && (
                                <button onClick={() => setHintLevel(1)} className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:underline">Unlock Genres</button>
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

                      {/* Hint 3: Plot */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Final Hint: Plot</h3>
                            {hintLevel < 2 && isMyTurn && !isRevealing && (
                                <button onClick={() => setHintLevel(2)} className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:underline">Unlock Plot</button>
                            )}
                          </div>
                          {hintLevel >= 2 ? (
                              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic animate-in fade-in slide-in-from-top-2">
                                  "{currentQuizMovie.overview || 'No description available for this mystery.'}"
                              </p>
                          ) : (
                              <div className="h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] text-slate-300 uppercase font-black">Plot encrypted</div>
                          )}
                      </div>
                  </div>

                  <div className="relative">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Make your Guess</label>
                      <input 
                        type="text" 
                        value={guessQuery}
                        onChange={(e) => setGuessQuery(e.target.value)}
                        placeholder={isMyTurn && !isRevealing ? "Type movie title..." : (isRevealing ? "Great job!" : "Waiting for opponent...")}
                        disabled={!isMyTurn || isRevealing}
                        className={`w-full p-6 bg-white dark:bg-slate-900 border-2 rounded-3xl text-xl font-bold outline-none shadow-xl transition-all dark:text-white ${showWrongShake ? 'border-red-500' : 'border-indigo-100 dark:border-indigo-900/40 focus:border-indigo-500'} ${(!isMyTurn || isRevealing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                      
                      {searchResults.length > 0 && isMyTurn && !isRevealing && (
                          <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 mt-4 overflow-hidden z-50 animate-in slide-in-from-top-2">
                              {searchResults.map(movie => (
                                  <button 
                                    key={movie.id}
                                    onClick={() => handleGuess(movie.id)}
                                    className="w-full p-5 text-left flex items-center gap-5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors"
                                  >
                                      <img src={movie.posterUrl} className="w-10 h-14 rounded shadow-sm object-cover" alt="result" />
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
    </div>
  );
};
