
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../state/authStore';
import { useMovieStore } from '../../state/movieStore';
import { WatchStatus, Movie } from '../../core/types/models';
import { movieRepo } from '../../data/repositories/movieRepo';
import { tmdbApi } from '../../data/api/tmdbApi';
import { generateDetailReason } from '../../core/recommendations/engine';
import { MovieCard } from '../components/MovieCard';

export const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { userEntries, movies, updateEntry, deleteEntry } = useMovieStore();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiReason, setAiReason] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const entry = userEntries.find(e => e.movieId === id);
  const aiRequestedRef = useRef(false);

  const [status, setStatus] = useState<WatchStatus | ''>('');
  const [rating, setRating] = useState<number>(0);
  const [droppedReason, setDroppedReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchMovieData = async () => {
      if (!id) return;
      setLoading(true);
      const data = await movieRepo.getMovieById(id);
      if (data) {
        setMovie(data);
        setLoading(false);
        
        // Reset AI state for new movie
        aiRequestedRef.current = false;
        setAiReason('');
        
        // Fetch similar movies (using refined structural metadata endpoint)
        try {
          const similar = await tmdbApi.getSimilarMovies(id);
          setSimilarMovies(similar.slice(0, 4));
        } catch (err) {
          console.warn("Failed to fetch similar movies");
        }

        if (user && !aiRequestedRef.current) {
          aiRequestedRef.current = true;
          setIsAiLoading(true);
          try {
            const reason = await generateDetailReason(data, user, userEntries, movies);
            setAiReason(reason);
          } catch (err) {
            setAiReason('Matches your preference patterns.');
          } finally {
            setIsAiLoading(false);
          }
        }
      } else {
        setLoading(false);
      }
    };
    fetchMovieData();
  }, [id, user, userEntries, movies]);

  useEffect(() => {
    if (entry) {
      setStatus(entry.status);
      setRating(entry.rating || 0);
      setDroppedReason(entry.droppedReason || '');
      setNotes(entry.notes || '');
    } else {
      setStatus('');
      setRating(0);
      setDroppedReason('');
      setNotes('');
    }
  }, [entry, id]);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
    </div>
  );
  
  if (!movie) return <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl dark:text-slate-300">Movie not found.</div>;

  const handleSave = async () => {
    if (!user || !status) return;
    setIsSaving(true);
    await updateEntry({
      userId: user.id,
      movieId: movie.id,
      status: status as WatchStatus,
      rating: status === 'WATCHED' ? rating : undefined,
      droppedReason: status === 'DROPPED' ? droppedReason : undefined,
      notes: notes,
      timestamp: Date.now()
    } as any);
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!user) return;
    if (window.confirm('Remove from your list?')) {
      await deleteEntry(user.id, movie.id);
      setStatus('');
      setRating(0);
      setDroppedReason('');
      setNotes('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <button 
        onClick={() => navigate(-1)}
        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 px-2"
      >
        ← Back to journey
      </button>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/3 bg-slate-100 dark:bg-slate-800 flex-shrink-0">
            <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover min-h-[450px]" />
          </div>

          <div className="md:w-2/3 p-8 md:p-12 space-y-12">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">{movie.title}</h1>
              {movie.tagline && <p className="text-indigo-500 font-bold italic mt-3 text-sm">{movie.tagline}</p>}
              <div className="flex flex-wrap items-center gap-4 mt-6">
                <span className="text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">{movie.year}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">
                  {movie.runtimeMins ? `${movie.runtimeMins} mins` : 'N/A'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {movie.genres.map(g => (
                  <span key={g} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase tracking-widest rounded-full">{g}</span>
                ))}
              </div>
            </div>

            {movie.overview && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">The Storyline</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-medium">
                  {movie.overview}
                </p>
              </div>
            )}

            {movie.cast && movie.cast.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Starring</h3>
                <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar px-2 -mx-2">
                  {movie.cast.map(person => (
                    <div key={person.id} className="flex-shrink-0 w-20 text-center">
                      <div className="w-16 h-16 rounded-full overflow-hidden mx-auto bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                        {person.profilePath ? (
                          <img src={person.profilePath} className="w-full h-full object-cover" alt={person.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">👤</div>
                        )}
                      </div>
                      <p className="text-[9px] font-bold text-slate-900 dark:text-slate-100 mt-2 truncate">{person.name}</p>
                      <p className="text-[8px] text-slate-500 font-medium truncate">{person.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-5 uppercase tracking-[0.2em]">Update Status</label>
                <div className="flex flex-wrap gap-4">
                  {(['WATCHED', 'WATCH_LATER', 'DROPPED'] as WatchStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-6 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                        status === s 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-105' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-200'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {status === 'WATCHED' && (
                <div className="p-8 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2rem] border border-indigo-100 dark:border-indigo-800 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-5">
                    <label className="text-[10px] font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-widest">Score It</label>
                    <span className="text-2xl font-black text-indigo-600">{rating || 5}/10</span>
                  </div>
                  <input type="range" min="1" max="10" step="1" value={rating || 5} onChange={e => setRating(parseInt(e.target.value))} className="w-full h-3 bg-indigo-200 dark:bg-indigo-900 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                </div>
              )}

              {status && (
                <div className="animate-in fade-in duration-300">
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest ml-1">Personal Log</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Private thoughts on this film..." className="w-full p-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] h-28 text-slate-900 dark:text-slate-100 outline-none resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium" />
                </div>
              )}

              <div className="pt-4 flex gap-4">
                {status && (
                  <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-indigo-600 text-white font-black uppercase tracking-widest py-5 rounded-[1.5rem] hover:bg-indigo-700 transition disabled:opacity-50 shadow-2xl active:scale-[0.98]">
                    {isSaving ? 'Syncing...' : 'Confirm Update'}
                  </button>
                )}
                {entry && (
                  <button onClick={handleDelete} className="px-8 py-5 border-2 border-red-200 dark:border-red-900/30 text-red-500 font-black uppercase text-[10px] tracking-widest rounded-[1.5rem] hover:bg-red-50 transition active:scale-[0.98]">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="bg-slate-900 dark:bg-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden transition-all hover:shadow-indigo-500/10">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="relative space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">🧠</div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">AI Reasoning</h2>
          </div>
          {isAiLoading ? (
            <div className="space-y-3">
               <div className="h-4 bg-white/10 rounded-full w-full animate-pulse" />
               <div className="h-4 bg-white/10 rounded-full w-2/3 animate-pulse" />
            </div>
          ) : (
            <p className="text-2xl font-bold leading-tight italic tracking-tight">"{aiReason || 'Analyzing film DNA...'}"</p>
          )}
        </div>
      </section>

      {/* Similar Movies Section */}
      {similarMovies.length > 0 && (
        <section className="space-y-8 animate-in fade-in duration-700">
          <div className="flex items-center gap-6 px-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Thematically <span className="text-indigo-600 dark:text-indigo-400">Similar</span>
            </h2>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-2">
            {similarMovies.map(m => (
              <div key={m.id} className="hover:scale-105 transition-transform duration-300">
                <MovieCard movie={m} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
