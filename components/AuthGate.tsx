'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const AUTH_STORAGE_KEY = 'dc_auth_session';
const AUTH_TTL_MS = 60 * 60 * 1000;

type AuthSession = {
  token: string;
  username: string;
  expiresAt: number;
};

type AuthContextValue = {
  session: AuthSession | null;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const createToken = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const loadSession = (): AuthSession | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.expiresAt || Date.now() >= parsed.expiresAt) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

const saveSession = (session: AuthSession) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

const clearSession = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthGate');
  }
  return context;
};

export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const configuredUsername = process.env.NEXT_PUBLIC_LOGIN_USERNAME || 'admin';
  const configuredPassword = process.env.NEXT_PUBLIC_LOGIN_PASSWORD || 'admin';

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  useEffect(() => {
    const stored = loadSession();
    if (stored) {
      setSession(stored);
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      logout();
      return undefined;
    }
    const timer = window.setTimeout(() => {
      logout();
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (username !== configuredUsername || password !== configuredPassword) {
      setError('Invalid credentials. Please try again.');
      return;
    }

    const newSession: AuthSession = {
      token: createToken(),
      username,
      expiresAt: Date.now() + AUTH_TTL_MS,
    };
    saveSession(newSession);
    setSession(newSession);
    setPassword('');
  };

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      session,
      logout,
    }),
    [session, logout]
  );

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground/60 text-sm">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-input p-6 shadow-2xl">
          <div className="h-1 w-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent mb-6" />
          <h1 className="text-2xl font-bold text-foreground">Device Controller</h1>
          <p className="text-sm text-foreground/60 mt-1">
            Sign in to access device controls
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Username</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter username"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter password"
                required
              />
            </label>

            {error && (
              <div className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full">
              Sign In
            </button>
          </form>

          <p className="mt-4 text-xs text-foreground/50">
            Sessions expire after 1 hour of login.
          </p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
