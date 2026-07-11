-- =====================================================================
-- Enable Row Level Security across all public tables + least-privilege
-- policies. Closes the Supabase linter errors (rls_disabled_in_public,
-- policy_exists_rls_disabled, sensitive_columns_exposed).
--
-- READ THIS BEFORE APPLYING:
--   * The app talks to the DB three ways:
--       1. Service-role client (getSupabaseAdmin) for server routes,
--          payments, plan seeding, AI, inquiries. Service role BYPASSES
--          RLS, so those server mutations keep working untouched.
--       2. Anon browser client with a logged-in Supabase Auth JWT
--          (auth.uid() resolves) for teacher/student/admin actions.
--       3. Anon browser client with NO JWT for guests (public pricing,
--          marketplace browse, certificate verify, guest exam/quiz taking).
--   * Policies below are written to preserve every current flow, including
--     the two that a naive policy would break: a creator reading purchases
--     of THEIR listings, and a teacher enrolling OTHER students.
--
-- ROLLOUT: apply on a Supabase branch / staging DB first, run the test
-- checklist at the bottom for each role (guest, student, teacher, creator,
-- institution owner, staff), then promote. Rollback snippet at the very end.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read users/members
-- without recursively triggering RLS).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_sphere_staff FROM users WHERE id = auth.uid()), false);
$$;

-- auth.uid() is an owner/admin/teacher of the institution (can manage content).
CREATE OR REPLACE FUNCTION public.manages_institution(inst uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM institution_members m
    WHERE m.institution_id = inst
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.member_role IN ('owner', 'admin', 'teacher')
  );
$$;

-- auth.uid() is any active member of the institution (can view its content).
CREATE OR REPLACE FUNCTION public.in_institution(inst uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM institution_members m
    WHERE m.institution_id = inst
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  );
$$;

-- auth.uid() shares at least one institution with the target user
-- (so teachers can see student names on rosters, and vice versa).
CREATE OR REPLACE FUNCTION public.shares_institution(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM institution_members me
    JOIN institution_members them ON them.institution_id = me.institution_id
    WHERE me.user_id = auth.uid() AND me.status = 'active'
      AND them.user_id = target AND them.status = 'active'
  );
$$;

-- =====================================================================
-- TIER 1 — PUBLIC REFERENCE DATA
-- Anyone may read (pricing page, onboarding, guest TTL). Only staff
-- writes from the browser; server seeding uses the service role.
-- =====================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['subscription_plans','institution_types','add_ons','platform_settings']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_read_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true);', t||'_read_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_staff_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());', t||'_staff_write', t);
  END LOOP;
END $$;

-- =====================================================================
-- TIER 2 — PUBLIC DISCOVERY (marketplace + certificate verify)
-- =====================================================================

-- marketplace_listings: approved listings are public; owners see/edit
-- their own; staff manage all.
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_listings_select ON public.marketplace_listings;
CREATE POLICY marketplace_listings_select ON public.marketplace_listings
  FOR SELECT TO anon, authenticated
  USING (status = 'approved' OR creator_id = auth.uid() OR public.is_staff());
DROP POLICY IF EXISTS marketplace_listings_insert ON public.marketplace_listings;
CREATE POLICY marketplace_listings_insert ON public.marketplace_listings
  FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
DROP POLICY IF EXISTS marketplace_listings_update_own ON public.marketplace_listings;
CREATE POLICY marketplace_listings_update_own ON public.marketplace_listings
  FOR UPDATE TO authenticated USING (creator_id = auth.uid() OR public.is_staff())
  WITH CHECK (creator_id = auth.uid() OR public.is_staff());
DROP POLICY IF EXISTS marketplace_listings_delete_own ON public.marketplace_listings;
CREATE POLICY marketplace_listings_delete_own ON public.marketplace_listings
  FOR DELETE TO authenticated USING (creator_id = auth.uid() OR public.is_staff());

-- creator_profiles: public storefronts (name/slug/bio are meant to be seen).
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS creator_profiles_select ON public.creator_profiles;
CREATE POLICY creator_profiles_select ON public.creator_profiles
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS creator_profiles_write_own ON public.creator_profiles;
CREATE POLICY creator_profiles_write_own ON public.creator_profiles
  FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

-- marketplace_reviews: public read; reviewer writes their own.
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_reviews_select ON public.marketplace_reviews;
CREATE POLICY marketplace_reviews_select ON public.marketplace_reviews
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS marketplace_reviews_write_own ON public.marketplace_reviews;
CREATE POLICY marketplace_reviews_write_own ON public.marketplace_reviews
  FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

