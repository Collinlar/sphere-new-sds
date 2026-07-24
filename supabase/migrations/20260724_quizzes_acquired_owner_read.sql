-- Buyers can read quizzes they acquired (personal practice / self-play)
DROP POLICY IF EXISTS quizzes_select_acquired_owner ON public.quizzes;
CREATE POLICY quizzes_select_acquired_owner ON public.quizzes
  FOR SELECT TO authenticated
  USING (
    marketplace_listing_id IS NOT NULL
    AND creator_id = auth.uid()
  );
