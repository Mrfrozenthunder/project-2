import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // If no session, ensure we're completely logged out
          await supabase.auth.clearSession();
          localStorage.clear();
          sessionStorage.clear();
        }
        
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (error) {
        console.error('Session check error:', error);
        setUser(null);
        setLoading(false);
      }
    };

    checkSession();

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        // Clear everything when session ends
        localStorage.clear();
        sessionStorage.clear();
        await supabase.auth.clearSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      // First clear all local storage and session storage
      localStorage.clear();
      sessionStorage.clear();

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut({
        scope: 'local' // This ensures we clear local session data
      });
      if (error) throw error;

      // Clear the user state
      setUser(null);

      // Clear any Supabase storage
      await supabase.auth.clearSession();

      // Force navigation to login page
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      // As a fallback, force reload
      window.location.reload();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}