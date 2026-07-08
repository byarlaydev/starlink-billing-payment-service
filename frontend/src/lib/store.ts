import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (data: { user: User; accessToken: string; refreshToken?: string }) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null,
  accessToken: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,
  refreshToken: typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false,
  setAuth: (data) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken || null, isAuthenticated: true });
  },
  setAccessToken: (token) => {
    localStorage.setItem('accessToken', token);
    set({ accessToken: token });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },
}));

interface UiState {
  sidebarCollapsed: boolean;
  darkMode: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleDarkMode: () => void;
  setDarkMode: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: typeof window !== 'undefined' ? localStorage.getItem('sidebarCollapsed') === 'true' : false,
  darkMode: typeof window !== 'undefined' ? localStorage.getItem('darkMode') === 'true' : false,
  toggleSidebar: () => set((s) => {
    const v = !s.sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', String(v));
    return { sidebarCollapsed: v };
  }),
  setSidebarCollapsed: (v) => {
    localStorage.setItem('sidebarCollapsed', String(v));
    set({ sidebarCollapsed: v });
  },
  toggleDarkMode: () => set((s) => {
    const v = !s.darkMode;
    localStorage.setItem('darkMode', String(v));
    if (v) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    return { darkMode: v };
  }),
  setDarkMode: (v) => {
    localStorage.setItem('darkMode', String(v));
    if (v) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    set({ darkMode: v });
  },
}));

// Initialize dark mode on load
if (typeof window !== 'undefined' && localStorage.getItem('darkMode') === 'true') {
  document.documentElement.classList.add('dark');
}
