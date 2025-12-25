
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../state/authStore';
import { useMovieStore } from '../../state/movieStore';
import { WatchStatus, Movie } from '../../core/types/models';
import { movieRepo } from '../../data/repositories/movieRepo';
import { generateDetailReason } from '../../core/recommendations/engine';

export const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { userEntries, movies, updateEntry, deleteEntry } = useMovieStore();

  const [movie, setMovie] = useState<Movie | null>(null);
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
    const fetchMovie = async () => {
      if (!id) return;
      setLoading(true);
      const data = await movieRepo.getMovieById(id);
      if (data) {
        setMovie(data);
        setLoading(false);
        
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
    fetchMovie();
  }, [id, user, userEntries, movies]);

  useEffect(() => {
    if (entry) {
      setStatus(entry.status);
      setRating(entry.rating || 0);
      setDroppedReason(entry.droppedReason || '');
      setNotes(entry.notes || '');
    }
  }, [entry]);

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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-2 px-2"
      >
        ← Back
      </button>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/3 bg-slate-100 dark:bg-slate-800 flex-shrink-0">
            <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover min-h-[450px]" />
          </div>

          <div className="md:w-2/3 p-8 md:p-12 space-y-10">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">{movie.title}</h1>
              {movie.tagline && <p className="text-indigo-500 font-medium italic mt-2 text-sm">{movie.tagline}</p>}
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <span className="text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest">{movie.year}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest">
                  {movie.runtimeMins ? `${movie.runtimeMins} mins` : 'N/A'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {movie.genres.map(g => (
                  <span key={g} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase tracking-widest rounded-full">{g}</span>
                ))}
              </div>
            </div>

            {/* Storyline Section */}
            {movie.overview && (
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Storyline</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
                  {movie.overview}
                </p>
              </div>
            )}

            {/* Cast Section */}
            {movie.cast && movie.cast.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Top Cast</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                  {movie.cast.map(person => (
                    <div key={person.id} className="flex-shrink-0 w-20 text-center">
                      <div className="w-16 h-16 rounded-full overflow-hidden mx-auto bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {person.profilePath ? (
                          <img src={person.profilePath} className="w-full h-full object-cover" alt={person.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">👤</div>
                        )}
                      </div>
                      <p className="text-[9px] font-bold text-slate-900 dark:text-slate-100 mt-2 truncate">{person.name}</p>
                      <p className="text-[8px] text-slate-500 truncate">{person.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tracking Controls */}
            <div className="space-y-8 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest">Set Status</label>
                <div className="flex flex-wrap gap-3">
                  {(['WATCHED', 'WATCH_LATER', 'DROPPED'] as WatchStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition border ${
                        status === s 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {status === 'WATCHED' && (
                <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-800">
                  <label className="block text-xs font-black text-indigo-900 dark:text-indigo-400 mb-4 uppercase tracking-widest">Rating: {rating || 5}/10</label>
                  <input type="range" min="1" max="10" step="1" value={rating || 5} onChange={e => setRating(parseInt(e.target.value))} className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                </div>
              )}

              {status && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Private Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Thoughts..." className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl h-24 text-slate-900 dark:text-slate-100 outline-none resize-none" />
                </div>
              )}

              <div className="pt-4 flex gap-3">
                {status && (
                  <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-indigo-600 text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-indigo-700 transition disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Update Entry'}
                  </button>
                )}
                {entry && (
                  <button onClick={handleDelete} className="px-6 py-4 border border-red-200 text-red-500 font-black uppercase text-[10px] tracking-widest rounded-2xl">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🧠</span>
            <h2 className="text-[10px] font-black uppercase tracking-widest opacity-80">AI Reel Reason</h2>
          </div>
          {isAiLoading ? (
            <div className="h-4 bg-white/20 rounded-full w-3/4 animate-pulse" />
          ) : (
            <p className="text-xl font-bold leading-tight italic">"{aiReason || 'Analyzing patterns...'}"</p>
          )}
        </div>
      </section>
    </div>
  );
};
