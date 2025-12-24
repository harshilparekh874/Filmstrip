
import { create } from 'zustand';
import { storage } from '../data/storage/WebStorage';

interface ThemeState {
  isDarkMode: boolean;
  toggleTheme: () => void;
  initTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDarkMode: false,
  toggleTheme: async () => {
    set((state) => {
      const newVal = !state.isDarkMode;
      storage.setItem('app_theme_dark', newVal);
      return { isDarkMode: newVal };
    });
  },
  initTheme: async () => {
    const stored = await storage.getItem<boolean>('app_theme_dark');
    if (stored !== null) {
      set({ isDarkMode: stored });
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      set({ isDarkMode: prefersDark });
    }
  }
}));
