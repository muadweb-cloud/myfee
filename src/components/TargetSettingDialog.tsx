import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";

interface TargetSettingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  currentTarget: number;
  expectedFees: number;
  onTargetUpdated: () => void;
}

const TargetSettingDialog = ({ 
  open, 
  onOpenChange, 
  schoolId, 
  currentTarget, 
  expectedFees,
  onTargetUpdated 
}: TargetSettingDialogProps) => {
  const { toast } = useToast();
  const [targetType, setTargetType] = useState<'custom' | 'expected'>('custom');
  const [customTarget, setCustomTarget] = useState(currentTarget.toString());
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    
    const newTarget = targetType === 'expected' ? expectedFees : parseFloat(customTarget) || 0;
    
    const { error } = await supabase
      .from('schools')
      .update({ monthly_target: newTarget })
      .eq('id', schoolId);
    
    setLoading(false);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to update target",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Monthly target updated successfully"
      });
      onTargetUpdated();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Monthly Target</DialogTitle>
          <DialogDescription>
            Choose how you want to set your monthly collection target.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <RadioGroup value={targetType} onValueChange={(value) => setTargetType(value as 'custom' | 'expected')}>
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setTargetType('custom')}>
              <RadioGroupItem value="custom" id="custom" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="custom" className="font-medium cursor-pointer">Set Custom Target</Label>
                <p className="text-sm text-muted-foreground">Enter your own monthly collection target</p>
                {targetType === 'custom' && (
                  <div className="mt-3">
                    <Input
                      type="number"
                      placeholder="Enter target amount"
                      value={customTarget}
                      onChange={(e) => setCustomTarget(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setTargetType('expected')}>
              <RadioGroupItem value="expected" id="expected" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="expected" className="font-medium cursor-pointer">Use Expected Fees</Label>
                <p className="text-sm text-muted-foreground">
                  Set target to total expected fees: <span className="font-semibold text-foreground">{formatCurrency(expectedFees)}</span>
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Target"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TargetSettingDialog;
