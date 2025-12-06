import { Link, useLocation, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  LayoutDashboard, 
  Users, 
  DollarSign, 
  FileText, 
  Settings, 
  LogOut,
  GraduationCap,
  BookOpen,
  CreditCard,
  MessageCircle,
  Shield,
  Menu
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MainLayout = () => {
  const { user, signOut, loading } = useAuth();
  const location = useLocation();
  const { subscription } = useSubscription();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      setIsSuperAdmin(!!data);
    };

    checkSuperAdmin();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ...(isSuperAdmin ? [{ name: "Admin Dashboard", href: "/admin-dashboard", icon: Shield }] : []),
    { name: "Students", href: "/students", icon: Users },
    { name: "Fee Structure", href: "/fee-structure", icon: BookOpen },
    { name: "Payments", href: "/payments", icon: DollarSign },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Billing", href: "/billing", icon: CreditCard },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Contact Us", href: "/contact", icon: MessageCircle },
  ];

  const NavLinks = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <>
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onLinkClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground text-sm">School Fee</h1>
            <p className="text-xs text-sidebar-foreground/60">Management</p>
          </div>
        </div>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 bg-sidebar border-sidebar-border p-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="font-semibold text-sidebar-foreground">School Fee</h1>
                  <p className="text-xs text-sidebar-foreground/60">Management System</p>
                </div>
              </div>
              <nav className="flex-1 px-3 py-4 space-y-1">
                <NavLinks onLinkClick={() => setMobileMenuOpen(false)} />
              </nav>
              <div className="p-3 border-t border-sidebar-border">
                <Button
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-sidebar-accent/50 border-sidebar-border hover:bg-destructive hover:text-destructive-foreground"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border">
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
            <div className="bg-primary/10 p-2 rounded-lg">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-foreground">School Fee</h1>
              <p className="text-xs text-sidebar-foreground/60">Management System</p>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            <NavLinks />
          </nav>
          <div className="p-3 border-t border-sidebar-border">
            <Button
              onClick={() => signOut()}
              variant="outline"
              className="w-full justify-start gap-3 bg-sidebar-accent/50 border-sidebar-border hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="md:pl-64 pt-16 md:pt-0">
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
