
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../state/authStore';
import { useThemeStore } from '../../state/themeStore';
import { tmdbApi } from '../../data/api/tmdbApi';
import { movieRepo } from '../../data/repositories/movieRepo';
import { Movie } from '../../core/types/models';
import { parseLetterboxdCSV } from '../../core/utils/csvParser';
import { useMovieStore } from '../../state/movieStore';

const GENRES = [
  'Hindi Language', 'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Romance', 'Documentary', 'Animation',
  'Adventure', 'Fantasy', 'Mystery', 'Crime', 'Western', 'Musical', 'War', 'History', 'Biography', 'Family', 'Sport', 'Indie',
  'Noir', 'Psychological', 'Superhero', 'Supernatural', 'Satire', 'Mockumentary', 'Cyberpunk', 'Post-Apocalyptic', 'Anime', 'Experimental'
];

export const MyProfile: React.FC = () => {
  const { user, updateUser, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { batchImportWatched } = useMovieStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    favoriteGenres: user?.favoriteGenres || [],
    avatarUrl: user?.avatarUrl || ''
  });

  const [favMovie, setFavMovie] = useState<Movie | null>(null);
  const [movieSearch, setMovieSearch] = useState('');
  const [movieResults, setMovieResults] = useState<Movie[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);

  useEffect(() => {
    const loadFav = async () => {
      if (user?.favoriteMovieId) {
        const m = await movieRepo.getMovieById(user.favoriteMovieId);
        if (m) setFavMovie(m);
      }
    };
    loadFav();
  }, [user?.favoriteMovieId]);

  useEffect(() => {
    if (movieSearch.length > 2) {
      const search = async () => {
        const results = await tmdbApi.searchMovies(movieSearch);
        setMovieResults(results.slice(0, 5));
      };
      search();
    } else {
      setMovieResults([]);
    }
  }, [movieSearch]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const parsed = parseLetterboxdCSV(text);
      if (parsed.length > 0) {
        setImportProgress(0);
        await batchImportWatched(user.id, parsed, (p) => setImportProgress(p));
        setImportProgress(null);
        alert(`Successfully processed ${parsed.length} movies!`);
      } else {
        alert("Could not find any movies in that CSV. Check the format!");
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateUser({
      ...formData,
      favoriteMovieId: favMovie?.id
    });
    setIsSaving(false);
    setIsEditing(false);
  };

  const toggleGenre = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      favoriteGenres: prev.favoriteGenres.includes(genre)
        ? prev.favoriteGenres.filter(g => g !== genre)
        : [...prev.favoriteGenres, genre]
    }));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center relative overflow-hidden transition-colors">
        <div className="absolute top-0 left-0 right-0 h-24 bg-indigo-50 dark:bg-indigo-900/10" />
        <div className="relative group">
          <div className="relative inline-block">
            <img 
              src={isEditing ? formData.avatarUrl : user.avatarUrl} 
              className="w-24 h-24 rounded-full mx-auto border-4 border-white dark:border-slate-800 shadow-lg bg-white dark:bg-slate-800 object-cover" 
              alt="My Avatar" 
            />
            {isEditing && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <span className="text-xs font-black uppercase tracking-widest">Change</span>
              </button>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageChange} 
            className="hidden" 
            accept="image/*" 
          />
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-4 tracking-tight">
            {isEditing ? `${formData.firstName} ${formData.lastName}` : user.name}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">@{user.username}</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{user.email}</p>
        </div>
      </section>

      {!isEditing && (
        <section className="bg-emerald-600 dark:bg-emerald-500 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden transition-colors">
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="flex items-center justify-between gap-6 relative">
            <div className="space-y-2">
              <h2 className="text-sm font-black uppercase tracking-widest opacity-80 flex items-center gap-2">
                <span>Migration</span>
                <span className="px-2 py-0.5 bg-white/20 rounded-md text-[10px]">Letterboxd</span>
              </h2>
              <h3 className="text-xl font-bold">Import your watch history</h3>
              <p className="text-sm opacity-70">Upload your Letterboxd CSV to sync your library instantly.</p>
            </div>
            
            <button 
              onClick={() => csvInputRef.current?.click()}
              disabled={importProgress !== null}
              className={`flex-shrink-0 px-6 py-3 bg-white text-emerald-600 font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg transition active:scale-95 ${importProgress !== null ? 'opacity-50' : 'hover:bg-emerald-50'}`}
            >
              {importProgress !== null ? `Syncing ${importProgress}%` : 'Upload CSV'}
            </button>
            <input 
              type="file" 
              ref={csvInputRef} 
              onChange={handleCSVImport} 
              className="hidden" 
              accept=".csv" 
            />
          </div>
          {importProgress !== null && (
            <div className="mt-6 h-1 w-full bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          )}
        </section>
      )}

      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Appearance</h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">{isDarkMode ? 'Dark Mode Active' : 'Light Mode Active'}</p>
          </div>
          <button 
            onClick={toggleTheme}
            className={`w-14 h-8 rounded-full transition-all relative ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all ${isDarkMode ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        {isEditing && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">First Name</label>
              <input 
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
                className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Last Name</label>
              <input 
                value={formData.lastName}
                onChange={e => setFormData({...formData, lastName: e.target.value})}
                className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
              />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 transition-colors">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 ml-1">Favorite Genres</h2>
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition border ${formData.favoriteGenres.includes(g) ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  {g}
                </button>
              ))
            ) : (
              user.favoriteGenres.map(g => (
                <span key={g} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-full border border-indigo-100 dark:border-indigo-800">
                  {g}
                </span>
              ))
            )}
            {user.favoriteGenres.length === 0 && !isEditing && <p className="text-slate-400 italic text-sm">No favorites selected yet.</p>}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 transition-colors">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 ml-1">All-Time Favorite</h2>
          
          {isEditing ? (
            <div className="space-y-3">
              {favMovie ? (
                <div className="flex items-center gap-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800 animate-in zoom-in-95 duration-200">
                  <img src={favMovie.posterUrl} className="w-12 rounded-lg" />
                  <div className="flex-1">
                    <p className="font-bold text-indigo-900 dark:text-indigo-100">{favMovie.title}</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">{favMovie.year}</p>
                  </div>
                  <button onClick={() => setFavMovie(null)} className="text-red-400 text-lg font-black px-3">✕</button>
                </div>
              ) : (
                <div className="relative">
                  <input 
                    placeholder="Search for a new favorite..."
                    value={movieSearch}
                    onChange={e => setMovieSearch(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                  {movieResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl mt-2 shadow-2xl z-50 overflow-hidden">
                      {movieResults.map(m => (
                        <button 
                          key={m.id}
                          onClick={() => { setFavMovie(m); setMovieSearch(''); setMovieResults([]); }}
                          className="w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-4 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
                        >
                          <img src={m.posterUrl} className="w-10 h-14 rounded object-cover shadow-sm" />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">{m.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{m.year}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            favMovie ? (
              <div className="flex items-center gap-6">
                <img src={favMovie.posterUrl} className="w-20 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{favMovie.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{favMovie.year} • {favMovie.genres[0] || 'Drama'}</p>
                  <button onClick={() => navigate(`/movie/${favMovie.id}`)} className="mt-3 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest">View Details →</button>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 italic text-sm">Pick a movie that defined your life!</p>
            )
          )}
        </div>

        <div className="flex flex-col gap-3">
          {isEditing ? (
            <>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition"
              >
                {isSaving ? 'Saving Changes...' : 'Save Profile'}
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition shadow-lg shadow-slate-200 dark:shadow-none"
            >
              Edit Profile
            </button>
          )}
        </div>

        <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full py-4 text-red-500 font-bold rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/10 transition border border-red-100 dark:border-red-900/30"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};
