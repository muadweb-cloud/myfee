import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SubscriptionExpiryWarningProps {
  daysRemaining: number;
  show: boolean;
}

const SubscriptionExpiryWarning = ({ daysRemaining, show }: SubscriptionExpiryWarningProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Only show once per session
    const hasShown = sessionStorage.getItem('expiryWarningShown');
    if (show && !hasShown) {
      setOpen(true);
      sessionStorage.setItem('expiryWarningShown', 'true');
    }
  }, [show]);

  const handleGoToBilling = () => {
    setOpen(false);
    navigate('/billing');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/20 rounded-full">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <DialogTitle className="text-xl">Subscription Expiring Soon!</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Your subscription will expire in <span className="font-bold text-amber-600">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>. 
            Please renew your subscription to continue using all features without interruption.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              After your subscription expires, you will only have access to the billing page until you renew.
            </p>
          </div>
        </div>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Remind Me Later
          </Button>
          <Button onClick={handleGoToBilling} className="bg-amber-500 hover:bg-amber-600">
            Go to Billing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionExpiryWarning;
