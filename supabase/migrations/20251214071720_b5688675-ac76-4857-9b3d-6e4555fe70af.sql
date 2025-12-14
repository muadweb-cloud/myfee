-- Drop the existing unique constraint on admission_no alone
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_admission_no_key;

-- Create a unique constraint for admission_no within each school
-- This allows different schools to use the same admission numbers like "001"
CREATE UNIQUE INDEX IF NOT EXISTS students_admission_no_school_unique 
ON public.students (school_id, admission_no);