
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../state/authStore';
import { tmdbApi } from '../../data/api/tmdbApi';
import { Movie, User } from '../../core/types/models';

type Step = 'ACCOUNTS' | 'EMAIL' | 'VERIFY' | 'PROFILE' | 'AVATAR' | 'PREFERENCES';

const PRESET_AVATARS = [
  'Felix', 'Aneka', 'Casper', 'Willow', 'Jasper', 'Milo', 'Luna', 'Cleo'
].map(seed => `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`);

const GENRES = [
  'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Romance', 'Documentary', 'Animation', 'Fantasy'
];

const IS_PROD = !!(import.meta as any).env?.VITE_SUPABASE_URL;

export const Login: React.FC = () => {
  const { signup, login, sendOtp, verifyOtp, rememberedUsers, forgetAccount } = useAuthStore();
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

  // Check for remembered accounts on mount
  useEffect(() => {
    if (rememberedUsers.length > 0) {
      setStep('ACCOUNTS');
    }
  }, [rememberedUsers]);

  useEffect(() => {
    if (movieSearch.length > 2) {
      tmdbApi.searchMovies(movieSearch).then(res => setMovieResults(res.slice(0, 5)));
    }
  }, [movieSearch]);

  const handleQuickLogin = async (userId: string) => {
    setError('');
    setIsSubmitting(true);
    const success = await login(userId);
    if (success) {
      navigate('/dashboard');
    } else {
      setError("Session expired. Please log in with your email.");
      setStep('EMAIL');
    }
    setIsSubmitting(false);
  };

  const handleEmailSubmit = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await sendOtp(formData.email);
      setStep('VERIFY');
    } catch (err: any) {
      setError(err.message || 'Could not send email.');
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
        const success = await login(res.userId!);
        if (success) {
            navigate('/dashboard');
        } else {
            setStep('PROFILE');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Invalid code.');
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
      setError('Signup failed. Username might be taken.');
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
            style={{ width: `${(['ACCOUNTS', 'EMAIL', 'VERIFY', 'PROFILE', 'AVATAR', 'PREFERENCES'].indexOf(step) + 1) * 16.6}%` }}
          />
        </div>

        <div className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl animate-bounce">
              ⚠️ {error}
            </div>
          )}

          {step === 'ACCOUNTS' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center">
                <h1 className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter mb-2">Welcome Back</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Select an account to log in instantly.</p>
              </div>
              
              <div className="space-y-3">
                {rememberedUsers.map(u => (
                  <div key={u.id} className="relative group">
                    <button 
                      onClick={() => handleQuickLogin(u.id)}
                      disabled={isSubmitting}
                      className="w-full p-4 flex items-center gap-4 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-2 border-transparent hover:border-indigo-500 rounded-3xl transition-all"
                    >
                      <img src={u.avatarUrl} className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow-sm object-cover" alt="" />
                      <div className="text-left flex-1 overflow-hidden">
                        <p className="font-black text-slate-900 dark:text-slate-100 truncate">{u.name}</p>
                        <p className="text-xs text-slate-500 font-medium">@{u.username}</p>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Login →</span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); forgetAccount(u.id); }}
                      className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-400 transition"
                      title="Forget this account"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 space-y-3">
                <button 
                  onClick={() => setStep('EMAIL')}
                  className="w-full py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 transition"
                >
                  Use another account
                </button>
              </div>
            </div>
          )}

          {step === 'EMAIL' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center">
                <h1 className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter mb-2">Filmstrip</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Log in with your email to sync your cinema journey.</p>
              </div>
              <div className="space-y-4">
                <input 
                  type="email" 
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-transparent focus:border-indigo-500 text-slate-900 dark:text-slate-100 outline-none transition"
                />
                <button 
                  onClick={handleEmailSubmit} 
                  disabled={!formData.email || isSubmitting}
                  className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Connecting...' : 'Send Verification Code'}
                </button>
                {rememberedUsers.length > 0 && (
                   <button 
                    onClick={() => setStep('ACCOUNTS')}
                    className="w-full py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 transition"
                  >
                    ← Back to known accounts
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'VERIFY' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="text-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Check your Email</h2>
                <p className="text-slate-500 text-sm mt-2">
                  Enter the verification code sent to<br/>
                  <strong className="text-indigo-600">{formData.email}</strong>
                </p>
              </div>
              <input 
                type="text" 
                placeholder="••••"
                maxLength={10}
                value={formData.code}
                onChange={e => setFormData({...formData, code: e.target.value})}
                className="w-full p-6 text-center text-3xl font-black tracking-[0.2em] bg-slate-100 dark:bg-slate-800 rounded-3xl border-2 border-transparent focus:border-indigo-500 text-slate-900 dark:text-slate-100 outline-none"
              />
              <button 
                onClick={handleVerifySubmit} 
                disabled={formData.code.length < 4 || isSubmitting}
                className="w-full py-5 bg-indigo-600 text-white font-black uppercase rounded-2xl shadow-xl transition-transform active:scale-95"
              >
                {isSubmitting ? 'Verifying...' : 'Verify & Continue'}
              </button>
              <button 
                onClick={() => setStep('EMAIL')}
                className="w-full text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-indigo-500 transition"
              >
                ← Use a different email
              </button>
            </div>
          )}

          {step === 'PROFILE' && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <h2 className="text-2xl font-black text-center text-slate-900 dark:text-slate-100">Almost There!</h2>
              <p className="text-center text-slate-500 text-sm -mt-4">Tell us who you are.</p>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none border border-transparent focus:border-indigo-500 text-slate-900 dark:text-slate-100"/>
                <input placeholder="Last Name" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none border border-transparent focus:border-indigo-500 text-slate-900 dark:text-slate-100"/>
              </div>
              <input placeholder="Username (unique)" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none border border-transparent focus:border-indigo-500 text-slate-900 dark:text-slate-100"/>
              <button onClick={() => setStep('AVATAR')} disabled={!formData.firstName || !formData.username} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl transition shadow-lg">Next Step</button>
            </div>
          )}

          {step === 'AVATAR' && (
            <div className="space-y-6 text-center animate-in slide-in-from-right-4">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Pick an Avatar</h2>
              <div className="grid grid-cols-4 gap-3">
                {PRESET_AVATARS.map(url => (
                  <button key={url} onClick={() => setFormData({...formData, avatarUrl: url})} className={`aspect-square rounded-2xl border-4 transition-all ${formData.avatarUrl === url ? 'border-indigo-600 scale-110 shadow-lg z-10' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                    <img src={url} className="w-full h-full object-cover rounded-xl" />
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('PREFERENCES')} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-lg mt-4">One Last Thing</button>
            </div>
          )}

          {step === 'PREFERENCES' && (
            <div className="space-y-8 animate-in slide-in-from-right-4">
              <div className="text-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Your Taste</h2>
                <p className="text-slate-500 text-sm">Select genres you love.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {GENRES.map(g => (
                  <button key={g} onClick={() => setFormData(p => ({...p, favoriteGenres: p.favoriteGenres.includes(g) ? p.favoriteGenres.filter(x => x!==g) : [...p.favoriteGenres, g]}))} className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${formData.favoriteGenres.includes(g) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent hover:border-slate-300'}`}>
                    {g}
                  </button>
                ))}
              </div>
              <button onClick={handleComplete} disabled={isSubmitting} className="w-full py-5 bg-indigo-600 text-white font-black uppercase rounded-2xl shadow-xl">
                {isSubmitting ? 'Launching...' : 'Create My Account'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
