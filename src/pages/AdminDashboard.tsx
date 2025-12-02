import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Building2, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface School {
  id: string;
  school_name: string;
  school_email: string;
  subscription_status: string;
  plan_type: string;
  max_students: number;
  trial_end: string;
  monthly_target: number;
  created_at: string;
}

interface SubscriptionRequest {
  id: string;
  school_id: string;
  amount: number;
  plan_type: string;
  status: string;
  created_at: string;
  schools: {
    school_name: string;
    school_email: string;
  };
}

const AdminDashboard = () => {
  const { toast } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTarget, setEditingTarget] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all schools
      const { data: schoolsData, error: schoolsError } = await supabase
        .from("schools")
        .select("*")
        .order("created_at", { ascending: false });

      if (schoolsError) throw schoolsError;

      // Fetch pending subscription requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("billing")
        .select(`
          id,
          school_id,
          amount,
          plan_type,
          status,
          created_at,
          schools (
            school_name,
            school_email
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;

      setSchools(schoolsData || []);
      setRequests(requestsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const approveSubscription = async (requestId: string, schoolId: string, planType: string) => {
    try {
      // Calculate max students and next payment date based on plan
      const maxStudentsMap = { small: 200, medium: 500, large: 1000 };
      const maxStudents = maxStudentsMap[planType as keyof typeof maxStudentsMap] || 200;
      
      const planDuration = planType.includes("yearly") ? 365 : 30;
      const nextPaymentDate = new Date();
      nextPaymentDate.setDate(nextPaymentDate.getDate() + planDuration);

      // Update billing request status
      const { error: billingError } = await supabase
        .from("billing")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (billingError) throw billingError;

      // Update school subscription
      const { error: schoolError } = await supabase
        .from("schools")
        .update({
          subscription_status: "active",
          plan_type: planType,
          max_students: maxStudents,
          next_payment_date: nextPaymentDate.toISOString(),
          last_payment_date: new Date().toISOString(),
        })
        .eq("id", schoolId);

      if (schoolError) throw schoolError;

      toast({
        title: "Success",
        description: "Subscription approved successfully",
      });

      fetchData();
    } catch (error) {
      console.error("Error approving subscription:", error);
      toast({
        title: "Error",
        description: "Failed to approve subscription",
        variant: "destructive",
      });
    }
  };

  const rejectSubscription = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("billing")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subscription request rejected",
      });

      fetchData();
    } catch (error) {
      console.error("Error rejecting subscription:", error);
      toast({
        title: "Error",
        description: "Failed to reject subscription",
        variant: "destructive",
      });
    }
  };

  const updateMonthlyTarget = async (schoolId: string, target: number) => {
    try {
      const { error } = await supabase
        .from("schools")
        .update({ monthly_target: target })
        .eq("id", schoolId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Monthly target updated",
      });

      fetchData();
      setEditingTarget({ ...editingTarget, [schoolId]: 0 });
    } catch (error) {
      console.error("Error updating target:", error);
      toast({
        title: "Error",
        description: "Failed to update target",
        variant: "destructive",
      });
    }
  };

  const updateSchoolPlan = async (schoolId: string, planType: string) => {
    const maxStudentsMap = { small: 200, medium: 500, large: 1000 };
    const maxStudents = maxStudentsMap[planType as keyof typeof maxStudentsMap] || 200;

    try {
      const { error } = await supabase
        .from("schools")
        .update({ plan_type: planType, max_students: maxStudents })
        .eq("id", schoolId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "School plan updated",
      });

      fetchData();
    } catch (error) {
      console.error("Error updating plan:", error);
      toast({
        title: "Error",
        description: "Failed to update plan",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage all schools and subscription requests</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{schools.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {schools.filter(s => s.subscription_status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Users className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{requests.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Subscription Requests</CardTitle>
            <CardDescription>Review and approve subscription requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.schools?.school_name || "N/A"}
                      </TableCell>
                      <TableCell>{request.schools?.school_email || "N/A"}</TableCell>
                      <TableCell>
                        <Badge>{request.plan_type}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(request.amount)}</TableCell>
                      <TableCell>
                        {new Date(request.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveSubscription(request.id, request.school_id, request.plan_type)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectSubscription(request.id)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Schools */}
      <Card>
        <CardHeader>
          <CardTitle>All Schools</CardTitle>
          <CardDescription>Manage school subscriptions and settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Max Students</TableHead>
                  <TableHead>Monthly Target</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.school_name}</TableCell>
                    <TableCell>{school.school_email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          school.subscription_status === "active"
                            ? "default"
                            : school.subscription_status === "trial"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {school.subscription_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={school.plan_type}
                        onValueChange={(value) => updateSchoolPlan(school.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{school.max_students}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          className="w-32"
                          placeholder={school.monthly_target?.toString() || "0"}
                          value={editingTarget[school.id] || ""}
                          onChange={(e) =>
                            setEditingTarget({
                              ...editingTarget,
                              [school.id]: Number(e.target.value),
                            })
                          }
                        />
                        <Button
                          size="sm"
                          onClick={() =>
                            updateMonthlyTarget(school.id, editingTarget[school.id] || 0)
                          }
                        >
                          Set
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("schools")
                            .update({ subscription_status: "active" })
                            .eq("id", school.id);
                          if (!error) {
                            toast({
                              title: "Success",
                              description: "Subscription activated",
                            });
                            fetchData();
                          }
                        }}
                      >
                        Activate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