-- issued_certificates: verification is public by design (/verify/[code]).
-- The recipient issues their own on completion; issuer/creator or staff too.
ALTER TABLE public.issued_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS issued_certificates_verify ON public.issued_certificates;
CREATE POLICY issued_certificates_verify ON public.issued_certificates
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS issued_certificates_insert ON public.issued_certificates;
CREATE POLICY issued_certificates_insert ON public.issued_certificates
  FOR INSERT TO authenticated
  WITH CHECK (recipient_id = auth.uid() OR issuer_id = auth.uid() OR public.is_staff());
DROP POLICY IF EXISTS issued_certificates_manage ON public.issued_certificates;
CREATE POLICY issued_certificates_manage ON public.issued_certificates
  FOR UPDATE TO authenticated USING (issuer_id = auth.uid() OR public.is_staff())
  WITH CHECK (issuer_id = auth.uid() OR public.is_staff());

-- =====================================================================
-- TIER 3 — TENANT CONTENT (courses, exams, quizzes, paths, guides,
-- notes, documents, rosters). Readable when published, by the creator,
-- or by institution members. Written by the creator or institution
-- managers, or staff. Uses per-table institution_id + creator_id.
-- =====================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['courses','exams','quizzes','learning_paths','guides','notes','documents','rosters']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- Read: published to the world, or creator, or same-institution, or staff.
    -- rosters and learning_paths have no is_published column, so they are
    -- private to their creator / institution (never world-readable).
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_select', t);
    IF t IN ('rosters', 'learning_paths') THEN
      EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated
        USING (creator_id = auth.uid() OR public.in_institution(institution_id) OR public.is_staff());$f$, t||'_select', t);
    ELSE
      EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated
        USING (COALESCE(is_published, false) = true OR creator_id = auth.uid()
               OR public.in_institution(institution_id) OR public.is_staff());$f$, t||'_select', t);
    END IF;

    -- Insert: the creator creates their own (institution set from context).
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_insert', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
      WITH CHECK (creator_id = auth.uid() OR public.is_staff());$f$, t||'_insert', t);

    -- Update / delete: creator, institution manager, or staff.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_modify', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
      USING (creator_id = auth.uid() OR public.manages_institution(institution_id) OR public.is_staff())
      WITH CHECK (creator_id = auth.uid() OR public.manages_institution(institution_id) OR public.is_staff());$f$, t||'_modify', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_delete', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
      USING (creator_id = auth.uid() OR public.manages_institution(institution_id) OR public.is_staff());$f$, t||'_delete', t);
  END LOOP;
END $$;

-- =====================================================================
-- TIER 4 — ENROLLMENT & MEMBERSHIP
-- A teacher enrolls OTHER students, so INSERT cannot be self-only.
-- =====================================================================

-- enrollments (course): student sees own; course owner/institution sees all.
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enrollments_select ON public.enrollments;
CREATE POLICY enrollments_select ON public.enrollments
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() OR public.is_staff()
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id
               AND (c.creator_id = auth.uid() OR public.manages_institution(c.institution_id)))
  );
DROP POLICY IF EXISTS enrollments_write ON public.enrollments;
CREATE POLICY enrollments_write ON public.enrollments
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid() OR public.is_staff()
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id
               AND (c.creator_id = auth.uid() OR public.manages_institution(c.institution_id)))
  )
  WITH CHECK (
    student_id = auth.uid() OR public.is_staff()
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id
               AND (c.creator_id = auth.uid() OR public.manages_institution(c.institution_id)))
  );

-- path_enrollments: same shape against learning_paths (uses employee_id).
ALTER TABLE public.path_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS path_enrollments_rw ON public.path_enrollments;
CREATE POLICY path_enrollments_rw ON public.path_enrollments
  FOR ALL TO authenticated
  USING (
    employee_id = auth.uid() OR public.is_staff()
    OR EXISTS (SELECT 1 FROM learning_paths p WHERE p.id = path_enrollments.path_id
               AND (p.creator_id = auth.uid() OR public.manages_institution(p.institution_id)))
  )
  WITH CHECK (
    employee_id = auth.uid() OR public.is_staff()
    OR EXISTS (SELECT 1 FROM learning_paths p WHERE p.id = path_enrollments.path_id
               AND (p.creator_id = auth.uid() OR public.manages_institution(p.institution_id)))
  );

