import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface Payment {
  id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
  notes: string | null;
  student_name?: string;
}

interface Student {
  id: string;
  admission_no: string;
  full_name: string;
  total_fee: number;
}

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [totalPaid, setTotalPaid] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    student_id: "",
    amount: "",
    payment_method: "Cash",
    notes: "",
  });

  useEffect(() => {
    fetchPayments();
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("full_name");

    if (!error && data) {
      setStudents(data);
    }
  };

  const fetchPayments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select(`
        *,
        students (full_name)
      `)
      .order("payment_date", { ascending: false });

    if (!error && data) {
      const formattedData = data.map((payment: any) => ({
        ...payment,
        student_name: payment.students?.full_name || "N/A",
      }));
      setPayments(formattedData);
    }
    setLoading(false);
  };

  const handleStudentChange = async (studentId: string) => {
    setFormData({ ...formData, student_id: studentId });
    
    const student = students.find(s => s.id === studentId);
    setSelectedStudent(student || null);

    if (student) {
      // Fetch total paid by this student
      const { data } = await supabase
        .from("payments")
        .select("amount")
        .eq("student_id", studentId);

      const total = data?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
      setTotalPaid(total);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.student_id || !formData.amount) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("payments")
      .insert([{
        student_id: formData.student_id,
        amount: amount,
        payment_method: formData.payment_method,
        notes: formData.notes || null,
      }]);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ 
        title: "Success", 
        description: "Payment recorded successfully",
      });
      fetchPayments();
      closeDialog();
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedStudent(null);
    setTotalPaid(0);
    setFormData({
      student_id: "",
      amount: "",
      payment_method: "Cash",
      notes: "",
    });
  };

  const filteredPayments = payments.filter((payment) =>
    payment.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.receipt_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payment Management</h1>
          <p className="text-muted-foreground">Record and track student fee payments</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
              <DialogDescription>
                Enter payment details for a student
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="student_id">Student *</Label>
                  <Select value={formData.student_id} onValueChange={handleStudentChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.admission_no} - {student.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedStudent && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Fee:</span>
                          <span className="font-semibold">{formatCurrency(selectedStudent.total_fee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Already Paid:</span>
                          <span className="font-semibold text-success">{formatCurrency(totalPaid)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-muted-foreground">Balance:</span>
                          <span className="font-semibold text-warning">{formatCurrency(selectedStudent.total_fee - totalPaid)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_method">Payment Method</Label>
                  <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Optional payment notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  Record Payment
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>All recorded payments</CardDescription>
          <div className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name or receipt number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading payments...</p>
          ) : filteredPayments.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No payments recorded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt No</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        {payment.receipt_number}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{payment.student_name}</TableCell>
                    <TableCell className="text-success font-semibold">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{payment.payment_method}</TableCell>
                    <TableCell>{formatDate(payment.payment_date)}</TableCell>
                    <TableCell className="max-w-xs truncate">{payment.notes || "—"}</TableCell>
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

export default Payments;
