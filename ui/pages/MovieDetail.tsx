
// Fix: Added React to the import to satisfy the React.FC namespace requirement
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
        // Show movie info first
        setLoading(false);
        
        // Then request AI reason if not already requested for this mount
        if (user && !aiRequestedRef.current) {
          aiRequestedRef.current = true;
          setIsAiLoading(true);
          try {
            const reason = await generateDetailReason(data, user, userEntries, movies);
            setAiReason(reason);
          } catch (err) {
            setAiReason('Analytical link verified.');
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
  
  if (!movie) return <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl shadow-sm dark:text-slate-300">Movie not found.</div>;

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
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={() => navigate(-1)}
        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-2 px-2"
      >
        ← Back
      </button>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/3 bg-slate-100 dark:bg-slate-800 flex-shrink-0">
            <img 
              src={movie.posterUrl} 
              alt={movie.title} 
              className="w-full h-full object-cover min-h-[400px]"
            />
          </div>

          <div className="md:w-2/3 p-8 md:p-12">
            <div className="mb-10">
              <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{movie.title}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <span className="text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest">{movie.year}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest">{movie.runtimeMins} mins</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-6">
                {movie.genres.map(g => (
                  <span key={g} className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-full">{g}</span>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-4 uppercase tracking-widest ml-1">Set Status</label>
                <div className="flex flex-wrap gap-3">
                  {(['WATCHED', 'WATCH_LATER', 'DROPPED'] as WatchStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition border ${
                        status === s 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200 dark:shadow-none' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {status === 'WATCHED' && (
                <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-800 transition-colors">
                  <label className="block text-xs font-black text-indigo-900 dark:text-indigo-400 mb-4 uppercase tracking-widest">Rating: {rating || 5}/10</label>
                  <input 
                    type="range" min="1" max="10" step="1" 
                    value={rating || 5} 
                    onChange={e => setRating(parseInt(e.target.value))}
                    className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-indigo-600 transition-colors"
                  />
                </div>
              )}

              {status === 'DROPPED' && (
                <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30 transition-colors">
                  <label className="block text-xs font-black text-red-900 dark:text-red-400 mb-4 uppercase tracking-widest">Why did you drop it?</label>
                  <select 
                    value={droppedReason} 
                    onChange={e => setDroppedReason(e.target.value)}
                    className="w-full p-4 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/30 rounded-2xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-slate-100 outline-none transition-colors"
                  >
                    <option value="">Select a reason...</option>
                    <option value="Too slow / Boring">Too slow / Boring</option>
                    <option value="Bad acting">Bad acting</option>
                    <option value="Poor plot">Poor plot</option>
                    <option value="Not my style">Not my style</option>
                    <option value="Found something better">Found something better</option>
                  </select>
                </div>
              )}

              {status && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-widest ml-1">Private Notes</label>
                  <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add thoughts, tags, or where you watched it..."
                    className="w-full p-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl h-32 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 outline-none resize-none transition-colors"
                  />
                </div>
              )}

              <div className="pt-6 flex flex-col sm:flex-row gap-4">
                {status && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest py-5 rounded-3xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition disabled:opacity-50 shadow-xl shadow-slate-100 dark:shadow-none"
                  >
                    {isSaving ? 'Saving...' : (entry ? 'Update Entry' : 'Add to Collection')}
                  </button>
                )}
                
                {entry && (
                  <button
                    onClick={handleDelete}
                    className="px-8 py-5 border border-red-200 dark:border-red-900/30 text-red-500 font-black uppercase tracking-widest text-xs rounded-3xl hover:bg-red-50 dark:hover:bg-red-900/10 transition"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="bg-indigo-600 dark:bg-indigo-500 p-8 md:p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <h2 className="text-sm font-black uppercase tracking-widest opacity-80">AI Reel Reason</h2>
          </div>
          
          {isAiLoading ? (
            <div className="space-y-3">
              <div className="h-4 bg-white/20 rounded-full w-3/4 animate-pulse" />
              <div className="h-4 bg-white/20 rounded-full w-1/2 animate-pulse" />
            </div>
          ) : aiReason ? (
            <p className="text-xl md:text-2xl font-bold leading-tight italic">
              "{aiReason}"
            </p>
          ) : (
            <p className="opacity-70 text-sm">
                Track more movies you love to get personalized reasoning!
            </p>
          )}
          
          <div className="pt-4 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Synthesized for {user?.firstName}</span>
          </div>
        </div>
      </section>
    </div>
  );
};
