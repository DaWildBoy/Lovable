import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  mfaRequired: boolean;
  mfaVerified: () => void;
  signUp: (email: string, password: string, role: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);

  const fetchProfile = async (userId: string) => {
    console.log('Fetching profile for user:', userId);
    setProfileError(null);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    console.log('Profile fetch result:', { data, error });

    if (error) {
      console.error('Error fetching profile:', error);
      setProfileError(error.message);
      return;
    }

    if (data) {
      setProfile(data);
      console.log('Profile updated in state:', data);
    } else {
      console.warn('No profile found for user:', userId);
      setProfileError('Profile not found');
    }
  };

  const refreshProfile = async () => {
    console.log('Refreshing profile, current user:', user?.id);
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialLoadDone = false;

    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.error('Loading timeout reached, forcing load complete');
        setLoading(false);
      }
    }, 10000);

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          if (mounted) setLoading(false);
          return;
        }

        if (mounted) {
          setUser(session?.user ?? null);

          if (session?.user) {
            await fetchProfile(session.user.id);
          }

          initialLoadDone = true;
          setLoading(false);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (!mounted) return;

        if (_event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (_event === 'SIGNED_IN') {
          if (!initialLoadDone) {
            return;
          }
          setLoading(true);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
          }
          setLoading(false);
          return;
        }

        if (_event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
          return;
        }

        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      })();
    });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, role: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    });

    if (error) throw error;
  };

  const checkMfaFactors = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return false;
      return data.totp.some((f) => f.status === 'verified');
    } catch {
      return false;
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    const hasMfa = await checkMfaFactors();
    if (hasMfa) {
      setMfaRequired(true);
    }
  };

  const mfaVerified = () => {
    setMfaRequired(false);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileError,
        mfaRequired,
        mfaVerified,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
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
