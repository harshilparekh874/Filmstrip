
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { userRepo } from '../../data/repositories/userRepo';
import { movieRepo } from '../../data/repositories/movieRepo';
import { useAuthStore } from '../../state/authStore';
import { useSocialStore } from '../../state/socialStore';
import { useMovieStore } from '../../state/movieStore';
import { User, UserMovieEntry, Movie, ChallengeType, WatchStatus } from '../../core/types/models';
import { MovieCard } from '../components/MovieCard';

export const FriendProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { createChallenge } = useSocialStore();
  const { movies: storeMovies, seedMovies } = useMovieStore();

  const [friend, setFriend] = useState<User | null>(null);
  const [entries, setEntries] = useState<UserMovieEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [gameType, setGameType] = useState<ChallengeType>('BRACKET');
  const [gameSize, setGameSize] = useState<number>(16);
  const [timeLimit, setTimeLimit] = useState<number>(5);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setLoading(true);
      
      try {
        const [u, e] = await Promise.all([
          userRepo.getUserById(id),
          movieRepo.getUserEntries(id)
        ]);

        setFriend(u || null);
        const safeEntries = Array.isArray(e) ? e : [];
        setEntries(safeEntries);

        // Fetch missing movie metadata for the friend's entries
        const missingIds = safeEntries
          .map(entry => entry.movieId)
          .filter(mId => !storeMovies.find(sm => sm.id === mId));

        if (missingIds.length > 0) {
          const fetched = await Promise.all(
            missingIds.slice(0, 20).map(mId => movieRepo.getMovieById(mId).catch(() => null))
          );
          const validMovies = fetched.filter(Boolean) as Movie[];
          if (validMovies.length > 0) seedMovies(validMovies);
        }

      } catch (err) {
        console.error("Failed to load friend profile:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, seedMovies]);

  const handleTypeChange = (type: ChallengeType) => {
    setGameType(type);
    if (type === 'BRACKET') {
      setGameSize(16);
    } else if (type === 'TIERLIST') {
      setGameSize(10);
    } else {
      setGameSize(5);
      setTimeLimit(5);
    }
  };

  const handleStartChallenge = async () => {
    if (!currentUser || !friend) return;
    setIsCreating(true);
    
    try {
      const myEntries = await movieRepo.getUserEntries(currentUser.id);
      const safeMyEntries = Array.isArray(myEntries) ? myEntries : [];
      const safeFriendEntries = Array.isArray(entries) ? entries : [];
      
      const myWatched = safeMyEntries.filter(e => e.status === 'WATCHED').map(e => e.movieId);
      const friendWatched = safeFriendEntries.filter(e => e.status === 'WATCHED').map(e => e.movieId);
      
      let poolIds = Array.from(new Set([...myWatched, ...friendWatched]));
      const fillerPool = storeMovies.length > 0 ? storeMovies : await movieRepo.getAllMovies();
      const fillerIds = fillerPool.map(m => m.id).filter(id => !poolIds.includes(id));
      poolIds = [...poolIds, ...fillerIds.slice(0, Math.max(0, gameSize - poolIds.length))];
      
      const challengeIds = poolIds.sort(() => 0.5 - Math.random()).slice(0, gameSize);

      const challenge = await createChallenge({
        creatorId: currentUser.id,
        recipientId: friend.id,
        turnUserId: friend.id,
        type: gameType,
        size: gameSize as any,
        movieIds: challengeIds,
        status: 'ACTIVE',
        config: gameType === 'GUESS_THE_MOVIE' ? { timeLimitMins: timeLimit } : undefined,
        timestamp: Date.now()
      });

      navigate(`/social/challenge/${challenge.id}`);
    } catch (err) {
      console.error("Challenge creation failed", err);
    } finally {
      setIsCreating(false);
      setShowModal(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>;

  const renderSection = (title: string, status: WatchStatus, icon: string) => {
    const filteredEntries = entries
      .filter(e => e.status === status)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (filteredEntries.length === 0) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <span>{icon}</span>
            {title}
          </h2>
          <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {filteredEntries.length}
          </span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar px-2 -mx-2">
          {filteredEntries.map(entry => {
            const movie = storeMovies.find(m => m.id === entry.movieId);
            if (!movie) return (
              <div key={entry.movieId} className="w-32 h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse flex-shrink-0" />
            );
            return (
              <div key={movie.id} className="w-32 flex-shrink-0">
                <MovieCard movie={movie} badge={entry.rating ? `${entry.rating}/10` : undefined} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12 pb-32">
      <header className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative transition-colors">
        <div className="absolute top-0 left-0 right-0 h-32 bg-indigo-600/5 dark:bg-indigo-400/5" />
        <div className="relative flex flex-col items-center text-center">
          <img src={friend?.avatarUrl} className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-xl bg-white dark:bg-slate-800 object-cover" alt={friend?.name} />
          <div className="mt-4">
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{friend?.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">@{friend?.username}</p>
          </div>
          <div className="flex gap-4 mt-6">
            <button onClick={() => setShowModal(true)} className="px-8 py-3 bg-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-indigo-700 transition shadow-lg">🎮 Send Challenge</button>
          </div>
        </div>
      </header>

      <div className="space-y-12">
        {renderSection('Watched Recently', 'WATCHED', '✅')}
        {renderSection('Watchlist', 'WATCH_LATER', '🕒')}
        {renderSection('Dropped', 'DROPPED', '✖️')}
        
        {entries.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-400 italic">This friend hasn't tracked any movies yet.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 dark:border-slate-800 space-y-8 max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Challenge Setup</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Pick the game mode and difficulty.</p>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Game Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'BRACKET', label: 'Bracket', icon: '🥊' },
                  { id: 'TIERLIST', label: 'Tier List', icon: '📊' },
                  { id: 'GUESS_THE_MOVIE', label: 'Guess', icon: '🕵️' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => handleTypeChange(mode.id as ChallengeType)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition ${
                      gameType === mode.id 
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                    }`}
                  >
                    <span className="text-2xl">{mode.icon}</span>
                    <span className="text-[9px] font-black uppercase tracking-tighter dark:text-slate-200 text-center">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pool Size</label>
              <div className="grid grid-cols-3 gap-2">
                {[16, 32, 64].map(s => {
                    const sizes = gameType === 'BRACKET' ? [16, 32, 64] : (gameType === 'TIERLIST' ? [10, 20, 50] : [5, 10, 20]);
                    if (!sizes.includes(s) && gameType !== 'BRACKET') return null;
                    return (
                        <button
                          key={s}
                          onClick={() => setGameSize(s)}
                          className={`py-3 rounded-xl font-black text-sm transition ${
                            gameSize === s 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {s} Items
                        </button>
                    );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-2xl transition">Cancel</button>
              <button onClick={handleStartChallenge} disabled={isCreating} className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg">
                {isCreating ? 'Creating...' : 'Start Battle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
