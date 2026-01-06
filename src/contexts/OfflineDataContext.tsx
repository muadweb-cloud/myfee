// Offline-first data context for school management
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import {
  getOfflineCache,
  setOfflineCache,
  makeCacheKey,
  isOffline,
  enqueueOfflineOp,
  syncOfflineQueue,
  listOfflineOps,
} from "@/lib/offlineQueue";

export interface Student {
  id: string;
  admission_no: string;
  full_name: string;
  class_id: string | null;
  parent_contact: string | null;
  parent_name: string | null;
  total_fee: number;
  class_name?: string;
}

export interface Payment {
  id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
  notes: string | null;
  student_name?: string;
}

export interface FeeStructure {
  id: string;
  class_name: string;
  fee_amount: number;
  description?: string | null;
}

export interface SchoolInfo {
  id: string;
  school_name: string;
  school_email?: string | null;
  school_phone?: string | null;
  school_address?: string | null;
  monthly_target: number;
  yearly_target?: number;
  school_logo_url?: string | null;
}

export interface OfflineSubscriptionData {
  status: "trial" | "active" | "expired";
  trialDaysRemaining: number;
  maxStudents: number;
  planType: string;
  schoolId: string;
  expiryDate: string | null;
  daysUntilExpiry: number;
  showExpiryWarning: boolean;
}

interface OfflineDataContextType {
  students: Student[];
  payments: Payment[];
  feeStructures: FeeStructure[];
  schoolInfo: SchoolInfo | null;
  subscription: OfflineSubscriptionData | null;
  loading: boolean;
  pendingOpsCount: number;
  isOnline: boolean;
  lastSyncedAt: Date | null;

  // Actions
  addStudent: (student: Omit<Student, "id" | "total_fee" | "class_name">) => Promise<{ success: boolean; message?: string }>;
  updateStudent: (id: string, patch: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;

  addPayment: (payment: Omit<Payment, "id" | "receipt_number" | "payment_date" | "student_name">) => Promise<void>;
  updatePayment: (id: string, patch: Partial<Payment>) => Promise<void>;

  addFeeStructure: (fs: Omit<FeeStructure, "id">) => Promise<void>;
  updateFeeStructure: (id: string, patch: Partial<FeeStructure>) => Promise<void>;
  deleteFeeStructure: (id: string) => Promise<void>;

  updateSchoolInfo: (patch: Partial<SchoolInfo>) => Promise<void>;
  refreshData: () => Promise<void>;
  syncNow: () => Promise<{ synced: number; failed: number }>;
}

const OfflineDataContext = createContext<OfflineDataContextType | undefined>(undefined);

export const useOfflineData = () => {
  const ctx = useContext(OfflineDataContext);
  if (!ctx) throw new Error("useOfflineData must be used within OfflineDataProvider");
  return ctx;
};

export const OfflineDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { schoolId } = useSchoolId();

  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [subscription, setSubscription] = useState<OfflineSubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingOpsCount, setPendingOpsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const updatePendingCount = useCallback(async () => {
    const ops = await listOfflineOps();
    setPendingOpsCount(ops.length);
  }, []);

  // Track online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Sync when coming back online - push local changes, then merge with server
  useEffect(() => {
    if (isOnline && schoolId) {
      (async () => {
        const { synced } = await syncOfflineQueue(supabase);
        await updatePendingCount();
        
        // After syncing offline ops, fetch server data and merge with local
        if (synced > 0) {
          try {
            const [studentsRes, paymentsRes, feesRes] = await Promise.all([
              supabase
                .from("students")
                .select("*, fee_structures (class_name)")
                .eq("school_id", schoolId)
                .order("admission_no"),
              supabase
                .from("payments")
                .select("*, students (full_name)")
                .eq("school_id", schoolId)
                .order("payment_date", { ascending: false }),
              supabase.from("fee_structures").select("*").eq("school_id", schoolId).order("class_name"),
            ]);

            const serverStudents: Student[] = (studentsRes.data || []).map((s: any) => ({
              ...s,
              class_name: s.fee_structures?.class_name || "N/A",
            }));
            const serverPayments: Payment[] = (paymentsRes.data || []).map((p: any) => ({
              ...p,
              student_name: p.students?.full_name || "N/A",
            }));
            const serverFees: FeeStructure[] = feesRes.data || [];

            // Update state with server data (which now includes synced local changes)
            setStudents(serverStudents);
            setPayments(serverPayments);
            setFeeStructures(serverFees);

            // Update cache
            await Promise.all([
              setOfflineCache(makeCacheKey(schoolId, "students"), serverStudents),
              setOfflineCache(makeCacheKey(schoolId, "payments"), serverPayments),
              setOfflineCache(makeCacheKey(schoolId, "fee_structures"), serverFees),
              setOfflineCache(`${schoolId}:last_synced`, new Date().toISOString()),
            ]);

            setLastSyncedAt(new Date());
            window.dispatchEvent(new Event("offline-sync"));
          } catch (err) {
            console.error("Error refreshing after auto-sync:", err);
          }
        }
      })();
    }
  }, [isOnline, schoolId, updatePendingCount]);

