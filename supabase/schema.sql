-- Phase 2: Supabase Foundation Schema

-- 1. Create admin_users table
-- This table maps to the built-in auth.users table and stores admin-specific profile data.
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Only authenticated users who are themselves admins can read the admin_users table.
-- Note: Service Role key (used in backend API routes) will automatically bypass RLS.
CREATE POLICY "Admins can view admin_users"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING (auth.uid() IN (SELECT id FROM public.admin_users));

-- 4. Initial Trigger for Auto-Admin (Optional / For testing)
-- In a real production scenario, you might want a secure way to add the first admin,
-- or manually add the first admin's UUID to this table from the Supabase SQL editor.
