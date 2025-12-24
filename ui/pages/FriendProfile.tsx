
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { userRepo } from '../../data/repositories/userRepo';
import { movieRepo } from '../../data/repositories/movieRepo';
import { useAuthStore } from '../../state/authStore';
import { useSocialStore } from '../../state/socialStore';
import { useMovieStore } from '../../state/movieStore';
import { User, UserMovieEntry, Movie, ChallengeType } from '../../core/types/models';
import { MovieCard } from '../components/MovieCard';
import { tmdbApi } from '../../data/api/tmdbApi';

export const FriendProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { createChallenge } = useSocialStore();
  const { movies: storeMovies, seedMovies } = useMovieStore();

  const [friend, setFriend] = useState<User | null>(null);
  const [entries, setEntries] = useState<UserMovieEntry[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [favMovie, setFavMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [gameType, setGameType] = useState<ChallengeType>('BRACKET');
  const [gameSize, setGameSize] = useState<10 | 20 | 50>(10);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setLoading(true);
      
      try {
        const [u, e, m] = await Promise.all([
          userRepo.getUserById(id),
          movieRepo.getUserEntries(id),
          movieRepo.getAllMovies(),
        ]);

        setFriend(u || null);
        setEntries(Array.isArray(e) ? e : []);
        setMovies(Array.isArray(m) ? m : []);

        if (u?.favoriteMovieId) {
          const fm = await movieRepo.getMovieById(u.favoriteMovieId);
          setFavMovie(fm || null);
        }
      } catch (err) {
        console.error("Failed to load friend profile:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

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
      
      // If combined history is too small, supplement from the store or TMDB popular
      if (poolIds.length < gameSize) {
          const fillerPool = storeMovies.length > 0 ? storeMovies : await movieRepo.getAllMovies();
          const fillerIds = fillerPool.map(m => m.id).filter(id => !poolIds.includes(id));
          poolIds = [...poolIds, ...fillerIds.slice(0, gameSize - poolIds.length)];
      }
      
      const challengeIds = poolIds.sort(() => 0.5 - Math.random()).slice(0, gameSize);

      const challenge = await createChallenge({
        creatorId: currentUser.id,
        recipientId: friend.id,
        type: gameType,
        size: gameSize,
        movieIds: challengeIds,
        status: 'PENDING'
      });

      navigate(`/social/challenge/${challenge.id}`);
    } catch (err) {
      console.error("Challenge creation failed", err);
      alert("Error starting challenge. Please check your connection.");
    } finally {
      setIsCreating(false);
      setShowModal(false);
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
    </div>
  );

  if (!friend) return (
    <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">User Not Found</h2>
      <p className="text-slate-500 dark:text-slate-400 mt-2">This user might have deleted their account or the link is invalid.</p>
      <button onClick={() => navigate('/social')} className="mt-6 text-indigo-600 font-bold uppercase text-xs tracking-widest">Return to Social Hub</button>
    </div>
  );

  const watched = entries.filter(e => e.status === 'WATCHED');
  const dropped = entries.filter(e => e.status === 'DROPPED');
  const later = entries.filter(e => e.status === 'WATCH_LATER');

  const Section = ({ title, data }: { title: string, data: UserMovieEntry[] }) => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      {data.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {data.map(entry => {
            const movie = movies.find(m => m.id === entry.movieId);
            return movie ? (
              <MovieCard 
                key={movie.id} 
                movie={movie} 
                badge={entry.rating ? `${entry.rating}/10` : undefined}
              />
            ) : null;
          })}
        </div>
      ) : (
        <p className="text-slate-400 italic text-sm">Nothing tracked yet.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-10">
      <header className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative transition-colors">
        <div className="absolute top-0 left-0 right-0 h-32 bg-indigo-600/5 dark:bg-indigo-400/5" />
        
        <div className="relative flex flex-col items-center text-center">
          <img src={friend.avatarUrl} className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-xl bg-white dark:bg-slate-800 object-cover" alt={friend.name} />
          <div className="mt-4">
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{friend.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">@{friend.username}</p>
          </div>

          <div className="flex gap-4 mt-6">
            <button 
                onClick={() => setShowModal(true)}
                className="px-8 py-3 bg-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 dark:shadow-none"
            >
                🎮 Start Battle
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {(friend.favoriteGenres || []).map(g => (
              <span key={g} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase rounded-full tracking-widest">
                {g}
              </span>
            ))}
          </div>

          <div className="flex gap-10 mt-8 border-y border-slate-50 dark:border-slate-800 py-6 w-full justify-center transition-colors">
            <div className="text-center">
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{watched.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-black">Watched</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-slate-600 dark:text-slate-300">{later.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-black">Later</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-red-400">{dropped.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-black">Dropped</p>
            </div>
          </div>

          {favMovie && (
            <div className="mt-8 text-left w-full max-w-sm mx-auto bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1 text-center">All-Time Favorite</p>
              <Link to={`/movie/${favMovie.id}`} className="flex items-center gap-4 group">
                <img src={favMovie.posterUrl} className="w-16 rounded-xl shadow-md group-hover:scale-105 transition" />
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{favMovie.title}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{favMovie.year}</p>
                </div>
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-12">
        <Section title="Watched Movies" data={watched} />
        <Section title="Watchlist" data={later} />
        <Section title="Dropped" data={dropped} />
      </div>

      {/* Challenge Configuration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 dark:border-slate-800 space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Challenge Setup</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Pick your battlefield with {friend.firstName}.</p>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Game Mode</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'BRACKET', label: 'Bracket Fight', icon: '🥊' },
                  { id: 'TIERLIST', label: 'Tier List', icon: '📊' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setGameType(mode.id as ChallengeType)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition ${
                      gameType === mode.id 
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                    }`}
                  >
                    <span className="text-3xl">{mode.icon}</span>
                    <span className="text-xs font-bold dark:text-slate-200">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pool Size</label>
              <div className="grid grid-cols-3 gap-2">
                {[10, 20, 50].map(s => (
                  <button
                    key={s}
                    onClick={() => setGameSize(s as any)}
                    className={`py-3 rounded-xl font-black text-sm transition ${
                      gameSize === s 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {s} Items
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleStartChallenge}
                disabled={isCreating}
                className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none"
              >
                {isCreating ? 'Creating...' : 'Start Battle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
