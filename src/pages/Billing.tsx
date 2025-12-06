import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSubscription } from "@/hooks/useSubscription";
import { Calendar, MessageCircle, Mail, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BillingRecord {
  id: string;
  amount: number;
  plan_type: string;
  payment_method: string;
  transaction_id: string;
  created_at: string;
  expiry_date: string;
  status: string;
}

const plans = [
  {
    name: "Small",
    monthlyPrice: 999.99,
    yearlyPrice: 9999.99,
    maxStudents: 200,
    features: ["Up to 200 students", "Fee management", "Payment tracking", "Basic reports"],
  },
  {
    name: "Medium",
    monthlyPrice: 1499.99,
    yearlyPrice: 14999.99,
    maxStudents: 500,
    features: ["Up to 500 students", "Fee management", "Payment tracking", "Advanced reports", "SMS notifications"],
  },
  {
    name: "Large",
    monthlyPrice: 1999.99,
    yearlyPrice: 19999.99,
    maxStudents: 1000,
    features: ["Up to 1000 students", "Fee management", "Payment tracking", "Advanced reports", "SMS notifications", "Priority support"],
  },
];

const Billing = () => {
  const { schoolId } = useSchoolId();
  const { subscription } = useSubscription();
  const { toast } = useToast();
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ name: string; type: string; amount: number } | null>(null);

  const handleRequestClick = (planName: string, type: string, amount: number) => {
    setSelectedPlan({ name: planName, type, amount });
    setContactDialogOpen(true);
  };

  const handleContactAndRequest = async (method: "whatsapp" | "email") => {
    if (selectedPlan) {
      await requestSubscription(`${selectedPlan.name.toLowerCase()}-${selectedPlan.type}`, selectedPlan.amount);
      if (method === "whatsapp") {
        window.open("https://wa.me/254726383188", "_blank");
      } else {
        window.location.href = "mailto:Muadhaji24@gmail.com";
      }
    }
    setContactDialogOpen(false);
  };

  useEffect(() => {
    if (schoolId) {
      fetchBillingHistory();
    }
  }, [schoolId]);

  const fetchBillingHistory = async () => {
    if (!schoolId) return;

    try {
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBillingHistory(data || []);
    } catch (error) {
      console.error("Error fetching billing history:", error);
    } finally {
      setLoading(false);
    }
  };

  const requestSubscription = async (planType: string, amount: number) => {
    if (!subscription?.schoolId) {
      toast({
        title: "Error",
        description: "School ID not found",
        variant: "destructive",
      });
      return;
    }

    setProcessing(planType);

    try {
      const { error } = await supabase
        .from("billing")
        .insert({
          school_id: subscription.schoolId,
          amount,
          plan_type: planType,
          payment_method: "manual",
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: "Your subscription request has been submitted. Please contact admin to complete activation.",
      });

      fetchBillingHistory();
    } catch (error) {
      console.error("Request error:", error);
      toast({
        title: "Request Failed",
        description: "Failed to submit subscription request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your school subscription plan</p>
      </div>

      {/* Subscription Status */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge
                  variant={
                    subscription.status === "active"
                      ? "default"
                      : subscription.status === "trial"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {subscription.status.toUpperCase()}
                </Badge>
              </div>
              {subscription.status === "trial" && (
                <div>
                  <p className="text-sm text-muted-foreground">Trial Days Remaining</p>
                  <p className="text-2xl font-bold">{subscription.trialDaysRemaining}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Plan Type</p>
                <p className="text-lg font-semibold capitalize">{subscription.planType}</p>
                <p className="text-sm text-muted-foreground">Max {subscription.maxStudents} students</p>
              </div>
              {subscription.nextPaymentDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Next Payment Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <p className="text-sm">
                      {new Date(subscription.nextPaymentDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Administrator</DialogTitle>
            <DialogDescription>
              {selectedPlan && (
                <>Request {selectedPlan.name} {selectedPlan.type} plan ({formatCurrency(selectedPlan.amount)})</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <p className="text-sm text-muted-foreground">Choose how you'd like to contact us:</p>
            <Button
              className="w-full justify-start gap-3"
              variant="outline"
              onClick={() => handleContactAndRequest("whatsapp")}
            >
              <MessageCircle className="h-5 w-5 text-green-500" />
              WhatsApp: +254 726 383 188
            </Button>
            <Button
              className="w-full justify-start gap-3"
              variant="outline"
              onClick={() => handleContactAndRequest("email")}
            >
              <Mail className="h-5 w-5 text-primary" />
              Email: Muadhaji24@gmail.com
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Plans */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className={subscription?.planType === plan.name.toLowerCase() ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle>{plan.name} Plan</CardTitle>
              <div className="space-y-1">
                <div className="text-3xl font-bold">{formatCurrency(plan.monthlyPrice)}</div>
                <p className="text-sm text-muted-foreground">per month</p>
                <div className="text-xl font-semibold text-primary">{formatCurrency(plan.yearlyPrice)}</div>
                <p className="text-xs text-muted-foreground">per year (2 months free)</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="text-sm flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 text-success flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={() => handleRequestClick(plan.name, "monthly", plan.monthlyPrice)}
                  disabled={processing !== null}
                >
                  {processing === `${plan.name.toLowerCase()}-monthly` ? "Submitting..." : "Request Monthly"}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleRequestClick(plan.name, "yearly", plan.yearlyPrice)}
                  disabled={processing !== null}
                >
                  {processing === `${plan.name.toLowerCase()}-yearly` ? "Submitting..." : "Request Yearly"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription History</CardTitle>
          <CardDescription>Your subscription requests and payments</CardDescription>
        </CardHeader>
        <CardContent>
          {billingHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No billing history yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billingHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatCurrency(record.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.plan_type}</Badge>
                      </TableCell>
                      <TableCell>{record.payment_method || "N/A"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            record.status === "approved"
                              ? "default"
                              : record.status === "pending"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {record.status || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(record.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {record.expiry_date ? new Date(record.expiry_date).toLocaleDateString() : "N/A"}
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

export default Billing;
