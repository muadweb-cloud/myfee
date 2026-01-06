import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Receipt, Pencil, Download, FileText, FileSpreadsheet, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useOfflineData } from "@/contexts/OfflineDataContext";

const Payments = () => {
  const { students, payments, feeStructures, loading, addPayment, updatePayment, pendingOpsCount, isOnline } = useOfflineData();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [filteredStudents, setFilteredStudents] = useState<typeof students>([]);
  const [selectedStudent, setSelectedStudent] = useState<typeof students[0] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<typeof payments[0] | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    student_id: "",
    amount: "",
    payment_method: "Cash",
    notes: "",
  });

  const [editFormData, setEditFormData] = useState({
    amount: "",
    payment_method: "Cash",
    notes: "",
  });

  // Calculate total paid for selected student
  const totalPaid = useMemo(() => {
    if (!selectedStudent) return 0;
    return payments
      .filter((p) => p.student_id === selectedStudent.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments, selectedStudent]);

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setFormData({ ...formData, student_id: "" });
    setSelectedStudent(null);
    const studentsInClass = students.filter((s) => s.class_id === classId);
    setFilteredStudents(studentsInClass);
  };

  const handleStudentChange = (studentId: string) => {
    setFormData({ ...formData, student_id: studentId });
    const student = students.find((s) => s.id === studentId);
    setSelectedStudent(student || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.student_id || !formData.amount) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    try {
      await addPayment({
        student_id: formData.student_id,
        amount,
        payment_method: formData.payment_method,
        notes: formData.notes || null,
      });
      toast({ title: isOnline ? "Success" : "Saved offline", description: isOnline ? "Payment recorded successfully" : "Payment will sync when internet returns." });
      closeDialog();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedStudent(null);
    setSelectedClass("");
    setFilteredStudents([]);
    setFormData({
      student_id: "",
      amount: "",
      payment_method: "Cash",
      notes: "",
    });
  };

  const openEditDialog = (payment: typeof payments[0]) => {
    setEditingPayment(payment);
    setEditFormData({
      amount: payment.amount.toString(),
      payment_method: payment.payment_method,
      notes: payment.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingPayment(null);
    setEditFormData({
      amount: "",
      payment_method: "Cash",
      notes: "",
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingPayment) return;

    const amount = parseFloat(editFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    try {
      await updatePayment(editingPayment.id, {
        amount,
        payment_method: editFormData.payment_method,
        notes: editFormData.notes || null,
      });
      toast({ title: isOnline ? "Success" : "Saved offline", description: isOnline ? "Payment updated successfully" : "Update will sync when internet returns." });
      closeEditDialog();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredPayments = payments.filter((payment) =>
    payment.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.receipt_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadCSV = () => {
    const headers = ['Receipt No', 'Student Name', 'Amount', 'Payment Method', 'Date', 'Notes'];
    const csvData = filteredPayments.map(payment => [
      payment.receipt_number,
      payment.student_name,
      payment.amount.toString(),
      payment.payment_method,
      formatDate(payment.payment_date),
      payment.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payments_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast({ title: "Success", description: "Payments exported to CSV successfully" });
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Payment History Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    const tableData = filteredPayments.map(payment => [
      payment.receipt_number,
      payment.student_name || 'N/A',
      formatCurrency(payment.amount),
      payment.payment_method,
      formatDate(payment.payment_date),
      payment.notes || '-'
    ]);

    autoTable(doc, {
      head: [['Receipt No', 'Student', 'Amount', 'Method', 'Date', 'Notes']],
      body: tableData,
      startY: 38,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`payments_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({ title: "Success", description: "Payments exported to PDF successfully" });
  };

  return (
    <div className="space-y-6">
      {/* Offline indicator */}
      {(!isOnline || pendingOpsCount > 0) && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {!isOnline ? "You're offline. " : ""}
                {pendingOpsCount > 0 ? `${pendingOpsCount} change${pendingOpsCount > 1 ? 's' : ''} pending sync.` : "Data shown from cache."}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payment Management</h1>
          <p className="text-muted-foreground">Record and track student fee payments</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={downloadCSV}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Download as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Download as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record New Payment</DialogTitle>
                <DialogDescription>Enter payment details for a student</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="class">Select Class *</Label>
                    <Select value={selectedClass} onValueChange={handleClassChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a class first" />
                      </SelectTrigger>
                      <SelectContent>
                        {feeStructures.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.class_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student_id">Student *</Label>
                    <Select
                      value={formData.student_id}
                      onValueChange={handleStudentChange}
                      disabled={!selectedClass}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedClass ? "Select a student" : "Select a class first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.full_name} ({student.admission_no})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedStudent && (
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Total Fee:</p>
                            <p className="font-semibold">{formatCurrency(selectedStudent.total_fee)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Paid:</p>
                            <p className="font-semibold text-green-600">{formatCurrency(totalPaid)}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Balance:</p>
                            <p className={`font-semibold ${selectedStudent.total_fee - totalPaid > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(selectedStudent.total_fee - totalPaid)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (Ksh) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Payment Method</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                        <SelectItem value="Check">Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Optional notes"
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
                    <Receipt className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Payment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>Update payment details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit_amount">Amount (Ksh) *</Label>
                <Input
                  id="edit_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_payment_method">Payment Method</Label>
                <Select
                  value={editFormData.payment_method}
                  onValueChange={(value) => setEditFormData({ ...editFormData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_notes">Notes</Label>
                <Textarea
                  id="edit_notes"
                  placeholder="Optional notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditDialog}>
                Cancel
              </Button>
              <Button type="submit">Update Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>View all recorded payments</CardDescription>
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
            <p className="text-center py-8 text-muted-foreground">No payments found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt No</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-xs">{payment.receipt_number}</TableCell>
                      <TableCell className="font-medium">{payment.student_name}</TableCell>
                      <TableCell className="text-green-600 font-semibold">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>{payment.payment_method}</TableCell>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{payment.notes || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(payment)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Payments;
