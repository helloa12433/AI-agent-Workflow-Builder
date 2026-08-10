CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    default_role TEXT DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- update our org_members foreign key
ALTER TABLE public.org_members 
ADD CONSTRAINT org_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.step_runs
ADD CONSTRAINT step_runs_approved_by_fkey
FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
