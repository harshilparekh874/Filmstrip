
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../state/authStore';
import { tmdbApi } from '../../data/api/tmdbApi';
import { Movie } from '../../core/types/models';

type Step = 'EMAIL' | 'VERIFY' | 'PROFILE' | 'AVATAR' | 'PREFERENCES';

const PRESET_AVATARS = [
  'Felix', 'Aneka', 'Casper', 'Willow', 'Jasper', 'Milo', 'Luna', 'Cleo'
].map(seed => `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`);

const GENRES = [
  'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Romance', 'Documentary', 'Animation', 'Fantasy'
];

export const Login: React.FC = () => {
  const { signup, login, sendOtp, verifyOtp, emailContext } = useAuthStore();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('EMAIL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    code: '',
    firstName: '',
    lastName: '',
    username: '',
    avatarUrl: PRESET_AVATARS[0],
    favoriteGenres: [] as string[],
    favoriteMovieId: ''
  });

  const [movieSearch, setMovieSearch] = useState('');
  const [movieResults, setMovieResults] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  useEffect(() => {
    if (movieSearch.length > 2) {
      tmdbApi.searchMovies(movieSearch).then(res => setMovieResults(res.slice(0, 5)));
    }
  }, [movieSearch]);

  const handleEmailSubmit = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await sendOtp(formData.email);
      setStep('VERIFY');
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySubmit = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await verifyOtp(formData.code);
      if (res.isNewUser) {
        setStep('PROFILE');
      } else {
        await login(res.userId!);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await signup({
        ...formData,
        favoriteMovieId: selectedMovie?.id
      });
      navigate('/dashboard');
    } catch (err) {
      setError('Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f1115] px-4 py-10">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${(['EMAIL', 'VERIFY', 'PROFILE', 'AVATAR', 'PREFERENCES'].indexOf(step) + 1) * 20}%` }}
          />
        </div>

        <div className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl">
              ⚠️ {error}
            </div>
          )}

          {step === 'EMAIL' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center">
                <h1 className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter mb-2">Filmstrip</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Join the global community of film lovers.</p>
              </div>
              <div className="space-y-4">
                <input 
                  type="email" 
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-transparent focus:border-indigo-500 text-slate-900 dark:text-slate-100 outline-none transition"
                />
                <button 
                  onClick={handleEmailSubmit} 
                  disabled={!formData.email || isSubmitting}
                  className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Checking...' : 'Get Started'}
                </button>
              </div>
            </div>
          )}

          {step === 'VERIFY' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="text-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Check your Inbox</h2>
                <p className="text-slate-500 text-sm mt-2">Enter the 4-digit code sent to <br/><strong>{formData.email}</strong></p>
                <p className="text-[10px] text-slate-400 mt-4 font-black uppercase tracking-widest">(Check the browser console for your code!)</p>
              </div>
              <input 
                type="text" 
                placeholder="0000"
                maxLength={4}
                value={formData.code}
                onChange={e => setFormData({...formData, code: e.target.value})}
                className="w-full p-6 text-center text-4xl font-black tracking-[0.5em] bg-slate-100 dark:bg-slate-800 rounded-3xl border-2 border-transparent focus:border-indigo-500 text-slate-900 dark:text-slate-100 outline-none"
              />
              <button 
                onClick={handleVerifySubmit} 
                disabled={formData.code.length < 4 || isSubmitting}
                className="w-full py-5 bg-indigo-600 text-white font-black uppercase rounded-2xl"
              >
                Verify Code
              </button>
            </div>
          )}

          {step === 'PROFILE' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-center text-slate-900 dark:text-slate-100">Create Profile</h2>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none"/>
                <input placeholder="Last Name" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none"/>
              </div>
              <input placeholder="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none"/>
              <button onClick={() => setStep('AVATAR')} disabled={!formData.firstName || !formData.username} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl">Next</button>
            </div>
          )}

          {step === 'AVATAR' && (
            <div className="space-y-6 text-center">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Pick an Avatar</h2>
              <div className="grid grid-cols-4 gap-3">
                {PRESET_AVATARS.map(url => (
                  <button key={url} onClick={() => setFormData({...formData, avatarUrl: url})} className={`aspect-square rounded-2xl border-4 ${formData.avatarUrl === url ? 'border-indigo-600' : 'border-transparent'}`}>
                    <img src={url} className="w-full h-full object-cover rounded-xl" />
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('PREFERENCES')} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl">Continue</button>
            </div>
          )}

          {step === 'PREFERENCES' && (
            <div className="space-y-8">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Last Step</h2>
              <div className="flex flex-wrap gap-2">
                {GENRES.map(g => (
                  <button key={g} onClick={() => setFormData(p => ({...p, favoriteGenres: p.favoriteGenres.includes(g) ? p.favoriteGenres.filter(x => x!==g) : [...p.favoriteGenres, g]}))} className={`px-4 py-2 rounded-full text-xs font-bold transition ${formData.favoriteGenres.includes(g) ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                    {g}
                  </button>
                ))}
              </div>
              <button onClick={handleComplete} disabled={isSubmitting} className="w-full py-5 bg-indigo-600 text-white font-black uppercase rounded-2xl">
                {isSubmitting ? 'Creating Account...' : 'Complete Profile'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
