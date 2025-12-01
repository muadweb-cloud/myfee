import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useSchoolId = () => {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchSchoolId = async () => {
      try {
        const { data: profile } = await supabase
          .from('admin_profiles')
          .select('school_id')
          .eq('id', user.id)
          .single();

        if (profile?.school_id) {
          setSchoolId(profile.school_id);
        }
      } catch (error) {
        console.error('Error fetching school ID:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolId();
  }, [user]);

  return { schoolId, loading };
};
