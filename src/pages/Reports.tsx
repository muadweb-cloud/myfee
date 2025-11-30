import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

interface StudentBalance {
  id: string;
  admission_no: string;
  full_name: string;
  class_name: string;
  total_fee: number;
  total_paid: number;
  balance: number;
}

const Reports = () => {
  const [studentsWithBalance, setStudentsWithBalance] = useState<StudentBalance[]>([]);
  const [fullyPaidStudents, setFullyPaidStudents] = useState<StudentBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    
    // Fetch all students with their classes
    const { data: students } = await supabase
      .from("students")
      .select(`
        id,
        admission_no,
        full_name,
        total_fee,
        fee_structures (class_name)
      `)
      .order("full_name");

    if (students) {
      // Fetch all payments
      const { data: payments } = await supabase
        .from("payments")
        .select("student_id, amount");

      // Calculate totals for each student
      const studentBalances: StudentBalance[] = students.map((student: any) => {
        const studentPayments = payments?.filter(p => p.student_id === student.id) || [];
        const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const balance = Number(student.total_fee) - totalPaid;

        return {
          id: student.id,
          admission_no: student.admission_no,
          full_name: student.full_name,
          class_name: student.fee_structures?.class_name || "N/A",
          total_fee: Number(student.total_fee),
          total_paid: totalPaid,
          balance: balance,
        };
      });

      // Split into balance and fully paid
      setStudentsWithBalance(studentBalances.filter(s => s.balance > 0));
      setFullyPaidStudents(studentBalances.filter(s => s.balance <= 0));
    }

    setLoading(false);
  };

  const exportToCSV = (data: StudentBalance[], filename: string) => {
    const headers = ["Admission No", "Name", "Class", "Total Fee", "Paid", "Balance"];
    const rows = data.map(student => [
      student.admission_no,
      student.full_name,
      student.class_name,
      student.total_fee.toFixed(2),
      student.total_paid.toFixed(2),
      student.balance.toFixed(2),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Report exported successfully",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate and export financial reports</p>
      </div>

      <Tabs defaultValue="balance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="balance">Students with Balance</TabsTrigger>
          <TabsTrigger value="paid">Fully Paid Students</TabsTrigger>
        </TabsList>

        <TabsContent value="balance">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Students with Outstanding Balance</CardTitle>
                  <CardDescription>Students who still owe fees</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(studentsWithBalance, "students-with-balance")}
                  disabled={studentsWithBalance.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {studentsWithBalance.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">All students have paid their fees! 🎉</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Total Fee</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsWithBalance.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.admission_no}</TableCell>
                        <TableCell>{student.full_name}</TableCell>
                        <TableCell>{student.class_name}</TableCell>
                        <TableCell>{formatCurrency(student.total_fee)}</TableCell>
                        <TableCell className="text-success">{formatCurrency(student.total_paid)}</TableCell>
                        <TableCell className="font-semibold text-warning">{formatCurrency(student.balance)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      <TableCell>{formatCurrency(studentsWithBalance.reduce((sum, s) => sum + s.total_fee, 0))}</TableCell>
                      <TableCell className="text-success">{formatCurrency(studentsWithBalance.reduce((sum, s) => sum + s.total_paid, 0))}</TableCell>
                      <TableCell className="text-warning">{formatCurrency(studentsWithBalance.reduce((sum, s) => sum + s.balance, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paid">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Fully Paid Students</CardTitle>
                  <CardDescription>Students who have completed their fee payments</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(fullyPaidStudents, "fully-paid-students")}
                  disabled={fullyPaidStudents.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {fullyPaidStudents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No fully paid students yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Total Fee</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fullyPaidStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.admission_no}</TableCell>
                        <TableCell>{student.full_name}</TableCell>
                        <TableCell>{student.class_name}</TableCell>
                        <TableCell>{formatCurrency(student.total_fee)}</TableCell>
                        <TableCell className="text-success font-semibold">{formatCurrency(student.total_paid)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                            Paid in Full
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
