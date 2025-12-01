import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { Calendar, CreditCard, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PLANS = {
  small: { monthly: 999.99, yearly: 9999.99, maxStudents: 200, name: "Small (<200 students)" },
  medium: { monthly: 1499.99, yearly: 14999.99, maxStudents: 500, name: "Medium (200-500 students)" },
  large: { monthly: 1999.99, yearly: 19999.99, maxStudents: 1000, name: "Large (500+ students)" }
};

export default function Billing() {
  const { schoolId } = useSchoolId();
  const [school, setSchool] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ type: 'small' | 'medium' | 'large', period: 'monthly' | 'yearly' } | null>(null);

  useEffect(() => {
    if (schoolId) {
      fetchSchoolData();
      fetchBillingHistory();
    }
  }, [schoolId]);

  const fetchSchoolData = async () => {
    const { data } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single();
    
    if (data) setSchool(data);
  };

  const fetchBillingHistory = async () => {
    const { data } = await supabase
      .from('billing')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    
    if (data) setBillingHistory(data);
  };

  const handlePayment = async () => {
    if (!selectedPlan || !phoneNumber) {
      toast.error("Please select a plan and enter your M-PESA phone number");
      return;
    }

    setLoading(true);
    try {
      const amount = PLANS[selectedPlan.type][selectedPlan.period];
      
      const { data, error } = await supabase.functions.invoke('mpesa-stkpush', {
        body: {
          phone: phoneNumber,
          amount: amount,
          schoolId: schoolId,
          planType: selectedPlan.period,
          planSize: selectedPlan.type
        }
      });

      if (error) throw error;
      
      toast.success("M-PESA STK Push sent! Please complete payment on your phone.");
    } catch (error: any) {
      toast.error(error.message || "Payment initiation failed");
    } finally {
      setLoading(false);
    }
  };

  const trialDaysRemaining = school ? Math.max(0, Math.ceil((new Date(school.trial_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Subscription & Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription plan and payments</p>
      </div>

      {/* Current Status */}
      <Card className="p-6">
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Subscription Status</p>
            <Badge variant={school?.subscription_status === 'active' ? 'default' : school?.subscription_status === 'trial' ? 'secondary' : 'destructive'}>
              {school?.subscription_status?.toUpperCase()}
            </Badge>
          </div>
          
          {school?.subscription_status === 'trial' && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Trial Days Remaining</p>
              <p className="text-2xl font-bold text-foreground">{trialDaysRemaining} days</p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-2">Current Plan</p>
            <p className="text-lg font-semibold text-foreground">{PLANS[school?.plan_type as keyof typeof PLANS]?.name}</p>
            <p className="text-sm text-muted-foreground">Max {school?.max_students} students</p>
          </div>

          {school?.next_payment_date && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Next Payment</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <p className="text-sm">{new Date(school.next_payment_date).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Subscription Plans */}
      {(school?.subscription_status === 'trial' || school?.subscription_status === 'expired') && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Choose Your Plan</h2>
          
          <Tabs defaultValue="monthly" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly (Save 2 months)</TabsTrigger>
            </TabsList>

            <TabsContent value="monthly" className="space-y-4">
              {Object.entries(PLANS).map(([key, plan]) => (
                <Card key={key} className={`p-4 cursor-pointer transition-all ${selectedPlan?.type === key && selectedPlan?.period === 'monthly' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedPlan({ type: key as any, period: 'monthly' })}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">Up to {plan.maxStudents} students</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{formatCurrency(plan.monthly)}</p>
                      <p className="text-sm text-muted-foreground">per month</p>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="yearly" className="space-y-4">
              {Object.entries(PLANS).map(([key, plan]) => (
                <Card key={key} className={`p-4 cursor-pointer transition-all ${selectedPlan?.type === key && selectedPlan?.period === 'yearly' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedPlan({ type: key as any, period: 'yearly' })}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">Up to {plan.maxStudents} students</p>
                      <Badge variant="secondary" className="mt-1">Save 2 months FREE</Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{formatCurrency(plan.yearly)}</p>
                      <p className="text-sm text-muted-foreground">per year</p>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>
          </Tabs>

          {selectedPlan && (
            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="phone">M-PESA Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="254XXXXXXXXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <Button onClick={handlePayment} disabled={loading} className="w-full">
                <CreditCard className="mr-2 h-4 w-4" />
                {loading ? "Processing..." : `Pay ${formatCurrency(PLANS[selectedPlan.type][selectedPlan.period])} with M-PESA`}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Payment History */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Payment History</h2>
        
        {billingHistory.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No payment history yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billingHistory.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell>{new Date(bill.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{formatCurrency(bill.amount)}</TableCell>
                  <TableCell className="capitalize">{bill.plan_type}</TableCell>
                  <TableCell className="font-mono text-sm">{bill.transaction_id}</TableCell>
                  <TableCell>
                    <Badge variant="default">
                      <Check className="h-3 w-3 mr-1" />
                      Paid
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
