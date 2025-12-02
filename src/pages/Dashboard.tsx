import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, TrendingUp, AlertCircle, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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

interface MonthlyData {
  month: string;
  collected: number;
  expected: number;
  students: number;
}

const Dashboard = () => {
  const { schoolId } = useSchoolId();
  const { subscription } = useSubscription();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalExpectedFees: 0,
    totalCollectedFees: 0,
    totalBalance: 0,
  });
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  const [monthlyTarget, setMonthlyTarget] = useState(0);

  useEffect(() => {
    if (schoolId) {
      fetchDashboardData();
      fetchMonthlyTarget();
    }
  }, [schoolId]);

  const fetchMonthlyTarget = async () => {
    if (!schoolId) return;

    try {
      const { data } = await supabase
        .from("schools")
        .select("monthly_target")
        .eq("id", schoolId)
        .single();

      setMonthlyTarget(data?.monthly_target || 0);
    } catch (error) {
      console.error("Error fetching monthly target:", error);
    }
  };

  const fetchDashboardData = async () => {
    if (!schoolId) return;

    try {
      // Fetch total students
      const { count: studentCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId);

      // Fetch total expected fees
      const { data: students } = await supabase
        .from("students")
        .select("total_fee")
        .eq("school_id", schoolId);

      const totalExpected = students?.reduce((sum, student) => sum + Number(student.total_fee || 0), 0) || 0;

      // Fetch total collected fees
      const { data: payments } = await supabase
        .from("payments")
        .select("amount")
        .eq("school_id", schoolId);

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
        .eq("school_id", schoolId)
        .order("payment_date", { ascending: false })
        .limit(5);

      const formattedPayments = recentPaymentsData?.map((payment: any) => ({
        id: payment.id,
        student_name: payment.students?.full_name || "N/A",
        amount: payment.amount,
        payment_date: payment.payment_date,
      })) || [];

      // Fetch monthly data for last 12 months
      const { data: paymentsWithDate } = await supabase
        .from("payments")
        .select("amount, payment_date")
        .eq("school_id", schoolId)
        .gte("payment_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

      // Process monthly data
      const monthlyMap = new Map<string, { collected: number; expected: number; students: number }>();
      
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthlyMap.set(monthKey, { collected: 0, expected: totalExpected / 12, students: studentCount || 0 });
      }

      paymentsWithDate?.forEach(payment => {
        const date = new Date(payment.payment_date);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthlyMap.has(monthKey)) {
          const current = monthlyMap.get(monthKey)!;
          current.collected += Number(payment.amount);
        }
      });

      const monthlyArray = Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        ...data
      }));

      setStats({
        totalStudents: studentCount || 0,
        totalExpectedFees: totalExpected,
        totalCollectedFees: totalCollected,
        totalBalance: totalExpected - totalCollected,
      });

      setRecentPayments(formattedPayments);
      setMonthlyData(monthlyArray);
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

  const collectionPercentage = stats.totalExpectedFees > 0 
    ? Math.round((stats.totalCollectedFees / stats.totalExpectedFees) * 100) 
    : 0;

  const targetPercentage = monthlyTarget > 0
    ? Math.round((stats.totalCollectedFees / monthlyTarget) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your school's financial overview</p>
        </div>
        
        {subscription && (
          <Card className="w-full sm:w-auto">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div>
                  <Badge variant={subscription.status === 'active' ? 'default' : subscription.status === 'trial' ? 'secondary' : 'destructive'}>
                    {subscription.status.toUpperCase()}
                  </Badge>
                  {subscription.status === 'trial' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {subscription.trialDaysRemaining} days remaining
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {subscription && `of ${subscription.maxStudents} max`}
            </p>
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
              {collectionPercentage}% collected
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

      {/* Monthly Target Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Target Progress</CardTitle>
          <CardDescription>
            {monthlyTarget > 0 
              ? `Your monthly collection target: ${formatCurrency(monthlyTarget)}`
              : "No monthly target set by admin"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Target Achievement</span>
              <span className="font-semibold">{targetPercentage}%</span>
            </div>
            <div className="relative h-10 bg-muted rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-success to-success/80 rounded-full flex items-center justify-center transition-all duration-500"
                style={{ width: `${Math.min(targetPercentage, 100)}%` }}
              >
                {targetPercentage > 10 && (
                  <span className="text-sm font-bold text-white">{targetPercentage}%</span>
                )}
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Collected: {formatCurrency(stats.totalCollectedFees)}</span>
              <span>Target: {formatCurrency(monthlyTarget)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 12-Month Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            12-Month Fee Collection Analysis
          </CardTitle>
          <CardDescription>Monthly breakdown of fee collection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {monthlyData.map((data, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-16 text-sm font-medium">{data.month}</div>
                <div className="flex-1">
                  <div className="relative h-8 bg-muted rounded overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-primary/80 rounded"
                      style={{ width: `${Math.min((data.collected / data.expected) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-32 text-right text-sm">
                  <span className="font-semibold text-success">{formatCurrency(data.collected)}</span>
                  <span className="text-muted-foreground"> / {formatCurrency(data.expected)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
            <div className="overflow-x-auto">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
