
import React, { useState, useEffect } from 'react';
import { storage } from '../../data/storage/WebStorage';
import { User } from '../../core/types/models';

interface LogEntry {
  type: 'MAIL' | 'DB' | 'AUTH' | 'GAME';
  message: string;
  payload?: any;
  timestamp: number;
}

const IS_PROD = !!(import.meta as any).env?.VITE_API_URL;

export const SystemLogOverlay: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [visible, setVisible] = useState(!IS_PROD);

  useEffect(() => {
    const handleLog = (e: any) => {
      setLogs(prev => [e.detail, ...prev].slice(0, 50));
      if (e.detail.type === 'MAIL') setIsOpen(true);
      refreshUsers();
    };

    const refreshUsers = () => {
      const dbRaw = localStorage.getItem('reel_reason_global_cloud_db');
      if (dbRaw) {
        try {
          const db = JSON.parse(dbRaw);
          setRegisteredUsers(db.users || []);
        } catch (err) {}
      }
    };

    const handleDevTrigger = () => {
      let clicks = 0;
      return () => {
        clicks++;
        if (clicks === 5) setVisible(true);
        setTimeout(() => clicks = 0, 2000);
      };
    };

    window.addEventListener('reelreason_system_log', handleLog);
    refreshUsers();
    
    return () => window.removeEventListener('reelreason_system_log', handleLog);
  }, []);

  const handleGhostSwitch = async (user: User) => {
    await storage.setItem('auth_user_data', user);
    const baseUrl = window.location.origin + window.location.pathname;
    window.location.href = baseUrl + '#/dashboard';
    window.location.reload();
  };

  if (!visible) return null;
  if (logs.length === 0 && registeredUsers.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[100] flex flex-col items-end pointer-events-none">
      {isOpen && (
        <div className="w-80 max-h-[32rem] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto animate-in slide-in-from-bottom-4">
          <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Cloud Console</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition">✕</button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {registeredUsers.length > 0 && (
                <div className="p-4 border-b border-slate-800">
                    <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Dev Switcher</h3>
                    <div className="space-y-2">
                        {registeredUsers.map(u => (
                            <button 
                                key={u.id}
                                onClick={() => handleGhostSwitch(u)}
                                className="w-full flex items-center gap-3 p-2 bg-slate-800/40 hover:bg-indigo-600/20 rounded-xl border border-slate-700/50 hover:border-indigo-500/50 transition-all group"
                            >
                                <img src={u.avatarUrl} className="w-6 h-6 rounded-full" alt="" />
                                <div className="text-left flex-1 overflow-hidden">
                                    <p className="text-[10px] font-bold text-slate-200 truncate">{u.name}</p>
                                    <p className="text-[8px] text-slate-500">@{u.username}</p>
                                </div>
                                <span className="text-[8px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 uppercase tracking-tighter">Switch →</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="p-4 space-y-3 font-mono text-[10px]">
                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Live System Logs</h3>
                {logs.map((log, i) => (
                <div key={i} className={`p-2 rounded-lg ${log.type === 'MAIL' ? 'bg-indigo-900/40 border border-indigo-700/50' : 'bg-slate-800/50'}`}>
                    <div className="flex justify-between mb-1 opacity-50">
                    <span>[{log.type}]</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-200">{log.message}</p>
                    {log.payload?.code && (
                    <div className="mt-2 p-2 bg-indigo-500 text-white rounded font-black text-center text-sm tracking-widest">
                        {log.payload.code}
                    </div>
                    )}
                </div>
                ))}
            </div>
          </div>
        </div>
      )}
      
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto mt-4 px-5 py-2.5 bg-slate-900 text-white text-[10px] font-black rounded-full border border-slate-700 hover:border-indigo-500 hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3 group"
        >
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          SYSTEM CONSOLE
        </button>
      )}
    </div>
  );
};