-- roster_members: self can join/leave; roster owner or institution manages.
ALTER TABLE public.roster_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roster_members_rw ON public.roster_members;
CREATE POLICY roster_members_rw ON public.roster_members
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR public.is_staff()
    OR EXISTS (SELECT 1 FROM rosters r WHERE r.id = roster_members.roster_id
               AND (r.creator_id = auth.uid() OR public.manages_institution(r.institution_id)))
  )
  WITH CHECK (
    user_id = auth.uid() OR public.is_staff()
    OR EXISTS (SELECT 1 FROM rosters r WHERE r.id = roster_members.roster_id
               AND (r.creator_id = auth.uid() OR public.manages_institution(r.institution_id)))
  );

-- institution_members: members read their institutions; managers write.
ALTER TABLE public.institution_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS institution_members_select ON public.institution_members;
CREATE POLICY institution_members_select ON public.institution_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.in_institution(institution_id) OR public.is_staff());
DROP POLICY IF EXISTS institution_members_write ON public.institution_members;
CREATE POLICY institution_members_write ON public.institution_members
  FOR ALL TO authenticated
  USING (public.manages_institution(institution_id) OR public.is_staff() OR user_id = auth.uid())
  WITH CHECK (public.manages_institution(institution_id) OR public.is_staff() OR user_id = auth.uid());

-- institutions: members read; owner creates; managers/staff update.
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS institutions_select ON public.institutions;
CREATE POLICY institutions_select ON public.institutions
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.in_institution(id) OR public.is_staff());
DROP POLICY IF EXISTS institutions_insert ON public.institutions;
CREATE POLICY institutions_insert ON public.institutions
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid() OR public.is_staff());
DROP POLICY IF EXISTS institutions_update ON public.institutions;
CREATE POLICY institutions_update ON public.institutions
  FOR UPDATE TO authenticated USING (public.manages_institution(id) OR public.is_staff())
  WITH CHECK (public.manages_institution(id) OR public.is_staff());

-- =====================================================================
-- TIER 5 — SENSITIVE: PII, FINANCIAL, SUBSCRIPTION
-- Owner + staff only. Server mutations use the service role (bypasses RLS).
-- =====================================================================

-- users: self, institution mates (name display), active creators
-- (public storefront names), or staff. RLS is row-level, not column-level,
-- so tightening which columns are public is a later app-layer step.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
  FOR SELECT TO anon, authenticated
  USING (
    id = auth.uid() OR public.is_staff() OR public.shares_institution(id)
    OR EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.user_id = users.id)
  );
DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_staff())
  WITH CHECK (id = auth.uid() OR public.is_staff());
-- Signup inserts the users row from the browser (app/signup/page.tsx) right
-- after auth.signUp. This works only if a session exists immediately, i.e.
-- email confirmation is OFF (autoconfirm). If you turn email confirmation ON,
-- auth.uid() is null at that moment and this INSERT is blocked — move the
-- users/user_subscriptions/creation_usage seeding into a service-role server
-- route instead. With autoconfirm on, the check below passes.
DROP POLICY IF EXISTS users_insert_self ON public.users;
CREATE POLICY users_insert_self ON public.users
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Simple "owner via user_id, plus staff" tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_subscriptions','user_add_ons','creation_usage']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_owner', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (user_id = auth.uid() OR public.is_staff())
      WITH CHECK (user_id = auth.uid() OR public.is_staff());$f$, t||'_owner', t);
  END LOOP;
END $$;

-- marketplace_purchases: buyer sees own; CREATOR sees purchases of their
-- listings (the earnings dashboard); staff sees all. Writes: service role.
ALTER TABLE public.marketplace_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_purchases_select_own ON public.marketplace_purchases;
CREATE POLICY marketplace_purchases_select_own ON public.marketplace_purchases
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid() OR public.is_staff()
    OR EXISTS (SELECT 1 FROM marketplace_listings l
               WHERE l.id = marketplace_purchases.listing_id AND l.creator_id = auth.uid())
  );

-- marketplace_payout_requests: creator sees/creates own; staff manages.
ALTER TABLE public.marketplace_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payout_requests_owner ON public.marketplace_payout_requests;
CREATE POLICY payout_requests_owner ON public.marketplace_payout_requests
  FOR ALL TO authenticated
  USING (creator_id = auth.uid() OR public.is_staff())
  WITH CHECK (creator_id = auth.uid() OR public.is_staff());

