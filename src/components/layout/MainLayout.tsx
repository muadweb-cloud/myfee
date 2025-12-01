import { Link, useLocation, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
  MessageCircle
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

const MainLayout = () => {
  const { user, signOut, loading } = useAuth();
  const location = useLocation();
  const { subscription } = useSubscription();

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
    { name: "Students", href: "/students", icon: Users },
    { name: "Fee Structure", href: "/fee-structure", icon: BookOpen },
    { name: "Payments", href: "/payments", icon: DollarSign },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Billing", href: "/billing", icon: CreditCard },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Contact Us", href: "/contact", icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
            <div className="bg-primary/10 p-2 rounded-lg">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-foreground">School Fee</h1>
              <p className="text-xs text-sidebar-foreground/60">Management System</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
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
          </nav>

          {/* Logout */}
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
      <div className="pl-64">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
