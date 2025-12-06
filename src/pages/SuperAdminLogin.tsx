import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";

const SuperAdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign in with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        toast.error("Invalid credentials");
        setLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error("Login failed");
        setLoading(false);
        return;
      }

      // Check if user has super_admin role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .eq("role", "super_admin")
        .single();

      if (roleError || !roleData) {
        // Sign out if not a super admin
        await supabase.auth.signOut();
        toast.error("Not authorized. Super admin access only.");
        setLoading(false);
        return;
      }

      toast.success("Welcome, Super Admin!");
      navigate("/admin");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Super Admin Portal</CardTitle>
          <CardDescription className="text-slate-400">
            Authorized personnel only. Access restricted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Login as Super Admin
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminLogin;
