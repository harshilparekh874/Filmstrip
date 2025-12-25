
import React, { useEffect, useState, useMemo } from 'react';
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
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const [u, e] = await Promise.all([userRepo.getUserById(id), movieRepo.getUserEntries(id)]);
      if (u) setFriend(u);
      if (e) setEntries(e);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleStartChallenge = async () => {
    if (!currentUser || !friend) return;
    setIsCreating(true);
    
    try {
      const [myE, filler] = await Promise.all([movieRepo.getUserEntries(currentUser.id), movieRepo.getAllMovies()]);
      const myWatched = myE.filter(e => e.status === 'WATCHED').map(e => e.movieId);
      const friendWatched = entries.filter(e => e.status === 'WATCHED').map(e => e.movieId);
      
      let pool = Array.from(new Set([...myWatched, ...friendWatched]));
      const fillerIds = filler.map(m => m.id).filter(id => !pool.includes(id));
      pool = [...pool, ...fillerIds];

      // NO ANIMATION RULE for Guess Games
      if (gameType === 'GUESS_THE_MOVIE') {
          // Cross-reference with seeded store to filter out Animation
          const animationIds = new Set(storeMovies.filter(m => m.genres.includes('Animation')).map(m => m.id));
          pool = pool.filter(pid => !animationIds.has(pid));
      }
      
      if (pool.length < gameSize) {
          alert(`Need ${gameSize} valid movies. Found ${pool.length}. Add more to your lists!`);
          setIsCreating(false); return;
      }

      const ids = pool.sort(() => Math.random() - 0.5).slice(0, gameSize);
      const c = await createChallenge({ creatorId: currentUser.id, recipientId: friend.id, type: gameType, size: gameSize as any, movieIds: ids, status: 'ACTIVE' });
      navigate(`/social/challenge/${c.id}`);
    } catch (err) {
      alert("Creation failed.");
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-12 pb-32">
      <header className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm relative text-center">
        <div className="relative">
          <img src={friend?.avatarUrl} className="w-24 h-24 rounded-full mx-auto border-4 border-white shadow-xl object-cover" />
          <h1 className="text-3xl font-black mt-4">{friend?.name}</h1>
          <p className="text-slate-500 font-bold">@{friend?.username}</p>
          <button onClick={() => setShowModal(true)} className="mt-8 px-10 py-4 bg-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl">🎮 Battle Friend</button>
        </div>
      </header>

      <div className="space-y-12">
        {['WATCHED', 'WATCH_LATER'].map(status => {
            const filtered = entries.filter(e => e.status === status);
            if (filtered.length === 0) return null;
            return (
              <div key={status} className="space-y-6">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">{status.replace('_', ' ')}</h2>
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {filtered.map(e => {
                    const m = storeMovies.find(m => m.id === e.movieId);
                    return m ? <div key={m.id} className="w-32 flex-shrink-0"><MovieCard movie={m} /></div> : null;
                  })}
                </div>
              </div>
            );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-8">
            <h2 className="text-2xl font-black text-center">Battle Setup</h2>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {['BRACKET', 'TIERLIST', 'GUESS_THE_MOVIE'].map(t => (
                  <button key={t} onClick={() => setGameType(t as any)} className={`p-3 rounded-2xl border-2 text-[10px] font-black uppercase ${gameType === t ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100'}`}>{t.split('_')[0]}</button>
                ))}
              </div>
            </div>
            <button onClick={handleStartChallenge} disabled={isCreating} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl">{isCreating ? 'Preparing...' : 'Start Battle'}</button>
            <button onClick={() => setShowModal(false)} className="w-full text-xs font-bold text-slate-400">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};
