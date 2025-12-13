{ useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSubscription } from "@/hooks/useSubscription";

interface Student {
  id: string;
  admission_no: string; // stored as `${schoolId}-${admissionNo}`
  full_name: string;
  class_id: string | null;
  parent_contact: string | null;
  parent_name: string | null;
  total_fee: number;
  class_name?: string;
}

interface FeeStructure {
  id: string;
  class_name: string;
  fee_amount: number;
}

const ITEMS_PER_PAGE = 20;

const Students = () => {
  const { schoolId } = useSchoolId();
  const { subscription } = useSubscription();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    admission_no: "", // user-facing admission number ONLY
    full_name: "",
    parent_name: "",
    class_id: "",
    parent_contact: "",
  });

  useEffect(() => {
    if (schoolId) {
      fetchStudents();
      fetchFeeStructures();
    }
  }, [schoolId]);

  const fetchFeeStructures = async () => {
    if (!schoolId) return;

    const { data, error } = await supabase
      .from("fee_structures")
      .select("*")
      .eq("school_id", schoolId)
      .order("class_name");

    if (!error && data) setFeeStructures(data);
  };

  const fetchStudents = async () => {
    if (!schoolId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select(`*, fee_structures (class_name)`)
      .eq("school_id", schoolId)
      .order("admission_no");

    if (!error && data) {
      const formatted = data.map((s: any) => ({
        ...s,
        class_name: s.fee_structures?.class_name || "N/A",
      }));
      setStudents(formatted);
    }
    setLoading(false);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingStudent(null);
    setFormData({
      admission_no: "",
      full_name: "",
      parent_name: "",
      class_id: "",
      parent_contact: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schoolId) {
      toast({ title: "Error", description: "School ID not found", variant: "destructive" });
      return;
    }

    if (!formData.admission_no.trim() || !formData.full_name.trim()) {
      toast({ title: "Error", description: "Admission number and full name are required", variant: "destructive" });
      return;
    }

    // Subscription limit check (only when creating)
    if (!editingStudent && subscription) {
      if (students.length >= subscription.maxStudents) {
        toast({
          title: "Subscription Limit Reached",
          description: `You have reached the maximum number of students (${subscription.maxStudents}).`,
          variant: "destructive",
        });
        return;
      }
    }

    // Compose unique admission number per school
    const uniqueAdmissionNo = `${schoolId}-${formData.admission_no.trim()}`;

    if (editingStudent) {
      const { error } = await supabase
        .from("students")
        .update({
          admission_no: uniqueAdmissionNo,
          full_name: formData.full_name.trim(),
          parent_name: formData.parent_name || null,
          class_id: formData.class_id || null,
          parent_contact: formData.parent_contact || null,
        })
        .eq("id", editingStudent.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Student updated successfully" });
        fetchStudents();
        closeDialog();
      }
    } else {
      const { error } = await supabase
        .from("students")
        .insert([
          {
            admission_no: uniqueAdmissionNo,
            full_name: formData.full_name.trim(),
            parent_name: formData.parent_name || null,
            class_id: formData.class_id || null,
            parent_contact: formData.parent_contact || null,
            school_id: schoolId,
          },
        ]);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Student added successfully" });
        fetchStudents();
        closeDialog();
      }
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      admission_no: student.admission_no.includes("-")
        ? student.admission_no.split("-").slice(1).join("-")
        : student.admission_no,
      full_name: student.full_name,
      parent_name: student.parent_name || "",
      class_id: student.class_id || "",
      parent_contact: student.parent_contact || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student?")) return;

    const { error } = await supabase.from("students").delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Student deleted successfully" });
      fetchStudents();
    }
  };

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admission_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.parent_name && s.parent_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Students Management</h1>
          <p className="text-muted-foreground">Manage student records and enrollment</p>
          {subscription && (
            <p className="text-sm text-muted-foreground mt-1">
              {students.length} / {subscription.maxStudents} students
            </p>
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingStudent(null)}>
              <Plus className="h-4 w-4 mr-2" /> Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStudent ? "Edit Student" : "Add New Student"}</DialogTitle>
              <DialogDescription>
                {editingStudent ? "Update student information" : "Enter student details"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Admission Number *</Label>
                  <Input value={formData.admission_no} onChange={(e) => setFormData({ ...formData, admission_no: e.target.value })} required />
                </div>

                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                </div>

                <div className="space-y-2">
                  <Label>Parent Name</Label>
                  <Input value={formData.parent_name} onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={formData.class_id} onValueChange={(v) => setFormData({ ...formData, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                    <SelectContent>
                      {feeStructures.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.class_name} - {formatCurrency(f.fee_amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Parent Contact</Label>
                  <Input value={formData.parent_contact} onChange={(e) => setFormData({ ...formData, parent_contact: e.target.value })} />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button type="submit">{editingStudent ? "Update" : "Add"} Student</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
          <CardDescription>View and manage all registered students</CardDescription>
          <div className="pt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Search by name, admission number, or parent name" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading students...</p>
          ) : filteredStudents.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No students found</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Total Fee</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.admission_no.includes("-") ? s.admission_no.split("-").slice(1).join("-") : s.admission_no}
                        </TableCell>
                        <TableCell>{s.full_name}</TableCell>
                        <TableCell>{s.parent_name || "N/A"}</TableCell>
                        <TableCell>{s.class_name}</TableCell>
                        <TableCell>{formatCurrency(s.total_fee)}</TableCell>
                        <TableCell>{s.parent_contact || "N/A"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(s)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                    <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next <ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Students;