-- assist_requests: creator sees/creates own; staff manages.
ALTER TABLE public.assist_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assist_requests_owner ON public.assist_requests;
CREATE POLICY assist_requests_owner ON public.assist_requests
  FOR ALL TO authenticated
  USING (creator_id = auth.uid() OR public.is_staff())
  WITH CHECK (creator_id = auth.uid() OR public.is_staff());

-- cocreation_agreements: creator party or staff.
ALTER TABLE public.cocreation_agreements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cocreation_owner ON public.cocreation_agreements;
CREATE POLICY cocreation_owner ON public.cocreation_agreements
  FOR ALL TO authenticated
  USING (creator_id = auth.uid() OR public.is_staff())
  WITH CHECK (creator_id = auth.uid() OR public.is_staff());

-- certificate_templates / certificate_permissions: owner or staff.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['certificate_templates','certificate_permissions']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_owner', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (owner_id = auth.uid() OR public.is_staff())
      WITH CHECK (owner_id = auth.uid() OR public.is_staff());$f$, t||'_owner', t);
  END LOOP;
END $$;

-- institution_overage_invoices: institution managers + staff.
ALTER TABLE public.institution_overage_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS overage_invoices_rw ON public.institution_overage_invoices;
CREATE POLICY overage_invoices_rw ON public.institution_overage_invoices
  FOR ALL TO authenticated
  USING (public.manages_institution(institution_id) OR public.is_staff())
  WITH CHECK (public.manages_institution(institution_id) OR public.is_staff());

-- institution_plan_inquiries: submitter or institution managers + staff.
-- (Server also writes via service role.)
ALTER TABLE public.institution_plan_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_inquiries_rw ON public.institution_plan_inquiries;
CREATE POLICY plan_inquiries_rw ON public.institution_plan_inquiries
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.manages_institution(institution_id) OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.manages_institution(institution_id) OR public.is_staff());

-- payment_intents: owner or staff (server writes via service role).
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_intents_owner ON public.payment_intents;
CREATE POLICY payment_intents_owner ON public.payment_intents
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

-- user_invites: institution managers, the inviter, or staff.
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_invites_rw ON public.user_invites;
CREATE POLICY user_invites_rw ON public.user_invites
  FOR ALL TO authenticated
  USING (invited_by = auth.uid() OR public.manages_institution(institution_id) OR public.is_staff())
  WITH CHECK (invited_by = auth.uid() OR public.manages_institution(institution_id) OR public.is_staff());

-- marketplace_imports: importer or staff.
ALTER TABLE public.marketplace_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_imports_owner ON public.marketplace_imports;
CREATE POLICY marketplace_imports_owner ON public.marketplace_imports
  FOR ALL TO authenticated
  USING (imported_by = auth.uid() OR public.is_staff())
  WITH CHECK (imported_by = auth.uid() OR public.is_staff());

-- =====================================================================
-- TIER 6 — LIVE SESSIONS & GUEST PARTICIPATION
-- These are taken by UNAUTHENTICATED participants (live quiz players,
-- guest exam takers by code). They must stay open to anon for the flow
-- to work. RLS is enabled (linter satisfied) with permissive policies.
--
-- RESIDUAL RISK: because participants can be anonymous, these rows are
-- broadly readable/insertable. Properly locking them needs a follow-up
-- app change (signed per-session tokens scoping each participant to their
-- own session). Tracked separately — do NOT consider these "hardened".
-- =====================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'engage_sessions','exam_sessions','session_participants','session_responses',
    'pulse_responses','exam_submissions','exam_tickets','guest_sessions','certificates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t||'_participate', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated
      USING (true) WITH CHECK (true);$f$, t||'_participate', t);
  END LOOP;
END $$;

-- =====================================================================
-- ROLLBACK (if a flow breaks in staging, disable per table):
--   ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
-- Or disable everything at once:
--   DO $$ DECLARE r record; BEGIN
--     FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
--       EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', r.tablename);
--     END LOOP; END $$;
--
-- TEST CHECKLIST (run each on the branch DB before promoting):
--   [ ] Guest: take an exam by code, take a live Engage quiz, see results.
--   [ ] Student: log in, see enrolled courses, submit exam, view certificate.
--   [ ] Teacher: create a course/exam, enrol students, view their submissions.
--   [ ] Creator: publish a listing, view My Sales earnings, request payout.
--   [ ] Institution owner: edit institution, manage members, view overage.
--   [ ] Staff: open every /admin page, take down content, approve a listing.
--   [ ] Public: load /pricing and a /m/[id] listing while logged out.
--   [ ] Re-run the Supabase linter — all rls_disabled errors should clear.
-- =====================================================================
