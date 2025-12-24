
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../state/authStore';

export const Layout: React.FC = () => {
  const { user } = useAuthStore();
  const location = useLocation();

  const navItems = [
    { label: 'Home', path: '/dashboard', icon: '🏠' },
    { label: 'Watched', path: '/lists/WATCHED', icon: '✅' },
    { label: 'Watch Later', path: '/lists/WATCH_LATER', icon: '🕒' },
    { label: 'Dropped', path: '/lists/DROPPED', icon: '✖️' },
    { label: 'Social', path: '/social', icon: '👥' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0f1115] transition-colors duration-300">
      {/* Top Header */}
      <header className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-30 px-6 py-4 flex justify-between items-center transition-colors">
        <Link to="/" className="text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">Filmstrip</Link>
        <Link 
          to="/profile" 
          className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 p-1 pr-3 rounded-full transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
        >
          <img src={user?.avatarUrl} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700" alt="Me" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 hidden sm:inline">@{user?.username}</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-24 px-4 pt-6 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom Navigation Footer */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1 flex justify-around items-center z-40 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.03)] dark:shadow-none transition-colors">
        {navItems.map(item => {
          const isActive = location.pathname.startsWith(item.path) || (item.path === '/dashboard' && location.pathname === '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 flex-1 ${
                isActive 
                ? 'text-indigo-600 dark:text-indigo-400' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className={`text-[10px] font-black uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
