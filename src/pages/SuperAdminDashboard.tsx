import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Building2, Users, CreditCard, Calendar, Settings, LogOut, Loader2, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";
import { format, addDays, addMonths } from "date-fns";

interface School {
  id: string;
  school_name: string;
  school_email: string | null;
  school_phone: string | null;
  subscription_status: string | null;
  plan_type: string | null;
  max_students: number | null;
  trial_start: string | null;
  trial_end: string | null;
  next_payment_date: string | null;
  last_payment_date: string | null;
  created_at: string | null;
}

interface SchoolStats {
  totalSchools: number;
  activeSchools: number;
  trialSchools: number;
  expiredSchools: number;
}

const SuperAdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [stats, setStats] = useState<SchoolStats>({ totalSchools: 0, activeSchools: 0, trialSchools: 0, expiredSchools: 0 });
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Dialog states
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Form states
  const [planType, setPlanType] = useState("small");
  const [subscriptionStatus, setSubscriptionStatus] = useState("active");
  const [maxStudents, setMaxStudents] = useState("200");
  const [subscriptionDays, setSubscriptionDays] = useState("30");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    checkSuperAdmin();
  }, [user]);

  const checkSuperAdmin = async () => {
    if (!user) {
      navigate("/superadmin-login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      toast.error("Access denied. Super admin only.");
      navigate("/");
      return;
    }

    setIsSuperAdmin(true);
    fetchSchools();
  };

  const fetchSchools = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("schools")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch schools");
      console.error(error);
    } else {
      setSchools(data || []);
      calculateStats(data || []);
    }
    setLoading(false);
  };

  const calculateStats = (schoolsData: School[]) => {
    setStats({
      totalSchools: schoolsData.length,
      activeSchools: schoolsData.filter(s => s.subscription_status === "active").length,
      trialSchools: schoolsData.filter(s => s.subscription_status === "trial").length,
      expiredSchools: schoolsData.filter(s => s.subscription_status === "expired").length,
    });
  };

  const openManageDialog = (school: School) => {
    setSelectedSchool(school);
    setPlanType(school.plan_type || "small");
    setSubscriptionStatus(school.subscription_status || "trial");
    setMaxStudents(String(school.max_students || 200));
    setSubscriptionDays("30");
    setManageDialogOpen(true);
  };

  const handleUpdateSchool = async () => {
    if (!selectedSchool) return;
    setActionLoading(true);

    const nextPaymentDate = subscriptionStatus === "active" 
      ? addDays(new Date(), parseInt(subscriptionDays))
      : null;

    const { error } = await supabase
      .from("schools")
      .update({
        plan_type: planType,
        subscription_status: subscriptionStatus,
        max_students: parseInt(maxStudents),
        next_payment_date: nextPaymentDate?.toISOString() || null,
        last_payment_date: subscriptionStatus === "active" ? new Date().toISOString() : selectedSchool.last_payment_date,
      })
      .eq("id", selectedSchool.id);

    if (error) {
      toast.error("Failed to update school");
      console.error(error);
    } else {
      toast.success("School updated successfully");
      setManageDialogOpen(false);
      fetchSchools();
    }
    setActionLoading(false);
  };

  const handleActivateSchool = async (school: School) => {
    const { error } = await supabase
      .from("schools")
      .update({
        subscription_status: "active",
        next_payment_date: addMonths(new Date(), 1).toISOString(),
        last_payment_date: new Date().toISOString(),
      })
      .eq("id", school.id);

    if (error) {
      toast.error("Failed to activate school");
    } else {
      toast.success(`${school.school_name} activated!`);
      fetchSchools();
    }
  };

  const handleDeactivateSchool = async (school: School) => {
    const { error } = await supabase
      .from("schools")
      .update({
        subscription_status: "expired",
        next_payment_date: null,
      })
      .eq("id", school.id);

    if (error) {
      toast.error("Failed to deactivate school");
    } else {
      toast.success(`${school.school_name} deactivated`);
      fetchSchools();
    }
  };

  const handleDeleteSchool = async () => {
    if (!selectedSchool) return;
    setActionLoading(true);

    // Delete related data first
    await supabase.from("payments").delete().eq("school_id", selectedSchool.id);
    await supabase.from("students").delete().eq("school_id", selectedSchool.id);
    await supabase.from("fee_structures").delete().eq("school_id", selectedSchool.id);
    await supabase.from("billing").delete().eq("school_id", selectedSchool.id);
    await supabase.from("school_settings").delete().eq("school_id", selectedSchool.id);
    await supabase.from("admin_profiles").delete().eq("school_id", selectedSchool.id);

    const { error } = await supabase
      .from("schools")
      .delete()
      .eq("id", selectedSchool.id);

    if (error) {
      toast.error("Failed to delete school");
      console.error(error);
    } else {
      toast.success("School deleted successfully");
      setDeleteDialogOpen(false);
      fetchSchools();
    }
    setActionLoading(false);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "trial":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Clock className="w-3 h-3 mr-1" />Trial</Badge>;
      case "expired":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/superadmin-login");
  };

  if (loading || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Super Admin Dashboard</h1>
              <p className="text-sm text-slate-400">School Management System</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="border-slate-600 text-slate-300 hover:bg-slate-700">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Schools</p>
                  <p className="text-2xl font-bold text-white">{stats.totalSchools}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Active</p>
                  <p className="text-2xl font-bold text-white">{stats.activeSchools}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Trial</p>
                  <p className="text-2xl font-bold text-white">{stats.trialSchools}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Expired</p>
                  <p className="text-2xl font-bold text-white">{stats.expiredSchools}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schools Table */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              All Schools
            </CardTitle>
            <CardDescription className="text-slate-400">
              Manage school subscriptions, plans, and access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-700/50">
                    <TableHead className="text-slate-300">School Name</TableHead>
                    <TableHead className="text-slate-300">Email</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-300">Plan</TableHead>
                    <TableHead className="text-slate-300">Max Students</TableHead>
                    <TableHead className="text-slate-300">Next Payment</TableHead>
                    <TableHead className="text-slate-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schools.map((school) => (
                    <TableRow key={school.id} className="border-slate-700 hover:bg-slate-700/30">
                      <TableCell className="text-white font-medium">{school.school_name}</TableCell>
                      <TableCell className="text-slate-300">{school.school_email || "-"}</TableCell>
                      <TableCell>{getStatusBadge(school.subscription_status)}</TableCell>
                      <TableCell className="text-slate-300 capitalize">{school.plan_type || "-"}</TableCell>
                      <TableCell className="text-slate-300">{school.max_students || "-"}</TableCell>
                      <TableCell className="text-slate-300">
                        {school.next_payment_date 
                          ? format(new Date(school.next_payment_date), "MMM dd, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => openManageDialog(school)}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          >
                            <Settings className="w-3 h-3 mr-1" />
                            Manage
                          </Button>
                          {school.subscription_status !== "active" ? (
                            <Button 
                              size="sm" 
                              onClick={() => handleActivateSchool(school)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Activate
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleDeactivateSchool(school)}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Deactivate
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => { setSelectedSchool(school); setDeleteDialogOpen(true); }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {schools.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                        No schools registered yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Manage Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Manage School</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update subscription and plan settings for {selectedSchool?.school_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Plan Type</Label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="small">Small (up to 200 students)</SelectItem>
                  <SelectItem value="medium">Medium (up to 500 students)</SelectItem>
                  <SelectItem value="large">Large (up to 1000 students)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (unlimited)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Subscription Status</Label>
              <Select value={subscriptionStatus} onValueChange={setSubscriptionStatus}>
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Max Students</Label>
              <Input 
                type="number" 
                value={maxStudents} 
                onChange={(e) => setMaxStudents(e.target.value)}
                className="bg-slate-700 border-slate-600"
              />
            </div>
            {subscriptionStatus === "active" && (
              <div className="space-y-2">
                <Label className="text-slate-200">Subscription Duration (days)</Label>
                <Select value={subscriptionDays} onValueChange={setSubscriptionDays}>
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days (1 month)</SelectItem>
                    <SelectItem value="90">90 days (3 months)</SelectItem>
                    <SelectItem value="180">180 days (6 months)</SelectItem>
                    <SelectItem value="365">365 days (1 year)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageDialogOpen(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={handleUpdateSchool} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete School</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete {selectedSchool?.school_name}? This action cannot be undone and will remove all associated data including students, payments, and fee structures.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSchool} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete School
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
