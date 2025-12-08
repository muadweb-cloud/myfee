import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, BarChart3, Shield, ArrowRight, CheckCircle } from "lucide-react";
import appIcon from "@/assets/app-icon.png";
const Landing = () => {
  const features = [{
    icon: Users,
    title: "Student Management",
    description: "Easily manage student records, enrollment, and fee assignments in one place."
  }, {
    icon: DollarSign,
    title: "Fee Collection",
    description: "Track payments, generate receipts, and monitor outstanding balances effortlessly."
  }, {
    icon: BarChart3,
    title: "Financial Reports",
    description: "Get detailed insights with monthly reports, analytics, and collection trends."
  }, {
    icon: Shield,
    title: "Secure & Reliable",
    description: "Your data is protected with enterprise-grade security and regular backups."
  }];
  const benefits = ["Real-time dashboard with financial overview", "Monthly target tracking and progress", "Automated fee structure management", "Payment history and receipt generation", "Multi-class fee configuration", "Subscription-based flexible plans"];
  return <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={appIcon} alt="School Fee System" className="h-12 w-12 object-contain" />
            <span className="text-xl font-bold text-foreground">School Fee System</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Simplify Your School's
                <span className="text-primary block">Fee Management</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                A comprehensive solution for schools to manage student fees, track payments, 
                and generate financial reports with ease.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/auth">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Login to Dashboard
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>7-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>No credit card required</span>
              </div>
            </div>
          </div>

          {/* Preview Card */}
          <div className="relative">
            <div className="bg-card border rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-primary/10 px-6 py-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4 mb-6">
                  <img src={appIcon} alt="App Icon" className="h-12 w-12" />
                  <div>
                    <h3 className="font-semibold text-foreground">Dashboard Overview</h3>
                    <p className="text-sm text-muted-foreground">Real-time financial data</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground">Total Students</p>
                    <p className="text-2xl font-bold text-foreground">1,234</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground">Collected Fees</p>
                    <p className="text-2xl font-bold text-green-600">KES 2.5M</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground">Expected Fees</p>
                    <p className="text-2xl font-bold text-foreground">KES 3.2M</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="text-2xl font-bold text-amber-500">KES 700K</p>
                  </div>
                </div>
                <div className="bg-primary/10 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Monthly Target</span>
                    <span className="text-sm text-primary font-bold">78%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-[78%] bg-primary rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Everything You Need</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our comprehensive platform provides all the tools you need to efficiently manage your school's finances.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => <Card key={index} className="group hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>)}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-card border rounded-2xl p-8 md:p-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Why Schools Choose Us
              </h2>
              <p className="text-muted-foreground mb-8">
                Join hundreds of schools that have streamlined their fee management process with our platform.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-foreground">{benefit}</span>
                  </div>)}
              </div>
            </div>
            <div className="flex justify-center">
              <img src={appIcon} alt="School Fee System" className="h-48 w-48 object-contain opacity-80" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold text-foreground">Ready to Get Started?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Start your 7-day free trial today and experience the difference in fee management.
          </p>
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={appIcon} alt="School Fee System" className="h-8 w-8 object-contain" />
              <span className="font-semibold text-foreground">School Fee System</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} School Fee System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Landing;