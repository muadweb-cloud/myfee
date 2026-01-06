import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Smartphone, 
  Monitor, 
  CheckCircle, 
  Wifi, 
  WifiOff, 
  HardDrive,
  Shield,
  Zap,
  ArrowRight,
  Apple,
  Chrome
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import appIcon from "@/assets/app-icon.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));
    setIsDesktop(!(/iphone|ipad|ipod|android/.test(userAgent)));

    // Check if already installed
    const checkInstalled = () => {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        setIsInstalled(true);
      }
      if ((navigator as any).standalone === true) {
        setIsInstalled(true);
      }
    };
    checkInstalled();

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Online/offline tracking
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const features = [
    {
      icon: WifiOff,
      title: "100% Offline",
      description: "Works without internet connection. All data stored locally on your device."
    },
    {
      icon: Zap,
      title: "Instant Updates",
      description: "Real-time calculations when adding students, recording payments, or updating fees."
    },
    {
      icon: HardDrive,
      title: "Local Storage",
      description: "All data persists on your device even after restart. No data loss."
    },
    {
      icon: Shield,
      title: "Plan Enforcement",
      description: "Subscription limits work offline. No cheating, no bypassing."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={appIcon} alt="MyFee" className="h-10 w-10 object-contain" />
            <span className="font-bold text-xl">MyFee</span>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="outline" className="gap-1">
                <Wifi className="h-3 w-3 text-green-500" />
                Online
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-6 py-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
            <Download className="h-4 w-4" />
            Install as App
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-foreground max-w-3xl mx-auto leading-tight">
            Install MyFee on Your Device
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get the full offline experience. Works on Windows, Android, and iOS. 
            No internet required after installation.
          </p>

          {isInstalled && (
            <Card className="max-w-md mx-auto border-green-500 bg-green-50 dark:bg-green-950/30">
              <CardContent className="py-6 flex items-center justify-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <span className="font-semibold text-green-700 dark:text-green-400">
                  App is already installed!
                </span>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Installation Cards */}
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Desktop (Windows/Mac/Linux) */}
          <Card className={`${isDesktop ? "border-primary ring-2 ring-primary/20" : ""}`}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Monitor className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Desktop</CardTitle>
                  <CardDescription>Windows, Mac, Linux</CardDescription>
                </div>
              </div>
              {isDesktop && <Badge>Your Device</Badge>}
            </CardHeader>
            <CardContent className="space-y-4">
              {deferredPrompt ? (
                <Button onClick={handleInstall} className="w-full gap-2" size="lg">
                  <Download className="h-4 w-4" />
                  Install Now
                </Button>
              ) : isInstalled ? (
                <Button disabled className="w-full gap-2" size="lg" variant="secondary">
                  <CheckCircle className="h-4 w-4" />
                  Already Installed
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    <strong>Chrome/Edge:</strong> Click the install icon in the address bar, or:
                  </p>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                    <li>Open browser menu (⋮)</li>
                    <li>Click "Install MyFee" or "Add to Desktop"</li>
                    <li>Confirm installation</li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Android */}
          <Card className={`${isAndroid ? "border-primary ring-2 ring-primary/20" : ""}`}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <Smartphone className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <CardTitle>Android</CardTitle>
                  <CardDescription>Chrome Browser</CardDescription>
                </div>
              </div>
              {isAndroid && <Badge>Your Device</Badge>}
            </CardHeader>
            <CardContent className="space-y-4">
              {isAndroid && deferredPrompt ? (
                <Button onClick={handleInstall} className="w-full gap-2" size="lg">
                  <Download className="h-4 w-4" />
                  Install Now
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Chrome className="h-4 w-4" />
                    Using Chrome Browser:
                  </div>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                    <li>Tap browser menu (⋮)</li>
                    <li>Select "Add to Home screen"</li>
                    <li>Tap "Add" to confirm</li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>

          {/* iOS */}
          <Card className={`${isIOS ? "border-primary ring-2 ring-primary/20" : ""}`}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gray-500/10 rounded-xl">
                  <Apple className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                </div>
                <div>
                  <CardTitle>iPhone / iPad</CardTitle>
                  <CardDescription>Safari Browser</CardDescription>
                </div>
              </div>
              {isIOS && <Badge>Your Device</Badge>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Safari is required for iOS installation:
                </p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Open this page in Safari</li>
                  <li>Tap the Share button (□↑)</li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Tap "Add" to confirm</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Features */}
        <section className="py-12">
          <h2 className="text-2xl font-bold text-center mb-8">Why Install?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="text-center">
                <CardContent className="pt-6">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-12">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-primary/10 to-blue-500/10 border-primary/20">
            <CardContent className="py-8 space-y-4">
              <h2 className="text-2xl font-bold">Ready to Get Started?</h2>
              <p className="text-muted-foreground">
                Install the app and start managing your school fees offline.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                {deferredPrompt && (
                  <Button onClick={handleInstall} size="lg" className="gap-2">
                    <Download className="h-4 w-4" />
                    Install App
                  </Button>
                )}
                <Button 
                  variant={deferredPrompt ? "outline" : "default"} 
                  size="lg" 
                  className="gap-2"
                  onClick={() => navigate("/auth")}
                >
                  Continue to Sign In
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} MyFee - School Fee Management System</p>
          <p className="mt-2">Works 100% offline after installation</p>
        </div>
      </footer>
    </div>
  );
};

export default Install;
