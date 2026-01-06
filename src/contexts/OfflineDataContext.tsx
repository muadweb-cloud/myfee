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
  OfflineOpInput,
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
  monthly_target: number;
}

interface OfflineDataContextType {
  students: Student[];
  payments: Payment[];
  feeStructures: FeeStructure[];
  schoolInfo: SchoolInfo | null;
  loading: boolean;
  pendingOpsCount: number;
  isOnline: boolean;

  // Actions
  addStudent: (student: Omit<Student, "id" | "total_fee" | "class_name">) => Promise<void>;
  updateStudent: (id: string, patch: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;

  addPayment: (payment: Omit<Payment, "id" | "receipt_number" | "payment_date" | "student_name">) => Promise<void>;
  updatePayment: (id: string, patch: Partial<Payment>) => Promise<void>;

  addFeeStructure: (fs: Omit<FeeStructure, "id">) => Promise<void>;
  updateFeeStructure: (id: string, patch: Partial<FeeStructure>) => Promise<void>;
  deleteFeeStructure: (id: string) => Promise<void>;

  refreshData: () => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [pendingOpsCount, setPendingOpsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

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

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && schoolId) {
      syncOfflineQueue(supabase).then(({ synced }) => {
        if (synced > 0) {
          refreshData();
          window.dispatchEvent(new Event("offline-sync"));
        }
        updatePendingCount();
      });
    }
  }, [isOnline, schoolId]);

  const updatePendingCount = useCallback(async () => {
    const ops = await listOfflineOps();
    setPendingOpsCount(ops.length);
  }, []);

  const refreshData = useCallback(async () => {
    if (!schoolId) return;

    setLoading(true);

    if (isOffline()) {
      // Load from cache
      const [cachedStudents, cachedPayments, cachedFees, cachedSchool] = await Promise.all([
        getOfflineCache<Student[]>(makeCacheKey(schoolId, "students")),
        getOfflineCache<Payment[]>(makeCacheKey(schoolId, "payments")),
        getOfflineCache<FeeStructure[]>(makeCacheKey(schoolId, "fee_structures")),
        getOfflineCache<SchoolInfo>(`${schoolId}:school_info`),
      ]);
      setStudents(cachedStudents || []);
      setPayments(cachedPayments || []);
      setFeeStructures(cachedFees || []);
      setSchoolInfo(cachedSchool || null);
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
        supabase.from("schools").select("id, school_name, monthly_target").eq("id", schoolId).single(),
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
      const formattedSchool: SchoolInfo | null = schoolRes.data
        ? { id: schoolRes.data.id, school_name: schoolRes.data.school_name, monthly_target: schoolRes.data.monthly_target || 0 }
        : null;

      setStudents(formattedStudents);
      setPayments(formattedPayments);
      setFeeStructures(formattedFees);
      setSchoolInfo(formattedSchool);

      // Cache for offline
      await Promise.all([
        setOfflineCache(makeCacheKey(schoolId, "students"), formattedStudents),
        setOfflineCache(makeCacheKey(schoolId, "payments"), formattedPayments),
        setOfflineCache(makeCacheKey(schoolId, "fee_structures"), formattedFees),
        setOfflineCache(`${schoolId}:school_info`, formattedSchool),
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
    async (input: Omit<Student, "id" | "total_fee" | "class_name">) => {
      if (!schoolId) return;

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
        return;
      }

      const { data, error } = await supabase.from("students").insert([{ ...input, school_id: schoolId }]).select().single();

      if (error) throw error;

      // Replace temp with real
      const realStudent: Student = { ...data, class_name: className };
      const updated = next.map((s) => (s.id === tempId ? realStudent : s));
      setStudents(updated);
      await setOfflineCache(makeCacheKey(schoolId, "students"), updated);
    },
    [schoolId, students, feeStructures, updatePendingCount]
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

  return (
    <OfflineDataContext.Provider
      value={{
        students,
        payments,
        feeStructures,
        schoolInfo,
        loading,
        pendingOpsCount,
        isOnline,
        addStudent,
        updateStudent,
        deleteStudent,
        addPayment,
        updatePayment,
        addFeeStructure,
        updateFeeStructure,
        deleteFeeStructure,
        refreshData,
      }}
    >
      {children}
    </OfflineDataContext.Provider>
  );
};
