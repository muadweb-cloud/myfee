import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, DollarSign, TrendingUp, AlertCircle, CalendarClock, BarChart3, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import appIcon from "@/assets/app-icon.png";
import SubscriptionExpiryWarning from "@/components/SubscriptionExpiryWarning";
import TargetSettingDialog from "@/components/TargetSettingDialog";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useOfflineData } from "@/contexts/OfflineDataContext";
import { useToast } from "@/hooks/use-toast";

interface ChartDataPoint {
  label: string;
  amount: number;
}

type TimeRange = '48hours' | '30days' | '3months' | '1year';

const Dashboard = () => {
  const { students, payments, feeStructures, schoolInfo, subscription, loading, pendingOpsCount, isOnline, lastSyncedAt, syncNow } = useOfflineData();
  const { toast } = useToast();
  
  const [feeGraphRange, setFeeGraphRange] = useState<TimeRange>('30days');
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!isOnline) {
      toast({ title: "Offline", description: "Cannot sync while offline", variant: "destructive" });
      return;
    }
    setSyncing(true);
    const result = await syncNow();
    setSyncing(false);
    toast({
      title: "Sync Complete",
      description: result.synced > 0 ? `${result.synced} changes synced successfully` : "No pending changes to sync",
    });
  };

  // Calculate stats from local data - compute expected fees from fee structures
  const stats = useMemo(() => {
    const totalStudents = students.length;
    // Calculate expected fees from fee structures, not from student.total_fee
    const totalExpectedFees = students.reduce((sum, s) => {
      // Find fee for this student's class
      const classFee = feeStructures.find((f) => f.id === s.class_id);
      return sum + (classFee?.fee_amount || Number(s.total_fee || 0));
    }, 0);
    const totalCollectedFees = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalBalance = totalExpectedFees - totalCollectedFees;
    return { totalStudents, totalExpectedFees, totalCollectedFees, totalBalance };
  }, [students, payments, feeStructures]);

  // Recent payments (last 5)
  const recentPayments = useMemo(() => {
    return payments.slice(0, 5).map((p) => ({
      id: p.id,
      student_name: p.student_name || "N/A",
      amount: p.amount,
      payment_date: p.payment_date,
    }));
  }, [payments]);

  // Monthly target data
  const monthlyTarget = schoolInfo?.monthly_target || 0;

  const currentMonthCollected = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return payments
      .filter((p) => {
        if (!p.payment_date) return false;
        const date = new Date(p.payment_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return key === currentMonthKey;
      })
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  // Monthly data for bar chart
  const monthlyData = useMemo(() => {
    const monthlyMap = new Map<string, number>();
    const now = new Date();

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, 0);
    }

    payments.forEach((payment) => {
      if (payment.payment_date) {
        const date = new Date(payment.payment_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyMap.has(key)) {
          monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(payment.amount));
        }
      }
    });

    return Array.from(monthlyMap.entries()).map(([key, collected]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return {
        monthKey: key,
        month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        collected,
        target: monthlyTarget,
      };
    });
  }, [payments, monthlyTarget]);

  // Fee chart data based on selected range
  const feeChartData = useMemo((): ChartDataPoint[] => {
    const now = new Date();
    let startDate: Date;
    let groupBy: 'hour' | 'day' | 'month';
    
    switch (feeGraphRange) {
      case '48hours':
        startDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        groupBy = 'hour';
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case '3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case '1year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        groupBy = 'month';
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
    }

    const filteredPayments = payments.filter((p) => {
      const paymentDate = new Date(p.payment_date);
      return paymentDate >= startDate && paymentDate <= now;
    });

    const grouped = new Map<string, number>();

    if (groupBy === 'hour') {
      for (let i = 47; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 60 * 60 * 1000);
        const key = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
        grouped.set(key, 0);
      }
      
      filteredPayments.forEach((p) => {
        const date = new Date(p.payment_date);
        const key = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
        if (grouped.has(key)) {
          grouped.set(key, (grouped.get(key) || 0) + Number(p.amount));
        }
      });
    } else if (groupBy === 'day') {
      const days = feeGraphRange === '30days' ? 30 : 90;
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        grouped.set(key, 0);
      }
      
      filteredPayments.forEach((p) => {
        const date = new Date(p.payment_date);
        const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (grouped.has(key)) {
          grouped.set(key, (grouped.get(key) || 0) + Number(p.amount));
        }
      });
    } else {
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        grouped.set(key, 0);
      }
      
      filteredPayments.forEach((p) => {
        const date = new Date(p.payment_date);
        const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (grouped.has(key)) {
          grouped.set(key, (grouped.get(key) || 0) + Number(p.amount));
        }
      });
    }

    return Array.from(grouped.entries()).map(([label, amount]) => ({ label, amount }));
  }, [payments, feeGraphRange]);

  const rangeTotal = useMemo(() => {
    return feeChartData.reduce((sum, d) => sum + d.amount, 0);
  }, [feeChartData]);

  const collectionPercentage = useMemo(
    () => (stats.totalExpectedFees > 0 ? Math.round((stats.totalCollectedFees / stats.totalExpectedFees) * 100) : 0),
    [stats.totalCollectedFees, stats.totalExpectedFees]
  );

  const targetPercentage = useMemo(
    () => (monthlyTarget > 0 ? Math.min(Math.round((currentMonthCollected / monthlyTarget) * 100), 100) : 0),
    [currentMonthCollected, monthlyTarget]
  );

  const maxMonthlyCollection = useMemo(
    () => Math.max(...monthlyData.map((d) => d.collected), monthlyTarget || 1),
    [monthlyData, monthlyTarget]
  );

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
      {/* Offline indicator with sync button */}
      {(!isOnline || pendingOpsCount > 0) && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {!isOnline ? "You're offline. " : ""}
                  {pendingOpsCount > 0 ? `${pendingOpsCount} change${pendingOpsCount > 1 ? 's' : ''} pending sync.` : "Data shown from cache."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {lastSyncedAt && (
                  <span className="text-xs text-muted-foreground">
                    Last synced: {lastSyncedAt.toLocaleTimeString()}
                  </span>
                )}
                {isOnline && pendingOpsCount > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleSync}
                    disabled={syncing}
                    className="gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? "Syncing..." : "Sync Now"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <img src={appIcon} alt="Shule Yako" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">{schoolInfo?.school_name || "Dashboard"}</h1>
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
                    <span>Expires: {new Date(subscription.expiryDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}</span>
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
            <div className="text-2xl sm:text-3xl font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
              {stats.totalStudents.toLocaleString()}
            </div>
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
            <div className="text-2xl sm:text-3xl font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
              {formatCurrency(stats.totalExpectedFees)}
            </div>
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
            <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 whitespace-nowrap overflow-hidden text-ellipsis">
              {formatCurrency(stats.totalCollectedFees)}
            </div>
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
            <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap overflow-hidden text-ellipsis">
              {formatCurrency(stats.totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending collection</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Expiry Warning Popup */}
      {subscription?.showExpiryWarning && (
        <SubscriptionExpiryWarning 
          daysRemaining={subscription.daysUntilExpiry || 0} 
          show={subscription.showExpiryWarning} 
        />
      )}

      {/* Target Setting Dialog */}
      <TargetSettingDialog
        open={targetDialogOpen}
        onOpenChange={setTargetDialogOpen}
        schoolId={schoolInfo?.id || ''}
        currentTarget={monthlyTarget}
        expectedFees={stats.totalExpectedFees}
        onTargetUpdated={() => {}}
      />

      {/* Fee Collection Graph */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Fee Collection Trend
            </CardTitle>
            <CardDescription>
              Total collected: {formatCurrency(rangeTotal)}
            </CardDescription>
          </div>
          <Select value={feeGraphRange} onValueChange={(v) => setFeeGraphRange(v as TimeRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="48hours">Last 48 Hours</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={feeChartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 10 }} 
                  interval="preserveStartEnd"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Collected']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#colorAmount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Monthly Target Progress */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Monthly Target</CardTitle>
              <CardDescription>{currentMonth}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setTargetDialogOpen(true)}>
              Set Target
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Collected</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(currentMonthCollected)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Target</span>
              <span className="font-semibold">{formatCurrency(monthlyTarget)}</span>
            </div>
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <span className="text-xs font-semibold inline-block text-primary">
                  {targetPercentage}% Complete
                </span>
              </div>
              <div className="overflow-hidden h-3 text-xs flex rounded-full bg-muted">
                <div
                  style={{ width: `${targetPercentage}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-500"
                />
              </div>
            </div>

            {/* Monthly bar chart */}
            <div className="pt-4">
              <p className="text-sm font-medium mb-3">Last 12 Months</p>
              <div className="flex items-end justify-between gap-1 h-24">
                {monthlyData.map((data, index) => {
                  const height = maxMonthlyCollection > 0 ? (data.collected / maxMonthlyCollection) * 100 : 0;
                  const isCurrentMonth = index === monthlyData.length - 1;
                  return (
                    <div key={data.monthKey} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${
                          isCurrentMonth ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${data.month}: ${formatCurrency(data.collected)}`}
                      />
                      <span className="text-[8px] text-muted-foreground mt-1 truncate w-full text-center">
                        {data.month.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Payments</CardTitle>
            <CardDescription>Latest fee payments received</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No payments recorded yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.student_name}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400 font-semibold">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
