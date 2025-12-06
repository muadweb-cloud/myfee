import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
  needsOnboarding: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const navigate = useNavigate();

  const checkOnboardingStatus = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from("admin_profiles")
        .select("school_id")
        .eq("id", userId)
        .single();

      if (profile?.school_id) {
        const { data: school } = await supabase
          .from("schools")
          .select("school_name")
          .eq("id", profile.school_id)
          .single();

        // Check if school_name is the default "My School" (needs onboarding)
        return school?.school_name === "My School";
      }
      return true; // No school_id means needs onboarding
    } catch {
      return false;
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(async () => {
            const needsOnboard = await checkOnboardingStatus(session.user.id);
            setNeedsOnboarding(needsOnboard);
            if (needsOnboard) {
              navigate('/onboarding');
            } else {
              navigate('/dashboard');
            }
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setNeedsOnboarding(false);
          navigate('/auth');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const needsOnboard = await checkOnboardingStatus(session.user.id);
        setNeedsOnboarding(needsOnboard);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signUp, signInWithGoogle, signOut, loading, needsOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
};
