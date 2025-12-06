import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Building2, Users, Settings, Power, PowerOff, Calendar, Eye, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface School {
  id: string;
  school_name: string;
  school_email: string;
  school_phone: string | null;
  subscription_status: string;
  plan_type: string;
  max_students: number;
  trial_end: string;
  monthly_target: number;
  created_at: string;
  next_payment_date: string | null;
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

interface SubscriptionFormData {
  plan_type: string;
  duration_months: number;
  custom_expiry: string;
  use_custom_expiry: boolean;
}

const AdminDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [editingTarget, setEditingTarget] = useState<{ [key: string]: number }>({});
  
  // Subscription management dialog
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionFormData>({
    plan_type: "small",
    duration_months: 1,
    custom_expiry: "",
    use_custom_expiry: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // View details dialog
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingSchool, setViewingSchool] = useState<School | null>(null);

  // Delete confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingSchool, setDeletingSchool] = useState<School | null>(null);

  // Check if user is super admin
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!data) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access the admin dashboard",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsSuperAdmin(true);
      fetchData();
    };

    checkAccess();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      const { data: schoolsData, error: schoolsError } = await supabase
        .from("schools")
        .select("*")
        .order("created_at", { ascending: false });

      if (schoolsError) throw schoolsError;

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

  const openManageDialog = (school: School) => {
    setSelectedSchool(school);
    setSubscriptionForm({
      plan_type: school.plan_type || "small",
      duration_months: 1,
      custom_expiry: school.next_payment_date 
        ? new Date(school.next_payment_date).toISOString().split('T')[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      use_custom_expiry: false,
    });
    setIsManageDialogOpen(true);
  };

  const activateSubscription = async () => {
    if (!selectedSchool) return;
    
    setIsProcessing(true);
    try {
      const maxStudentsMap = { small: 200, medium: 500, large: 1000 };
      const maxStudents = maxStudentsMap[subscriptionForm.plan_type as keyof typeof maxStudentsMap] || 200;
      
      let expiryDate: Date;
      if (subscriptionForm.use_custom_expiry && subscriptionForm.custom_expiry) {
        expiryDate = new Date(subscriptionForm.custom_expiry);
      } else {
        expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + subscriptionForm.duration_months);
      }

      const { error } = await supabase
        .from("schools")
        .update({
          subscription_status: "active",
          plan_type: subscriptionForm.plan_type,
          max_students: maxStudents,
          next_payment_date: expiryDate.toISOString(),
          last_payment_date: new Date().toISOString(),
        })
        .eq("id", selectedSchool.id);

      if (error) throw error;

      toast({
        title: "Subscription Activated",
        description: `${selectedSchool.school_name} is now active until ${expiryDate.toLocaleDateString()}`,
      });

      setIsManageDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error activating subscription:", error);
      toast({
        title: "Error",
        description: "Failed to activate subscription",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const deactivateSubscription = async (school: School) => {
    try {
      const { error } = await supabase
        .from("schools")
        .update({
          subscription_status: "expired",
          next_payment_date: null,
        })
        .eq("id", school.id);

      if (error) throw error;

      toast({
        title: "Subscription Deactivated",
        description: `${school.school_name} subscription has been deactivated`,
      });

      fetchData();
    } catch (error) {
      console.error("Error deactivating subscription:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate subscription",
        variant: "destructive",
      });
    }
  };

  const approveSubscription = async (requestId: string, schoolId: string, planType: string) => {
    try {
      const maxStudentsMap = { small: 200, medium: 500, large: 1000 };
      const maxStudents = maxStudentsMap[planType as keyof typeof maxStudentsMap] || 200;
      
      const planDuration = planType.includes("yearly") ? 365 : 30;
      const nextPaymentDate = new Date();
      nextPaymentDate.setDate(nextPaymentDate.getDate() + planDuration);

      const { error: billingError } = await supabase
        .from("billing")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (billingError) throw billingError;

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

  const openViewDialog = (school: School) => {
    setViewingSchool(school);
    setIsViewDialogOpen(true);
  };

  const openDeleteDialog = (school: School) => {
    setDeletingSchool(school);
    setIsDeleteDialogOpen(true);
  };

  const deleteSchool = async () => {
    if (!deletingSchool) return;

    try {
      // Delete related records first
      await supabase.from("payments").delete().eq("school_id", deletingSchool.id);
      await supabase.from("students").delete().eq("school_id", deletingSchool.id);
      await supabase.from("fee_structures").delete().eq("school_id", deletingSchool.id);
      await supabase.from("billing").delete().eq("school_id", deletingSchool.id);
      await supabase.from("school_settings").delete().eq("school_id", deletingSchool.id);
      await supabase.from("admin_profiles").delete().eq("school_id", deletingSchool.id);
      
      const { error } = await supabase
        .from("schools")
        .delete()
        .eq("id", deletingSchool.id);

      if (error) throw error;

      toast({
        title: "School Deleted",
        description: `${deletingSchool.school_name} has been deleted successfully`,
      });

      setIsDeleteDialogOpen(false);
      setDeletingSchool(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting school:", error);
      toast({
        title: "Error",
        description: "Failed to delete school",
        variant: "destructive",
      });
    }
  };

  if (loading || isSuperAdmin === null) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage all schools and subscription requests</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
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
            <Power className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {schools.filter(s => s.subscription_status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Trial Schools</CardTitle>
            <Calendar className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {schools.filter(s => s.subscription_status === 'trial').length}
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
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.school_name}</TableCell>
                    <TableCell>{school.school_email}</TableCell>
                    <TableCell>{school.school_phone || "N/A"}</TableCell>
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
                      <Badge variant="outline" className="capitalize">
                        {school.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {school.next_payment_date 
                        ? new Date(school.next_payment_date).toLocaleDateString()
                        : school.trial_end
                        ? new Date(school.trial_end).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openViewDialog(school)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {school.subscription_status === "active" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => deactivateSubscription(school)}
                          >
                            <PowerOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => openManageDialog(school)}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openDeleteDialog(school)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Subscription Management Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>
              Activate or modify subscription for {selectedSchool?.school_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Status</Label>
              <Badge
                variant={
                  selectedSchool?.subscription_status === "active"
                    ? "default"
                    : selectedSchool?.subscription_status === "trial"
                    ? "secondary"
                    : "destructive"
                }
              >
                {selectedSchool?.subscription_status}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan_type">Select Plan</Label>
              <Select
                value={subscriptionForm.plan_type}
                onValueChange={(value) =>
                  setSubscriptionForm({ ...subscriptionForm, plan_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small (200 students) - KSH 1,500/month</SelectItem>
                  <SelectItem value="medium">Medium (500 students) - KSH 3,000/month</SelectItem>
                  <SelectItem value="large">Large (1000 students) - KSH 5,000/month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Subscription Duration</Label>
              <Select
                value={subscriptionForm.use_custom_expiry ? "custom" : subscriptionForm.duration_months.toString()}
                onValueChange={(value) => {
                  if (value === "custom") {
                    setSubscriptionForm({ ...subscriptionForm, use_custom_expiry: true });
                  } else {
                    setSubscriptionForm({
                      ...subscriptionForm,
                      duration_months: parseInt(value),
                      use_custom_expiry: false,
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Month</SelectItem>
                  <SelectItem value="3">3 Months</SelectItem>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">12 Months (1 Year)</SelectItem>
                  <SelectItem value="custom">Custom Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {subscriptionForm.use_custom_expiry && (
              <div className="space-y-2">
                <Label htmlFor="custom_expiry">Expiry Date</Label>
                <Input
                  id="custom_expiry"
                  type="date"
                  value={subscriptionForm.custom_expiry}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) =>
                    setSubscriptionForm({ ...subscriptionForm, custom_expiry: e.target.value })
                  }
                />
              </div>
            )}

            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Summary:</strong> {selectedSchool?.school_name} will be activated on the{" "}
                <strong>{subscriptionForm.plan_type}</strong> plan until{" "}
                <strong>
                  {subscriptionForm.use_custom_expiry
                    ? new Date(subscriptionForm.custom_expiry).toLocaleDateString()
                    : new Date(
                        Date.now() + subscriptionForm.duration_months * 30 * 24 * 60 * 60 * 1000
                      ).toLocaleDateString()}
                </strong>
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsManageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={activateSubscription} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Activate Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View School Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>School Details</DialogTitle>
            <DialogDescription>
              Details for {viewingSchool?.school_name}
            </DialogDescription>
          </DialogHeader>
          {viewingSchool && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">School Name</Label>
                  <p className="font-medium">{viewingSchool.school_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{viewingSchool.school_email || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{viewingSchool.school_phone || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge
                    variant={
                      viewingSchool.subscription_status === "active"
                        ? "default"
                        : viewingSchool.subscription_status === "trial"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {viewingSchool.subscription_status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Plan</Label>
                  <p className="font-medium capitalize">{viewingSchool.plan_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Max Students</Label>
                  <p className="font-medium">{viewingSchool.max_students}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Monthly Target</Label>
                  <p className="font-medium">{formatCurrency(viewingSchool.monthly_target)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Next Payment</Label>
                  <p className="font-medium">
                    {viewingSchool.next_payment_date 
                      ? new Date(viewingSchool.next_payment_date).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="font-medium">
                    {new Date(viewingSchool.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsViewDialogOpen(false);
              if (viewingSchool) openManageDialog(viewingSchool);
            }}>
              Manage Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete School</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingSchool?.school_name}</strong>? 
              This will permanently delete the school and all associated data including students, 
              payments, and fee structures. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSchool}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete School
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
