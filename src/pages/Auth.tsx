import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import appIcon from "@/assets/app-icon.png";
import { supabase } from "@/integrations/supabase/client";


const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  
  // Forgot password flow states
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'newPassword'>('email');
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  
  const [loginData, setLoginData] = useState({
    email: "",
    password: ""
  });
  
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    schoolName: "",
    schoolAddress: "",
    schoolPhone: ""
  });

  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [isResetLoading, setIsResetLoading] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const isRecoveryMode = searchParams.get("type") === "recovery";
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "login";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setIsLoading(false);
    if (error) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // All fields are now required
    if (!signupData.email || !signupData.password || !signupData.confirmPassword || !signupData.schoolName || !signupData.schoolAddress || !signupData.schoolPhone) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (signupData.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(
      signupData.email, 
      signupData.password, 
      signupData.schoolName,
      signupData.schoolAddress,
      signupData.schoolPhone
    );
    setIsLoading(false);
    
    if (error) {
      toast({
        title: "Signup Failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Account created successfully!"
      });
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetPassword || !resetConfirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (resetPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsResetLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: resetPassword,
    });
    setIsResetLoading(false);

    if (error) {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      navigate("/dashboard");
    }
  };

  const handleSendCode = async () => {
    if (!forgotEmail) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive"
      });
      return;
    }

    setForgotLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth?type=recovery`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Reset Link Sent",
          description: "Check your email for the password reset link"
        });
        setForgotPasswordOpen(false);
        resetForgotState();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
    setForgotLoading(false);
  };

  const handleVerifyCode = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast({
        title: "Error",
        description: "Please enter a valid 6-digit code",
        variant: "destructive"
      });
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: forgotEmail,
        token: otpCode,
        type: 'email'
      });

      if (error) {
        toast({
          title: "Invalid Code",
          description: "The code you entered is invalid or expired",
          variant: "destructive"
        });
      } else {
        setForgotStep('newPassword');
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
    setForgotLoading(false);
  };

  const handleSetNewPassword = async () => {
    if (!newPassword || !confirmNewPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Password updated successfully!"
        });
        setForgotPasswordOpen(false);
        resetForgotState();
        navigate("/dashboard");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
    setForgotLoading(false);
  };

  const resetForgotState = () => {
    setForgotStep('email');
    setForgotEmail("");
    setOtpCode("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const handleCloseForgotDialog = (open: boolean) => {
    if (!open) {
      resetForgotState();
    }
    setForgotPasswordOpen(open);
  };

  // Recovery mode from email link
  if (isRecoveryMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-2">
              <img src={appIcon} alt="School Fee System" className="h-16 w-16 object-contain" />
            </div>
            <CardTitle className="text-2xl">Reset Your Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isResetLoading}>
                {isResetLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <img src={appIcon} alt="School Fee System" className="h-16 w-16 object-contain" />
          </div>
          <CardTitle className="text-2xl">School Fee System</CardTitle>
          <CardDescription>Admin Portal - Manage your school's finances</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input 
                    id="login-email" 
                    type="email" 
                    placeholder="admin@school.com" 
                    value={loginData.email} 
                    onChange={e => setLoginData({ ...loginData, email: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input 
                    id="login-password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={loginData.password} 
                    onChange={e => setLoginData({ ...loginData, password: e.target.value })} 
                    required 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
                <div className="text-center">
                  <button 
                    type="button"
                    onClick={() => setForgotPasswordOpen(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email *</Label>
                  <Input 
                    id="signup-email" 
                    type="email" 
                    placeholder="admin@school.com" 
                    value={signupData.email} 
                    onChange={e => setSignupData({ ...signupData, email: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password *</Label>
                  <Input 
                    id="signup-password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={signupData.password} 
                    onChange={e => setSignupData({ ...signupData, password: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password *</Label>
                  <Input 
                    id="signup-confirm-password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={signupData.confirmPassword} 
                    onChange={e => setSignupData({ ...signupData, confirmPassword: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-school-name">School Name *</Label>
                  <Input 
                    id="signup-school-name" 
                    type="text" 
                    placeholder="ABC Primary School" 
                    value={signupData.schoolName} 
                    onChange={e => setSignupData({ ...signupData, schoolName: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-school-address">School Address *</Label>
                  <Input 
                    id="signup-school-address" 
                    type="text" 
                    placeholder="123 Education Street, City" 
                    value={signupData.schoolAddress} 
                    onChange={e => setSignupData({ ...signupData, schoolAddress: e.target.value })} 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-school-phone">Phone Number *</Label>
                  <Input 
                    id="signup-school-phone" 
                    type="tel" 
                    placeholder="+254 700 000 000" 
                    value={signupData.schoolPhone} 
                    onChange={e => setSignupData({ ...signupData, schoolPhone: e.target.value })} 
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={handleCloseForgotDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Forgot Password</DialogTitle>
            <DialogDescription>
              Enter your email to receive a password reset link
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email Address</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="admin@school.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleSendCode}
              disabled={forgotLoading}
            >
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;