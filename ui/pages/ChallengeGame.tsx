
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
  const [isEnding, setIsEnding] = useState(false);
  const [showWrongShake, setShowWrongShake] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false); 
  
  const hasEverSeenChallenge = useRef(false);
  const storeHasSyncedRef = useRef(false);
  const fetchedIdsRef = useRef(new Set<string>());

  // Guess Game Specific State
  const [guessQuery, setGuessQuery] = useState('');
  const [hintLevel, setHintLevel] = useState(0); 
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<any>(null);

  // Sync Logic
  useEffect(() => {
    if (socialLoading) return;
    const found = challenges.find(c => c.id === id);
    if (found) {
      setLocalChallenge(found);
      hasEverSeenChallenge.current = true;
      storeHasSyncedRef.current = true;
    } else if (hasEverSeenChallenge.current && storeHasSyncedRef.current && !isEnding) {
        navigate('/social');
    }
  }, [challenges, id, navigate, isEnding, socialLoading]);

  // Turn Polling
  useEffect(() => {
    if (!user?.id || !id) return;
    const interval = setInterval(() => {
      fetchSocial(user.id, true);
    }, 4000);
    return () => clearInterval(interval);
  }, [id, user?.id, fetchSocial]);

  const quizState = useMemo(() => {
      if (localChallenge?.type !== 'GUESS_THE_MOVIE') return null;
      return localChallenge.results || { index: 0, correct: [], skipped: [], startTime: Date.now() };
  }, [localChallenge]);

  // INSTANT CAST RESOLUTION: Parallel High-Priority Fetches
  useEffect(() => {
    if (!localChallenge || !quizState) return;
    const currentIndex = quizState.index;
    const activeBatch = localChallenge.movieIds.slice(currentIndex, currentIndex + 3);

    activeBatch.forEach(async (mId) => {
      const inStore = movies.find(m => m.id === mId);
      // If movie is missing or has no cast, fetch immediately like Search Page does
      if ((!inStore || !inStore.cast || inStore.cast.length === 0) && !fetchedIdsRef.current.has(mId)) {
          fetchedIdsRef.current.add(mId);
          const fullMovie = await movieRepo.getMovieById(mId).catch(() => null);
          if (fullMovie) seedMovies([fullMovie]);
      }
    });
  }, [localChallenge, quizState?.index, movies, seedMovies]);

  // Timer & Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (guessQuery.length > 2) search(guessQuery);
      else clearSearch();
    }, 400);
    return () => clearTimeout(timer);
  }, [guessQuery]);

  useEffect(() => {
    if (localChallenge?.type === 'GUESS_THE_MOVIE' && localChallenge.status === 'ACTIVE' && localChallenge.turnUserId === user?.id) {
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
              setTimeLeft(prev => {
                  if (prev !== null && prev <= 1) { handleGameOver(); return 0; }
                  return prev !== null ? prev - 1 : null;
              });
          }, 1000);
        }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [localChallenge, user?.id]);

  const isMyTurn = localChallenge?.turnUserId === user?.id;
  const opponent = allUsers.find(u => u.id === (localChallenge?.creatorId === user?.id ? localChallenge?.recipientId : localChallenge?.creatorId));

  const gameMovies = useMemo(() => {
    if (!localChallenge) return [];
    return localChallenge.movieIds.map(mId => movies.find(m => m.id === mId) || { id: mId, title: '...', posterUrl: '', cast: [], genres: [] } as any);
  }, [localChallenge, movies]);

  const currentQuizMovie = useMemo(() => quizState ? gameMovies[quizState.index] : null, [quizState, gameMovies]);

  const handleNextTurn = async (newResults: any, isFinal: boolean = false) => {
    if (!id || !user || !localChallenge) return;
    const nextTurn = isFinal ? localChallenge.creatorId : (user.id === localChallenge.creatorId ? localChallenge.recipientId : localChallenge.creatorId);
    await updateChallenge(id, { status: isFinal ? 'COMPLETED' : 'ACTIVE', results: newResults, turnUserId: nextTurn });
  };

  const handleGameOver = () => localChallenge && handleNextTurn(localChallenge.results, true);

  const handleGuess = async (guessId: string) => {
      if (!isMyTurn || isRevealing || !currentQuizMovie) return;
      if (guessId !== currentQuizMovie.id) { setShowWrongShake(true); setTimeout(() => setShowWrongShake(false), 500); return; }
      setIsRevealing(true);
      const next = { ...quizState, correct: [...quizState!.correct, currentQuizMovie.id], index: quizState!.index + 1 };
      setGuessQuery(''); setHintLevel(0); clearSearch();
      setTimeout(() => { setIsRevealing(false); handleNextTurn(next, next.index >= gameMovies.length); }, 1500);
  };

  if (!localChallenge) return <div className="flex h-64 items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;

  if (localChallenge.status === 'COMPLETED') return (
    <div className="text-center space-y-8 pt-20">
      <h1 className="text-4xl font-black">Battle Complete!</h1>
      <p className="text-slate-500">Correct: {localChallenge.results?.correct?.length || 0}</p>
      <button onClick={() => navigate('/social')} className="px-8 py-4 bg-indigo-600 text-white font-black rounded-3xl">Back to Hub</button>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black">Guess the Movie</h1>
          <p className="text-sm text-slate-500">w/ {opponent?.firstName} • {isMyTurn ? 'Your Turn' : 'Waiting...'}</p>
        </div>
        <button onClick={() => navigate(-1)} className="text-xs font-black uppercase text-indigo-600">← Exit</button>
      </header>

      {currentQuizMovie && (
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-10 ${!isMyTurn ? 'opacity-50' : ''}`}>
          <div className={`aspect-[2/3] bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-6xl shadow-2xl overflow-hidden relative ${showWrongShake ? 'animate-bounce' : ''}`}>
            {!isRevealing ? '🕵️‍♂️' : <img src={currentQuizMovie.posterUrl} className="w-full h-full object-cover animate-in zoom-in-95" />}
            <div className="absolute top-4 left-4 px-4 py-2 bg-black/30 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase tracking-widest">Film {quizState!.index + 1} / {localChallenge.size}</div>
          </div>
          
          <div className="space-y-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 space-y-6">
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase text-indigo-500">The Cast</h3>
                <div className="flex flex-wrap gap-2">
                  {currentQuizMovie.cast?.slice(0, 3).map(c => <span key={c.id} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold">{c.name}</span>)}
                  {(!currentQuizMovie.cast || currentQuizMovie.cast.length === 0) && <p className="text-xs italic text-slate-400">Syncing cast credits...</p>}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><h3 className="text-[10px] font-black uppercase text-indigo-500">Plot</h3>{hintLevel < 1 && <button onClick={() => setHintLevel(1)} className="text-[9px] font-black uppercase text-indigo-500">Unlock</button>}</div>
                {hintLevel >= 1 ? <p className="text-xs italic leading-relaxed">"{currentQuizMovie.overview}"</p> : <div className="h-10 border-2 border-dashed rounded-xl flex items-center justify-center text-[10px] text-slate-300 font-black">LOCKED</div>}
              </div>
            </div>

            <div className="relative">
                <input 
                  type="text" value={guessQuery} onChange={e => setGuessQuery(e.target.value)} 
                  disabled={!isMyTurn || isRevealing} placeholder="Start typing title..."
                  className="w-full p-6 bg-white dark:bg-slate-900 border-2 border-indigo-100 rounded-[2rem] text-lg font-bold outline-none"
                />
                {searchResults.length > 0 && isMyTurn && !isRevealing && (
                    <div className="absolute bottom-full left-0 right-0 bg-white dark:bg-slate-800 rounded-2xl border mb-2 shadow-2xl overflow-hidden z-50">
                        {searchResults.map(m => (
                            <button key={m.id} onClick={() => handleGuess(m.id)} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 text-left border-b last:border-0">
                                <img src={m.posterUrl} className="w-10 rounded shadow-sm" />
                                <div><p className="font-bold text-sm">{m.title}</p><p className="text-xs text-slate-400">{m.year}</p></div>
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
