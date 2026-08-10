-- Insert Org A
WITH orga AS (
    INSERT INTO public.organizations (name, usage_calls, usage_limit)
    VALUES ('Org A', 0, 100)
    RETURNING id
),
usera AS (
    INSERT INTO auth.users (email, default_role, locale)
    VALUES ('orga-owner@test.com', 'user', 'en')
    RETURNING id
)
INSERT INTO public.org_members (user_id, org_id, role)
SELECT usera.id, orga.id, 'owner'
FROM usera, orga;

-- Insert Org B
WITH orgb AS (
    INSERT INTO public.organizations (name, usage_calls, usage_limit)
    VALUES ('Org B', 0, 100)
    RETURNING id
),
userb AS (
    INSERT INTO auth.users (email, default_role, locale)
    VALUES ('orgb-owner@test.com', 'user', 'en')
    RETURNING id
)
INSERT INTO public.org_members (user_id, org_id, role)
SELECT userb.id, orgb.id, 'owner'
FROM userb, orgb;
