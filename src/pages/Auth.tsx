import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Mail } from "lucide-react";
import appIcon from "@/assets/app-icon.png";

const CONTACT_EMAIL = "schoolfeesystem@gmail.com";
const CONTACT_WHATSAPP = "+255 123 456 789";

const Auth = () => {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  
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
          <Tabs defaultValue="login" className="w-full">
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
      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Forgot Password</DialogTitle>
            <DialogDescription>
              Please contact the developer to recover your password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <MessageCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                <a 
                  href={`https://wa.me/${CONTACT_WHATSAPP.replace(/[^0-9+]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {CONTACT_WHATSAPP}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <a 
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-sm text-primary hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;