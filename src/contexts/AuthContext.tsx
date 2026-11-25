import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, requireSupabase, supabase } from '../lib/supabase';
import { clearCoverBlobCache } from '../utils/coverBlobCache';

interface AuthState {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') clearCoverBlobCache();
      if (active) setUser(session?.user ?? null);
    });
    void supabase.auth.getUser().then(({ data, error }) => {
      if (active) { setUser(error ? null : data.user); setLoading(false); }
    }).catch(() => { if (active) { setUser(null); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
    clearCoverBlobCache();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa de AuthProvider.');
  return context;
}
