import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, schoolName: string, schoolAddress?: string, schoolPhone?: string) => Promise<{ error: any }>;
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
    // Onboarding is no longer required - always return false
    return false;
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
            // Check current path - don't interfere with super admin login flow
            const currentPath = window.location.pathname;
            if (currentPath.startsWith('/superadmin')) {
              return; // Don't redirect on super admin pages
            }

            // If we're in password recovery mode, don't auto-redirect away
            const searchParams = new URLSearchParams(window.location.search);
            const isPasswordRecovery = searchParams.get('type') === 'recovery';
            if (isPasswordRecovery) {
              return;
            }
            
            // Check if user is super_admin - don't redirect them
            const { data: roleData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id)
              .eq("role", "super_admin")
              .maybeSingle();
            
            if (roleData?.role === 'super_admin') {
              // Super admins handle their own navigation
              return;
            }
            
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

  const signUp = async (email: string, password: string, schoolName: string, schoolAddress?: string, schoolPhone?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          school_name: schoolName,
          school_address: schoolAddress || null,
          school_phone: schoolPhone || null
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signUp, signOut, loading, needsOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
};