-- Create notifications table for in-app messaging
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can insert notifications
CREATE POLICY "Super admins can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Policy: Users can read their own school's notifications
CREATE POLICY "Users can read their school notifications"
ON public.notifications
FOR SELECT
USING (
  school_id = (SELECT school_id FROM public.admin_profiles WHERE id = auth.uid())
);

-- Policy: Users can update (mark as read) their own school's notifications
CREATE POLICY "Users can update their school notifications"
ON public.notifications
FOR UPDATE
USING (
  school_id = (SELECT school_id FROM public.admin_profiles WHERE id = auth.uid())
);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;