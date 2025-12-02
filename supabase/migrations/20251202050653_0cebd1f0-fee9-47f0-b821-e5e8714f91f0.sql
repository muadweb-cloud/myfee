-- Add monthly_target to schools table
ALTER TABLE public.schools ADD COLUMN monthly_target NUMERIC(10, 2) DEFAULT 0;

-- Update billing table to support pending requests
ALTER TABLE public.billing ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));