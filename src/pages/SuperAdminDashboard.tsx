import React, { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Building2, Users, CreditCard, Calendar, Settings, LogOut, Loader2, CheckCircle, XCircle, Clock, Trash2, Mail, Key, Eye, EyeOff, Send, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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

interface UserWithPassword {
  id: string;
  email: string;
  password: string; // Note: This is the plaintext password stored during registration
  school_name: string;
  created_at: string;
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
  const [users, setUsers] = useState<UserWithPassword[]>([]);
  const [stats, setStats] = useState<SchoolStats>({ totalSchools: 0, activeSchools: 0, trialSchools: 0, expiredSchools: 0 });
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  // Dialog states
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithPassword | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  
  // Form states
  const [planType, setPlanType] = useState("small");
  const [subscriptionStatus, setSubscriptionStatus] = useState("active");
  const [maxStudents, setMaxStudents] = useState("200");
  const [subscriptionDays, setSubscriptionDays] = useState("30");
  const [actionLoading, setActionLoading] = useState(false);
  
  // Messaging states
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState<{ email: string; name: string } | null>(null);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageContent, setMessageContent] = useState("");

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
    fetchUsers();
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

  const fetchUsers = async () => {
    // Fetch admin profiles with their school info
    const { data: profiles, error } = await supabase
      .from("admin_profiles")
      .select(`
        id,
        email,
        created_at,
        schools (school_name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
      return;
    }

    // For now, we'll show the email as password is not stored in plain text
    // In a real app, passwords should NEVER be stored or displayed in plain text
    const formattedUsers: UserWithPassword[] = (profiles || []).map((profile: any) => ({
      id: profile.id,
      email: profile.email,
      password: "Contact user for password reset", // Passwords are hashed and cannot be retrieved
      school_name: profile.schools?.school_name || "N/A",
      created_at: profile.created_at
    }));

    setUsers(formattedUsers);
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
      fetchUsers();
    }
    setActionLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);

    try {
      // First, get the admin profile to find associated school
      const { data: profile } = await supabase
        .from("admin_profiles")
        .select("school_id")
        .eq("id", selectedUser.id)
        .single();

      if (profile?.school_id) {
        // Delete all associated data
        await supabase.from("payments").delete().eq("school_id", profile.school_id);
        await supabase.from("students").delete().eq("school_id", profile.school_id);
        await supabase.from("fee_structures").delete().eq("school_id", profile.school_id);
        await supabase.from("billing").delete().eq("school_id", profile.school_id);
        await supabase.from("school_settings").delete().eq("school_id", profile.school_id);
        await supabase.from("user_roles").delete().eq("user_id", selectedUser.id);
        await supabase.from("admin_profiles").delete().eq("id", selectedUser.id);
        await supabase.from("schools").delete().eq("id", profile.school_id);
      }

      toast.success("User and associated data deleted successfully");
      setDeleteUserDialogOpen(false);
      fetchSchools();
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user completely");
    }
    
    setActionLoading(false);
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const openMessageDialog = (email: string, schoolName: string) => {
    setMessageRecipient({ email, name: schoolName });
    setMessageSubject("");
    setMessageContent("");
    setMessageDialogOpen(true);
  };

  const handleSendMessage = () => {
    if (!messageRecipient || !messageSubject || !messageContent) {
      toast.error("Please fill in all fields");
      return;
    }
    
    // Open mailto with pre-filled subject and body
    const mailtoLink = `mailto:${messageRecipient.email}?subject=${encodeURIComponent(messageSubject)}&body=${encodeURIComponent(messageContent)}`;
    window.open(mailtoLink, '_blank');
    
    toast.success(`Email client opened for ${messageRecipient.email}`);
    setMessageDialogOpen(false);
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

        {/* Tabs for Schools and Users */}
        <Tabs defaultValue="schools" className="space-y-4">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="schools" className="data-[state=active]:bg-slate-700">
              <Building2 className="w-4 h-4 mr-2" />
              Schools
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-slate-700">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schools">
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
          </TabsContent>

          <TabsContent value="users">
            {/* Users Table */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  All Users
                </CardTitle>
                <CardDescription className="text-slate-400">
                  View user credentials and manage user accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-slate-700/50">
                        <TableHead className="text-slate-300">Email</TableHead>
                        <TableHead className="text-slate-300">Password</TableHead>
                        <TableHead className="text-slate-300">School</TableHead>
                        <TableHead className="text-slate-300">Registered</TableHead>
                        <TableHead className="text-slate-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id} className="border-slate-700 hover:bg-slate-700/30">
                          <TableCell className="text-white font-medium">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-slate-400" />
                              {u.email}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            <div className="flex items-center gap-2">
                              <Key className="w-4 h-4 text-slate-400" />
                              <span className="font-mono text-xs">
                                {showPasswords[u.id] ? u.password : "••••••••"}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePasswordVisibility(u.id)}
                                className="h-6 w-6 p-0"
                              >
                                {showPasswords[u.id] ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300">{u.school_name}</TableCell>
                          <TableCell className="text-slate-300">
                            {u.created_at ? format(new Date(u.created_at), "MMM dd, yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openMessageDialog(u.email, u.school_name)}
                                className="border-slate-600 text-slate-200 hover:bg-slate-700"
                              >
                                <Send className="w-3 h-3 mr-1" />
                                Message
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => { setSelectedUser(u); setDeleteUserDialogOpen(true); }}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {users.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                            No users registered yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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

      {/* Delete School Confirmation Dialog */}
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

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Remove User</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to remove {selectedUser?.email}? This action cannot be undone and will remove the user and all associated data including their school, students, payments, and fee structures.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserDialogOpen(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Send Message
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Send an email to {messageRecipient?.name} ({messageRecipient?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Subject</Label>
              <Input 
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Enter email subject"
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Message</Label>
              <Textarea 
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Enter your message..."
                className="bg-slate-700 border-slate-600 min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialogOpen(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={handleSendMessage}>
              <Send className="w-4 h-4 mr-2" />
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
