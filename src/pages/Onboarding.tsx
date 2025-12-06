import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Building2, MapPin, Phone } from "lucide-react";

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [schoolData, setSchoolData] = useState({
    schoolName: "",
    schoolAddress: "",
    schoolPhone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schoolData.schoolName.trim()) {
      toast({
        title: "Error",
        description: "School name is required",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get the user's school_id from admin_profiles
      const { data: profile, error: profileError } = await supabase
        .from("admin_profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.school_id) {
        throw new Error("Could not find your school profile");
      }

      // Update the school with the provided information
      const { error: updateError } = await supabase
        .from("schools")
        .update({
          school_name: schoolData.schoolName.trim(),
          school_address: schoolData.schoolAddress.trim() || null,
          school_phone: schoolData.schoolPhone.trim() || null,
        })
        .eq("id", profile.school_id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Welcome!",
        description: "Your school has been registered successfully.",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register school",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="bg-primary/10 p-3 rounded-full">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Register Your School</CardTitle>
          <CardDescription>
            Complete your school registration to get started with the fee management system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="school-name" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                School Name *
              </Label>
              <Input
                id="school-name"
                type="text"
                placeholder="Enter your school name"
                value={schoolData.schoolName}
                onChange={(e) => setSchoolData({ ...schoolData, schoolName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school-address" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                School Address
              </Label>
              <Input
                id="school-address"
                type="text"
                placeholder="Enter school address"
                value={schoolData.schoolAddress}
                onChange={(e) => setSchoolData({ ...schoolData, schoolAddress: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school-phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                School Phone Number
              </Label>
              <Input
                id="school-phone"
                type="tel"
                placeholder="Enter school phone number"
                value={schoolData.schoolPhone}
                onChange={(e) => setSchoolData({ ...schoolData, schoolPhone: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Registering..." : "Complete Registration"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
