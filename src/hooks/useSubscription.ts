import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

interface SubscriptionStatus {
  status: 'trial' | 'active' | 'expired';
  trialDaysRemaining: number;
  maxStudents: number;
  planType: string;
  schoolId: string;
  nextPaymentDate?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  showExpiryWarning?: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkSubscription = async () => {
      try {
        // Get admin profile to find school_id
        const { data: profile } = await supabase
          .from('admin_profiles')
          .select('school_id')
          .eq('id', user.id)
          .single();

        if (!profile?.school_id) {
          setLoading(false);
          return;
        }

        // Get school subscription status
        const { data: school } = await supabase
          .from('schools')
          .select('*')
          .eq('id', profile.school_id)
          .single();

        if (school) {
          const trialEnd = new Date(school.trial_end);
          const now = new Date();
          // Calculate exact hours difference and convert to days
          const hoursRemaining = (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60);
          const daysRemaining = Math.max(0, Math.floor(hoursRemaining / 24));

          // Calculate days until subscription expiry for active subscriptions
          let daysUntilExpiry = 0;
          let showExpiryWarning = false;
          
          if (school.subscription_status === 'active' && school.next_payment_date) {
            const expiryDate = new Date(school.next_payment_date);
            const expiryHoursRemaining = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            daysUntilExpiry = Math.max(0, Math.ceil(expiryHoursRemaining / 24));
            showExpiryWarning = daysUntilExpiry <= 7 && daysUntilExpiry > 0;
          }

          setSubscription({
            status: school.subscription_status as 'trial' | 'active' | 'expired',
            trialDaysRemaining: daysRemaining,
            maxStudents: school.max_students,
            planType: school.plan_type,
            schoolId: school.id,
            nextPaymentDate: school.next_payment_date,
            expiryDate: school.next_payment_date || school.trial_end,
            daysUntilExpiry,
            showExpiryWarning
          });

          // Check if subscription expired and redirect to billing (only for non-billing pages)
          if (school.subscription_status === 'expired') {
            const currentPath = location.pathname;
            if (currentPath !== '/billing' && currentPath !== '/auth' && !currentPath.startsWith('/superadmin')) {
              navigate('/billing');
            }
          }
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [user, navigate, location.pathname]);

  return { subscription, loading };
};
