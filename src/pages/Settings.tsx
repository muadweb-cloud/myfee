import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface SchoolSettings {
  id: string;
  school_name: string;
  school_address: string | null;
  school_phone: string | null;
  school_email: string | null;
  monthly_target: number;
}

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [schoolData, setSchoolData] = useState({
    school_name: "",
    school_address: "",
    school_phone: "",
    school_email: "",
    monthly_target: 0,
  });

  useEffect(() => {
    fetchSchoolSettings();
  }, []);

  const fetchSchoolSettings = async () => {
    if (!user) return;

    // Get admin profile to find school_id
    const { data: profile } = await supabase
      .from('admin_profiles')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (!profile?.school_id) return;

    // Get school data
    const { data } = await supabase
      .from("schools")
      .select("id, school_name, school_address, school_phone, school_email, monthly_target")
      .eq("id", profile.school_id)
      .single();

    if (data) {
      setSchoolSettings(data as SchoolSettings);
      setSchoolData({
        school_name: data.school_name,
        school_address: data.school_address || "",
        school_phone: data.school_phone || "",
        school_email: data.school_email || "",
        monthly_target: data.monthly_target || 0,
      });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setPasswordData({ newPassword: "", confirmPassword: "" });
    }
  };

  const handleSchoolUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schoolSettings) return;

    setLoading(true);
    const { error } = await supabase
      .from("schools")
      .update({
        school_name: schoolData.school_name,
        school_address: schoolData.school_address || null,
        school_phone: schoolData.school_phone || null,
        school_email: schoolData.school_email || null,
        monthly_target: schoolData.monthly_target,
      })
      .eq("id", schoolSettings.id);

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "School information updated successfully",
      });
      fetchSchoolSettings();
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and school information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your admin account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input value={user?.email || ""} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your admin password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>School Information</CardTitle>
          <CardDescription>Update your school's contact details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSchoolUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="school_name">School Name *</Label>
              <Input
                id="school_name"
                value={schoolData.school_name}
                onChange={(e) => setSchoolData({ ...schoolData, school_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_address">School Address</Label>
              <Input
                id="school_address"
                value={schoolData.school_address}
                onChange={(e) => setSchoolData({ ...schoolData, school_address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_phone">Phone Number</Label>
              <Input
                id="school_phone"
                value={schoolData.school_phone}
                onChange={(e) => setSchoolData({ ...schoolData, school_phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_email">Email Address</Label>
              <Input
                id="school_email"
                type="email"
                value={schoolData.school_email}
                onChange={(e) => setSchoolData({ ...schoolData, school_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_target">Monthly Collection Target (Ksh)</Label>
              <Input
                id="monthly_target"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={schoolData.monthly_target}
                onChange={(e) => setSchoolData({ ...schoolData, monthly_target: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
