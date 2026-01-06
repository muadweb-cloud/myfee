import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getOfflineCache, setOfflineCache } from "@/lib/offlineQueue";

export interface OfflineSubscription {
  status: "trial" | "active" | "expired";
  trialDaysRemaining: number;
  maxStudents: number;
  planType: string;
  schoolId: string;
  expiryDate: string | null;
  daysUntilExpiry: number;
  showExpiryWarning: boolean;
  cachedAt: number; // timestamp when cached
}

const SUBSCRIPTION_CACHE_KEY = "offline_subscription";

export const useOfflineSubscription = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [subscription, setSubscription] = useState<OfflineSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  // Load subscription from cache
  const loadFromCache = useCallback(async () => {
    try {
      const cached = await getOfflineCache<OfflineSubscription>(SUBSCRIPTION_CACHE_KEY);
      if (cached) {
        // Recalculate days remaining based on current date
        const now = new Date();
        let recalculated = { ...cached };

        if (cached.expiryDate) {
          const expiryDate = new Date(cached.expiryDate);
          const hoursRemaining = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          const daysRemaining = Math.max(0, Math.ceil(hoursRemaining / 24));

          if (cached.status === "trial") {
            recalculated.trialDaysRemaining = daysRemaining;
            if (daysRemaining <= 0) {
              recalculated.status = "expired";
            }
          } else if (cached.status === "active") {
            recalculated.daysUntilExpiry = daysRemaining;
            recalculated.showExpiryWarning = daysRemaining <= 7 && daysRemaining > 0;
            if (daysRemaining <= 0) {
              recalculated.status = "expired";
            }
          }
        }

        setSubscription(recalculated);
        return recalculated;
      }
      return null;
    } catch (error) {
      console.error("Error loading subscription from cache:", error);
      return null;
    }
  }, []);

  // Cache subscription data (called when online and subscription is fetched)
  const cacheSubscription = useCallback(async (data: Omit<OfflineSubscription, "cachedAt">) => {
    const toCache: OfflineSubscription = {
      ...data,
      cachedAt: Date.now(),
    };
    await setOfflineCache(SUBSCRIPTION_CACHE_KEY, toCache);
    setSubscription(toCache);
  }, []);

  // Check if user is within limits
  const checkStudentLimit = useCallback(
    (currentStudentCount: number): { allowed: boolean; message?: string } => {
      if (!subscription) return { allowed: true };
      
      if (subscription.status === "expired") {
        return { 
          allowed: false, 
          message: "Your subscription has expired. Please renew to add more students." 
        };
      }

      if (currentStudentCount >= subscription.maxStudents) {
        return {
          allowed: false,
          message: `You've reached the maximum of ${subscription.maxStudents} students for your ${subscription.planType} plan.`,
        };
      }

      return { allowed: true };
    },
    [subscription]
  );

  // Check if subscription is expired and should redirect
  const checkAndRedirect = useCallback(() => {
    if (!subscription) return;

    const isExpired = subscription.status === "expired";
    const isTrialExpired = subscription.status === "trial" && subscription.trialDaysRemaining <= 0;

    if (isExpired || isTrialExpired) {
      const currentPath = location.pathname;
      const allowedPaths = ["/billing", "/auth", "/install", "/superadmin", "/superadmin-login"];
      
      if (!allowedPaths.some((path) => currentPath.startsWith(path))) {
        navigate("/billing");
      }
    }
  }, [subscription, location.pathname, navigate]);

  // Load on mount
  useEffect(() => {
    const init = async () => {
      await loadFromCache();
      setLoading(false);
    };
    init();
  }, [loadFromCache]);

  // Check redirect when subscription changes
  useEffect(() => {
    if (!loading && subscription) {
      checkAndRedirect();
    }
  }, [loading, subscription, checkAndRedirect]);

  return {
    subscription,
    loading,
    cacheSubscription,
    loadFromCache,
    checkStudentLimit,
  };
};

// Helper to get plan limits
export const getPlanLimits = (planType: string): { maxStudents: number; features: string[] } => {
  const plans: Record<string, { maxStudents: number; features: string[] }> = {
    small: {
      maxStudents: 200,
      features: ["Up to 200 students", "Fee management", "Payment tracking", "Basic reports"],
    },
    medium: {
      maxStudents: 500,
      features: ["Up to 500 students", "Fee management", "Payment tracking", "Advanced reports", "SMS notifications"],
    },
    large: {
      maxStudents: 1000,
      features: ["Up to 1000 students", "Fee management", "Payment tracking", "Advanced reports", "SMS notifications", "Priority support"],
    },
    trial: {
      maxStudents: 50,
      features: ["Up to 50 students (trial)", "Fee management", "Payment tracking", "Basic reports"],
    },
  };

  return plans[planType.toLowerCase()] || plans.trial;
};
