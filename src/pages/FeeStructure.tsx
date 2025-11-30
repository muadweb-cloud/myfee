import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface FeeStructure {
  id: string;
  class_name: string;
  fee_amount: number;
  description: string | null;
}

const FeeStructure = () => {
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    class_name: "",
    fee_amount: "",
    description: "",
  });

  useEffect(() => {
    fetchFeeStructures();
  }, []);

  const fetchFeeStructures = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fee_structures")
      .select("*")
      .order("class_name");

    if (!error && data) {
      setFeeStructures(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.class_name || !formData.fee_amount) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    const feeAmount = parseFloat(formData.fee_amount);
    if (isNaN(feeAmount) || feeAmount < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid fee amount",
        variant: "destructive",
      });
      return;
    }

    if (editingStructure) {
      // Update existing structure
      const { error } = await supabase
        .from("fee_structures")
        .update({
          class_name: formData.class_name,
          fee_amount: feeAmount,
          description: formData.description || null,
        })
        .eq("id", editingStructure.id);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: "Fee structure updated successfully" });
        fetchFeeStructures();
        closeDialog();
      }
    } else {
      // Create new structure
      const { error } = await supabase
        .from("fee_structures")
        .insert([{
          class_name: formData.class_name,
          fee_amount: feeAmount,
          description: formData.description || null,
        }]);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: "Fee structure added successfully" });
        fetchFeeStructures();
        closeDialog();
      }
    }
  };

  const handleEdit = (structure: FeeStructure) => {
    setEditingStructure(structure);
    setFormData({
      class_name: structure.class_name,
      fee_amount: structure.fee_amount.toString(),
      description: structure.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fee structure? This will affect students assigned to this class.")) return;

    const { error } = await supabase
      .from("fee_structures")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Fee structure deleted successfully" });
      fetchFeeStructures();
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingStructure(null);
    setFormData({
      class_name: "",
      fee_amount: "",
      description: "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Fee Structure Management</h1>
          <p className="text-muted-foreground">Define classes and their corresponding fee amounts</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingStructure(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Fee Structure
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingStructure ? "Edit Fee Structure" : "Add New Fee Structure"}</DialogTitle>
              <DialogDescription>
                {editingStructure ? "Update fee structure information" : "Create a new class with its fee amount"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="class_name">Class/Grade Name *</Label>
                  <Input
                    id="class_name"
                    placeholder="e.g., Grade 1, Form 4, Year 10"
                    value={formData.class_name}
                    onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fee_amount">Fee Amount ($) *</Label>
                  <Input
                    id="fee_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.fee_amount}
                    onChange={(e) => setFormData({ ...formData, fee_amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description or notes"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingStructure ? "Update" : "Add"} Structure
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fee Structures</CardTitle>
          <CardDescription>All classes and their associated fees</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading fee structures...</p>
          ) : feeStructures.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No fee structures defined yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class/Grade</TableHead>
                  <TableHead>Fee Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeStructures.map((structure) => (
                  <TableRow key={structure.id}>
                    <TableCell className="font-medium">{structure.class_name}</TableCell>
                    <TableCell className="text-primary font-semibold">{formatCurrency(structure.fee_amount)}</TableCell>
                    <TableCell>{structure.description || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(structure)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(structure.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FeeStructure;