  // Manual sync trigger - refreshes data after syncing to get server-generated IDs
  const syncNow = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (isOffline()) return { synced: 0, failed: 0 };
    const result = await syncOfflineQueue(supabase);
    await updatePendingCount();
    
    // After syncing, refresh data from server to get real IDs and latest state
    if (result.synced > 0 && schoolId) {
      try {
        const [studentsRes, paymentsRes, feesRes, schoolRes] = await Promise.all([
          supabase
            .from("students")
            .select("*, fee_structures (class_name)")
            .eq("school_id", schoolId)
            .order("admission_no"),
          supabase
            .from("payments")
            .select("*, students (full_name)")
            .eq("school_id", schoolId)
            .order("payment_date", { ascending: false }),
          supabase.from("fee_structures").select("*").eq("school_id", schoolId).order("class_name"),
          supabase.from("schools").select("*").eq("id", schoolId).single(),
        ]);

        const formattedStudents: Student[] = (studentsRes.data || []).map((s: any) => ({
          ...s,
          class_name: s.fee_structures?.class_name || "N/A",
        }));
        const formattedPayments: Payment[] = (paymentsRes.data || []).map((p: any) => ({
          ...p,
          student_name: p.students?.full_name || "N/A",
        }));
        const formattedFees: FeeStructure[] = feesRes.data || [];

        setStudents(formattedStudents);
        setPayments(formattedPayments);
        setFeeStructures(formattedFees);

        // Update cache with real server data
        await Promise.all([
          setOfflineCache(makeCacheKey(schoolId, "students"), formattedStudents),
          setOfflineCache(makeCacheKey(schoolId, "payments"), formattedPayments),
          setOfflineCache(makeCacheKey(schoolId, "fee_structures"), formattedFees),
          setOfflineCache(`${schoolId}:last_synced`, new Date().toISOString()),
        ]);
      } catch (err) {
        console.error("Error refreshing after sync:", err);
      }
      
      setLastSyncedAt(new Date());
      window.dispatchEvent(new Event("offline-sync"));
    }
    
