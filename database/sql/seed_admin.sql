-- Promote an existing member to admin. The profile row is created on that user's first API call
-- (after sign-up, open the app once). Usage:
--   psql "$DATABASE_URL" -v email='you@example.com' -f database/sql/seed_admin.sql
UPDATE profiles SET role = 'admin' WHERE email = :'email';
SELECT id, email, role FROM profiles WHERE email = :'email';
