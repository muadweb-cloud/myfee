import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface DashboardStats {
  totalStudents: number;
  totalExpectedFees: number;
  totalCollectedFees: number;
  totalBalance: number;
}

interface RecentPayment {
  id: string;
  student_name: string;
  amount: number;
  payment_date: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalExpectedFees: 0,
    totalCollectedFees: 0,
    totalBalance: 0,
  });
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch total students
      const { count: studentCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true });

      // Fetch total expected fees
      const { data: students } = await supabase
        .from("students")
        .select("total_fee");

      const totalExpected = students?.reduce((sum, student) => sum + Number(student.total_fee || 0), 0) || 0;

      // Fetch total collected fees
      const { data: payments } = await supabase
        .from("payments")
        .select("amount");

      const totalCollected = payments?.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;

      // Fetch recent payments
      const { data: recentPaymentsData } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          payment_date,
          students (full_name)
        `)
        .order("payment_date", { ascending: false })
        .limit(5);

      const formattedPayments = recentPaymentsData?.map((payment: any) => ({
        id: payment.id,
        student_name: payment.students?.full_name || "N/A",
        amount: payment.amount,
        payment_date: payment.payment_date,
      })) || [];

      setStats({
        totalStudents: studentCount || 0,
        totalExpectedFees: totalExpected,
        totalCollectedFees: totalCollected,
        totalBalance: totalExpected - totalCollected,
      });

      setRecentPayments(formattedPayments);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your school's financial overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">Active students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expected Fees</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{formatCurrency(stats.totalExpectedFees)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total expected revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Collected Fees</CardTitle>
            <DollarSign className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{formatCurrency(stats.totalCollectedFees)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalExpectedFees > 0 
                ? `${Math.round((stats.totalCollectedFees / stats.totalExpectedFees) * 100)}% collected`
                : "0% collected"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <AlertCircle className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{formatCurrency(stats.totalBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">Amount remaining</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>Latest fee payments received</CardDescription>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No payments recorded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.student_name}</TableCell>
                    <TableCell className="text-success">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
