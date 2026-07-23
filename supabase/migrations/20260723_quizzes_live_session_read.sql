-- Allow players in a live Engage session to read the quiz content.
-- Without this, unpublished quizzes return null on the student join
-- embed and players see a blank "waiting for question" screen.

DROP POLICY IF EXISTS quizzes_select_live_session ON public.quizzes;
CREATE POLICY quizzes_select_live_session ON public.quizzes
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.engage_sessions es
      WHERE es.quiz_id = quizzes.id
        AND es.status IN ('lobby', 'active')
    )
  );