    return result;
  }, [updatePendingCount, schoolId]);

  const refreshData = useCallback(async () => {
    if (!schoolId) return;

    setLoading(true);

    if (isOffline()) {
      // Load from cache
      const [cachedStudents, cachedPayments, cachedFees, cachedSchool, cachedSub, cachedLastSync] = await Promise.all([
        getOfflineCache<Student[]>(makeCacheKey(schoolId, "students")),
        getOfflineCache<Payment[]>(makeCacheKey(schoolId, "payments")),
        getOfflineCache<FeeStructure[]>(makeCacheKey(schoolId, "fee_structures")),
        getOfflineCache<SchoolInfo>(`${schoolId}:school_info`),
        getOfflineCache<OfflineSubscriptionData>(`${schoolId}:subscription`),
        getOfflineCache<string>(`${schoolId}:last_synced`),
      ]);
      setStudents(cachedStudents || []);
      setPayments(cachedPayments || []);
      setFeeStructures(cachedFees || []);
      setSchoolInfo(cachedSchool || null);
      
      // Recalculate subscription status based on current date
      if (cachedSub) {
        const now = new Date();
        let updatedSub = { ...cachedSub };
        
        if (cachedSub.expiryDate) {
          const expiryDate = new Date(cachedSub.expiryDate);
          const hoursRemaining = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          const daysRemaining = Math.max(0, Math.ceil(hoursRemaining / 24));

          if (cachedSub.status === "trial") {
            updatedSub.trialDaysRemaining = daysRemaining;
            if (daysRemaining <= 0) {
              updatedSub.status = "expired";
            }
          } else if (cachedSub.status === "active") {
            updatedSub.daysUntilExpiry = daysRemaining;
            updatedSub.showExpiryWarning = daysRemaining <= 7 && daysRemaining > 0;
            if (daysRemaining <= 0) {
              updatedSub.status = "expired";
            }
          }
        }
        setSubscription(updatedSub);
      }
      
      if (cachedLastSync) {
        setLastSyncedAt(new Date(cachedLastSync));
      }
      
      setLoading(false);
      await updatePendingCount();
      return;
    }

    try {
      // Fetch from server
      const [studentsRes, paymentsRes, feesRes, schoolRes] = await Promise.all([
        supabase
          .from("students")
          .select("*, fee_structures (class_name)")
          .eq("school_id", schoolId)
          .order("admission_no"),
        supabase
          .from("payments")
          .select("*, students (full_name)")
          .eq("school_id", schoolId)
          .order("payment_date", { ascending: false }),
        supabase.from("fee_structures").select("*").eq("school_id", schoolId).order("class_name"),
        supabase.from("schools").select("*").eq("id", schoolId).single(),
      ]);

      const formattedStudents: Student[] = (studentsRes.data || []).map((s: any) => ({
        ...s,
        class_name: s.fee_structures?.class_name || "N/A",
      }));
      const formattedPayments: Payment[] = (paymentsRes.data || []).map((p: any) => ({
        ...p,
        student_name: p.students?.full_name || "N/A",
      }));
      const formattedFees: FeeStructure[] = feesRes.data || [];
      
      const school = schoolRes.data;
      const formattedSchool: SchoolInfo | null = school
        ? { 
            id: school.id, 
            school_name: school.school_name, 
            school_email: school.school_email,
            school_phone: school.school_phone,
            school_address: school.school_address,
            monthly_target: school.monthly_target || 0,
            school_logo_url: school.school_logo_url,
          }
        : null;

      // Calculate subscription data
      if (school) {
        const now = new Date();
        const trialEnd = school.trial_end ? new Date(school.trial_end) : now;
        const hoursRemaining = (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60);
        const trialDaysRemaining = Math.max(0, Math.floor(hoursRemaining / 24));

        let daysUntilExpiry = 0;
        let showExpiryWarning = false;
        const expiryDate = school.next_payment_date || school.trial_end;

        if (school.subscription_status === 'active' && school.next_payment_date) {
          const expiry = new Date(school.next_payment_date);
          const expiryHoursRemaining = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
          daysUntilExpiry = Math.max(0, Math.ceil(expiryHoursRemaining / 24));
          showExpiryWarning = daysUntilExpiry <= 7 && daysUntilExpiry > 0;
        }

        const subData: OfflineSubscriptionData = {
          status: school.subscription_status as "trial" | "active" | "expired" || "trial",
          trialDaysRemaining,
          maxStudents: school.max_students || 50,
          planType: school.plan_type || "trial",
          schoolId: school.id,
          expiryDate,
          daysUntilExpiry,
          showExpiryWarning,
        };

        setSubscription(subData);
        await setOfflineCache(`${schoolId}:subscription`, subData);
      }

      setStudents(formattedStudents);
      setPayments(formattedPayments);
      setFeeStructures(formattedFees);
      setSchoolInfo(formattedSchool);
      setLastSyncedAt(new Date());

      // Cache for offline
      await Promise.all([
        setOfflineCache(makeCacheKey(schoolId, "students"), formattedStudents),
        setOfflineCache(makeCacheKey(schoolId, "payments"), formattedPayments),
        setOfflineCache(makeCacheKey(schoolId, "fee_structures"), formattedFees),
        setOfflineCache(`${schoolId}:school_info`, formattedSchool),
        setOfflineCache(`${schoolId}:last_synced`, new Date().toISOString()),
      ]);
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      setLoading(false);
      await updatePendingCount();
    }
  }, [schoolId, updatePendingCount]);

  // Initial load
  useEffect(() => {
    if (schoolId) {
      refreshData();
    }
  }, [schoolId, refreshData]);

  // ==================== STUDENT ACTIONS ====================
  const addStudent = useCallback(
    async (input: Omit<Student, "id" | "total_fee" | "class_name">): Promise<{ success: boolean; message?: string }> => {
      if (!schoolId) return { success: false, message: "No school ID" };

      // Check subscription limits
      if (subscription) {
        if (subscription.status === "expired") {
          return { success: false, message: "Your subscription has expired. Please renew to add more students." };
        }
        if (students.length >= subscription.maxStudents) {
          return { 
            success: false, 
            message: `You've reached the maximum of ${subscription.maxStudents} students for your ${subscription.planType} plan.` 
          };
        }
      }

      const tempId = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const className = feeStructures.find((f) => f.id === input.class_id)?.class_name || "N/A";

      const localStudent: Student = {
        ...input,
        id: tempId,
        total_fee: 0,
        class_name: className,
      };

      const next = [...students, localStudent].sort((a, b) => a.admission_no.localeCompare(b.admission_no));
      setStudents(next);
      await setOfflineCache(makeCacheKey(schoolId, "students"), next);

      if (isOffline()) {
        await enqueueOfflineOp({
          table: "students",
          type: "insert",
          payload: { ...input, school_id: schoolId },
          tempId,
        });
        await updatePendingCount();
        return { success: true };
      }

      try {
        const { data, error } = await supabase.from("students").insert([{ ...input, school_id: schoolId }]).select().single();

        if (error) throw error;

        // Replace temp with real
        const realStudent: Student = { ...data, class_name: className };
        const updated = next.map((s) => (s.id === tempId ? realStudent : s));
        setStudents(updated);
        await setOfflineCache(makeCacheKey(schoolId, "students"), updated);
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message || "Failed to add student" };
      }
    },
    [schoolId, students, feeStructures, subscription, updatePendingCount]
  );

  const updateStudent = useCallback(
    async (id: string, patch: Partial<Student>) => {
      if (!schoolId) return;

      const next = students.map((s) => (s.id === id ? { ...s, ...patch } : s));
      setStudents(next);
      await setOfflineCache(makeCacheKey(schoolId, "students"), next);

      if (isOffline()) {
        await enqueueOfflineOp({ table: "students", type: "update", rowId: id, patch });
        await updatePendingCount();
        return;
      }

      const { error } = await supabase.from("students").update(patch).eq("id", id);
      if (error) throw error;
    },
    [schoolId, students, updatePendingCount]
  );

  const deleteStudent = useCallback(
    async (id: string) => {
      if (!schoolId) return;

      const next = students.filter((s) => s.id !== id);
      setStudents(next);
      await setOfflineCache(makeCacheKey(schoolId, "students"), next);

      if (isOffline()) {
        await enqueueOfflineOp({ table: "students", type: "delete", rowId: id });
        await updatePendingCount();
        return;
      }

      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    [schoolId, students, updatePendingCount]
  );

  // ==================== PAYMENT ACTIONS ====================
  const addPayment = useCallback(
    async (input: Omit<Payment, "id" | "receipt_number" | "payment_date" | "student_name">) => {
      if (!schoolId) return;

      const tempId = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const nowIso = new Date().toISOString();
      const receiptNumber = `OFF-${nowIso.replace(/[-:.TZ]/g, "").slice(0, 14)}`;
      const studentName = students.find((s) => s.id === input.student_id)?.full_name || "N/A";

      const localPayment: Payment = {
        ...input,
        id: tempId,
        payment_date: nowIso,
        receipt_number: receiptNumber,
        student_name: studentName,
      };

      const next = [localPayment, ...payments];
      setPayments(next);
      await setOfflineCache(makeCacheKey(schoolId, "payments"), next);

      if (isOffline()) {
        await enqueueOfflineOp({
          table: "payments",
          type: "insert",
          payload: { ...input, school_id: schoolId, payment_date: nowIso, receipt_number: receiptNumber },
          tempId,
        });
        await updatePendingCount();
        return;
      }

      const { data, error } = await supabase
        .from("payments")
        .insert([{ ...input, school_id: schoolId }])
        .select()
        .single();

      if (error) throw error;

      const realPayment: Payment = { ...data, student_name: studentName };
      const updated = next.map((p) => (p.id === tempId ? realPayment : p));
      setPayments(updated);
      await setOfflineCache(makeCacheKey(schoolId, "payments"), updated);
    },
    [schoolId, payments, students, updatePendingCount]
  );

  const updatePayment = useCallback(
    async (id: string, patch: Partial<Payment>) => {
      if (!schoolId) return;

      const next = payments.map((p) => (p.id === id ? { ...p, ...patch } : p));
      setPayments(next);
      await setOfflineCache(makeCacheKey(schoolId, "payments"), next);

      if (isOffline()) {
        await enqueueOfflineOp({ table: "payments", type: "update", rowId: id, patch });
        await updatePendingCount();
        return;
      }

      const { error } = await supabase.from("payments").update(patch).eq("id", id);
      if (error) throw error;
    },
    [schoolId, payments, updatePendingCount]
  );

  // ==================== FEE STRUCTURE ACTIONS ====================
  const addFeeStructure = useCallback(
    async (input: Omit<FeeStructure, "id">) => {
      if (!schoolId) return;

      const tempId = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const local: FeeStructure = { ...input, id: tempId };
      const next = [...feeStructures, local].sort((a, b) => a.class_name.localeCompare(b.class_name));
      setFeeStructures(next);
      await setOfflineCache(makeCacheKey(schoolId, "fee_structures"), next);

      if (isOffline()) {
        await enqueueOfflineOp({
          table: "fee_structures",
          type: "insert",
          payload: { ...input, school_id: schoolId },
          tempId,
        });
        await updatePendingCount();
        return;
      }

      const { data, error } = await supabase
        .from("fee_structures")
        .insert([{ ...input, school_id: schoolId }])
        .select()
        .single();

      if (error) throw error;

      const updated = next.map((f) => (f.id === tempId ? data : f));
      setFeeStructures(updated);
      await setOfflineCache(makeCacheKey(schoolId, "fee_structures"), updated);
    },
    [schoolId, feeStructures, updatePendingCount]
  );

  const updateFeeStructure = useCallback(
    async (id: string, patch: Partial<FeeStructure>) => {
      if (!schoolId) return;

      const next = feeStructures.map((f) => (f.id === id ? { ...f, ...patch } : f));
      setFeeStructures(next);
      await setOfflineCache(makeCacheKey(schoolId, "fee_structures"), next);

      if (isOffline()) {
        await enqueueOfflineOp({ table: "fee_structures", type: "update", rowId: id, patch });
        await updatePendingCount();
        return;
      }

      const { error } = await supabase.from("fee_structures").update(patch).eq("id", id);
      if (error) throw error;
    },
    [schoolId, feeStructures, updatePendingCount]
  );

  const deleteFeeStructure = useCallback(
    async (id: string) => {
      if (!schoolId) return;

      const next = feeStructures.filter((f) => f.id !== id);
      setFeeStructures(next);
      await setOfflineCache(makeCacheKey(schoolId, "fee_structures"), next);

      if (isOffline()) {
        await enqueueOfflineOp({ table: "fee_structures", type: "delete", rowId: id });
        await updatePendingCount();
        return;
      }

      const { error } = await supabase.from("fee_structures").delete().eq("id", id);
      if (error) throw error;
    },
    [schoolId, feeStructures, updatePendingCount]
  );

  // ==================== SCHOOL INFO ACTIONS ====================
  const updateSchoolInfo = useCallback(
    async (patch: Partial<SchoolInfo>) => {
      if (!schoolId || !schoolInfo) return;

      const updated = { ...schoolInfo, ...patch };
      setSchoolInfo(updated);
      await setOfflineCache(`${schoolId}:school_info`, updated);

      if (isOffline()) {
        // For school info, we don't queue offline ops since it's school-level settings
        // Just keep it in local cache
        return;
      }

      const { error } = await supabase.from("schools").update(patch).eq("id", schoolId);
      if (error) throw error;
    },
    [schoolId, schoolInfo]
  );

  return (
    <OfflineDataContext.Provider
      value={{
        students,
        payments,
        feeStructures,
        schoolInfo,
        subscription,
        loading,
        pendingOpsCount,
        isOnline,
        lastSyncedAt,
        addStudent,
        updateStudent,
        deleteStudent,
        addPayment,
        updatePayment,
        addFeeStructure,
        updateFeeStructure,
        deleteFeeStructure,
        updateSchoolInfo,
        refreshData,
        syncNow,
      }}
    >
      {children}
    </OfflineDataContext.Provider>
  );
};
