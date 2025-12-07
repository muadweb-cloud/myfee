import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, TrendingUp, AlertCircle, Calendar, Target, CalendarClock } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import appIcon from "@/assets/app-icon.png";

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
  monthKey: string;
  collected: number;
  target: number;
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
  const [schoolName, setSchoolName] = useState("");
  const [currentMonthCollected, setCurrentMonthCollected] = useState(0);

  useEffect(() => {
    if (schoolId) {
      fetchDashboardData();
    }
  }, [schoolId]);

  const fetchDashboardData = async () => {
    if (!schoolId) return;

    try {
      // Fetch school data
      const { data: schoolData } = await supabase
        .from("schools")
        .select("monthly_target, school_name")
        .eq("id", schoolId)
        .single();

      const target = schoolData?.monthly_target || 0;
      setMonthlyTarget(target);
      setSchoolName(schoolData?.school_name || "");

      // Fetch total students
      const { count: studentCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId);

      // Fetch total expected fees from students
      const { data: students } = await supabase
        .from("students")
        .select("total_fee")
        .eq("school_id", schoolId);

      const totalExpected = students?.reduce((sum, student) => sum + Number(student.total_fee || 0), 0) || 0;

      // Fetch all payments
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, payment_date")
        .eq("school_id", schoolId);

      const totalCollected = payments?.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;

      // Fetch recent payments with student names
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

      // Process monthly data for last 12 months
      const monthlyMap = new Map<string, number>();
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Initialize last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(key, 0);
      }

      // Aggregate payments by month
      payments?.forEach(payment => {
        if (payment.payment_date) {
          const date = new Date(payment.payment_date);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyMap.has(key)) {
            monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(payment.amount));
          }
        }
      });

      // Convert to array with formatted labels
      const monthlyArray: MonthlyData[] = Array.from(monthlyMap.entries()).map(([key, collected]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          monthKey: key,
          month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          collected,
          target: target,
        };
      });

      // Get current month's collection for the target progress
      const thisMonthCollection = monthlyMap.get(currentMonthKey) || 0;
      setCurrentMonthCollected(thisMonthCollection);

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

  // Calculate percentages using memoization for performance
  const collectionPercentage = useMemo(() => 
    stats.totalExpectedFees > 0 
      ? Math.round((stats.totalCollectedFees / stats.totalExpectedFees) * 100) 
      : 0
  , [stats.totalCollectedFees, stats.totalExpectedFees]);

  const targetPercentage = useMemo(() => 
    monthlyTarget > 0
      ? Math.min(Math.round((currentMonthCollected / monthlyTarget) * 100), 100)
      : 0
  , [currentMonthCollected, monthlyTarget]);

  const maxMonthlyCollection = useMemo(() => 
    Math.max(...monthlyData.map(d => d.collected), monthlyTarget || 1)
  , [monthlyData, monthlyTarget]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <img src={appIcon} alt="School Fee System" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">{schoolName || "Dashboard"}</h1>
            <p className="text-muted-foreground">Welcome back! Here's your school's financial overview</p>
          </div>
        </div>
        
        {subscription && (
          <Card className={`w-full sm:w-auto ${subscription.status === 'active' ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-primary/20'}`}>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Badge 
                    variant={subscription.status === 'active' ? 'default' : subscription.status === 'trial' ? 'secondary' : 'destructive'}
                    className={`text-xs ${subscription.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                  >
                    {subscription.status.toUpperCase()}
                  </Badge>
                  {subscription.status === 'trial' && (
                    <span className="text-xs text-muted-foreground">
                      {subscription.trialDaysRemaining} days left
                    </span>
                  )}
                </div>
                {subscription.status === 'active' && subscription.expiryDate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarClock className="h-3 w-3" />
                    <span>Expires: {new Date(subscription.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{stats.totalStudents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
              {subscription ? `of ${subscription.maxStudents.toLocaleString()} max capacity` : 'Enrolled students'}
            </p>
          </CardContent>
        </Card>

        <Card className="group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expected Fees</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{formatCurrency(stats.totalExpectedFees)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total expected revenue</p>
          </CardContent>
        </Card>

        <Card className="group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collected Fees</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 whitespace-nowrap overflow-hidden text-ellipsis">{formatCurrency(stats.totalCollectedFees)}</div>
            <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="text-green-600 dark:text-green-400 font-medium">{collectionPercentage}%</span> of expected fees
            </p>
          </CardContent>
        </Card>

        <Card className="group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap overflow-hidden text-ellipsis">{formatCurrency(stats.totalBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending collection</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Target Progress - Uses current month's collection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Monthly Target Progress
              </CardTitle>
              <CardDescription className="mt-1">
                {currentMonth} collection vs target
              </CardDescription>
            </div>
            {monthlyTarget > 0 && (
              <Badge variant={targetPercentage >= 100 ? "default" : targetPercentage >= 50 ? "secondary" : "outline"}>
                {targetPercentage >= 100 ? "Target Met!" : `${targetPercentage}% Complete`}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {monthlyTarget > 0 ? (
            <div className="space-y-4">
              <div className="relative h-12 bg-muted rounded-lg overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 rounded-lg flex items-center transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(targetPercentage, 100)}%` }}
                >
                  {targetPercentage >= 15 && (
                    <span className="absolute right-3 text-sm font-bold text-primary-foreground">
                      {targetPercentage}%
                    </span>
                  )}
                </div>
                {targetPercentage < 15 && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    {targetPercentage}%
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">This Month's Collection</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(currentMonthCollected)}</p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="text-muted-foreground">Monthly Target</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(monthlyTarget)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No monthly target set</p>
              <p className="text-sm mt-1">Set your target in Settings to track progress</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 12-Month Analysis - Shows collection vs monthly target */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            12-Month Fee Collection Analysis
          </CardTitle>
          <CardDescription>
            Monthly collections compared to your target of {formatCurrency(monthlyTarget)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monthlyData.map((data, index) => {
              const isCurrentMonth = data.monthKey === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
              const percentage = maxMonthlyCollection > 0 ? (data.collected / maxMonthlyCollection) * 100 : 0;
              const targetMet = monthlyTarget > 0 && data.collected >= monthlyTarget;
              
              return (
                <div 
                  key={data.monthKey} 
                  className={`flex items-center gap-4 p-2 rounded-lg transition-colors ${isCurrentMonth ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'}`}
                >
                  <div className="w-20 text-sm font-medium flex items-center gap-2">
                    {data.month}
                    {isCurrentMonth && <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />}
                  </div>
                  <div className="flex-1 relative">
                    <div className="h-8 bg-muted rounded-md overflow-hidden">
                      <div 
                        className={`h-full rounded-md transition-all duration-500 ${targetMet ? 'bg-green-500' : 'bg-primary/80'}`}
                        style={{ 
                          width: `${percentage}%`,
                          animationDelay: `${index * 50}ms`
                        }}
                      />
                    </div>
                    {/* Target line indicator */}
                    {monthlyTarget > 0 && maxMonthlyCollection > 0 && (
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-500/80"
                        style={{ left: `${(monthlyTarget / maxMonthlyCollection) * 100}%` }}
                        title={`Target: ${formatCurrency(monthlyTarget)}`}
                      />
                    )}
                  </div>
                  <div className="w-28 text-right">
                    <span className={`text-sm font-semibold ${targetMet ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                      {formatCurrency(data.collected)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {monthlyTarget > 0 && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary/80 rounded" />
                <span>Collection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span>Target Met</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-0.5 h-3 bg-amber-500" />
                <span>Monthly Target ({formatCurrency(monthlyTarget)})</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Recent Payments
          </CardTitle>
          <CardDescription>Latest fee payments received</CardDescription>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No payments recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((payment, index) => (
                    <TableRow 
                      key={payment.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <TableCell className="font-medium">{payment.student_name}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </TableCell>
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
