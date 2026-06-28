-- Marketplace demo seed data (matches lib/marketplace-seed.ts)

INSERT INTO marketplace_resources (
  id, title, resource_type, subject, level, description, price_ghs, status,
  import_count, rating_avg, rating_count, metadata, created_at, updated_at
) VALUES
(
  'a1000000-0000-0000-0000-000000000001',
  'Cell division — full unit plan',
  'lesson_plan', 'Biology', 'JHS 2',
  'A complete 5-lesson unit on cell division for JHS 2 Biology. Includes mitosis and meiosis, diagrams, 30 assessment questions, and 2 ready-to-host Engage games.',
  NULL, 'published', 862, 4.90, 142,
  '{"creator_name":"K. Owusu","creator_initials":"KO","verified":true,"featured":true,"accent":"teal","includes":["5 fully scripted lesson plans","30-question assessment bank","2 Engage games (ready to host)","Mark schemes and answer guides"],"stats":{"lessons":5,"estimated_hours":3,"level":"JHS 2"}}'::jsonb,
  now(), now()
),
(
  'a1000000-0000-0000-0000-000000000002',
  'Algebra blitz — 50Q game',
  'engage_game', 'Maths', 'JHS 3',
  'Fast-paced Engage quiz covering linear equations, factorisation, and word problems. Built for revision weeks and end-of-term review.',
  5.00, 'published', 314, 4.70, 89,
  '{"creator_name":"Yaw A.","creator_initials":"YA","verified":true,"featured":true,"accent":"navy","stats":{"questions":50,"estimated_minutes":45}}'::jsonb,
  now(), now()
),
(
  'a1000000-0000-0000-0000-000000000003',
  'New staff onboarding track',
  'train_track', 'Train', 'All staff',
  'Mandatory onboarding path for new teachers and admin staff. Covers policies, safeguarding, and platform setup.',
  NULL, 'published', 421, 4.80, 61,
  '{"creator_name":"EduGhana","creator_initials":"EG","verified":true,"featured":true,"accent":"violet"}'::jsonb,
  now(), now()
),
(
  'a1000000-0000-0000-0000-000000000004',
  'Physics — Waves & Optics question bank',
  'question_bank', 'Physics', 'SHS 1',
  '45 curated questions on waves, reflection, refraction, and lenses. Includes worked solutions for SHS 1 Physics.',
  8.00, 'published', 198, 4.60, 37,
  '{"creator_name":"K. Owusu","creator_initials":"KO","verified":true,"featured":false,"accent":"amber","stats":{"questions":45}}'::jsonb,
  now(), now()
),
(
  'a1000000-0000-0000-0000-000000000005',
  'BECE Math prep — full mock exam set',
  'question_bank', 'Maths', 'BECE',
  'Three full BECE-style maths papers with mark schemes. Aligned to current GES syllabus and past paper patterns.',
  NULL, 'published', 1204, 4.90, 203,
  '{"creator_name":"EduGhana","creator_initials":"EG","verified":true,"featured":false,"accent":"teal","stats":{"exams":3,"questions":120}}'::jsonb,
  now(), now()
),
(
  'a1000000-0000-0000-0000-000000000006',
  'English comprehension pack — JHS 2',
  'lesson_plan', 'English', 'JHS 2',
  'Six reading passages with comprehension questions, vocabulary builders, and short writing prompts for JHS 2 English.',
  NULL, 'published', 556, 4.50, 48,
  '{"creator_name":"Abena M.","creator_initials":"AM","verified":true,"featured":false,"accent":"teal","stats":{"lessons":6,"estimated_hours":4}}'::jsonb,
  now(), now()
),
(
  'a1000000-0000-0000-0000-000000000007',
  'Chemistry — Acids and bases unit',
  'lesson_plan', 'Chemistry', 'SHS 1',
  'Four-lesson SHS 1 unit covering pH, neutralisation, and titration basics with practical lab notes.',
  6.00, 'published', 167, 4.40, 29,
  '{"creator_name":"Dr. Adjei","creator_initials":"DA","verified":true,"featured":false,"accent":"violet","stats":{"lessons":4,"estimated_hours":2.5}}'::jsonb,
  now(), now()
),
(
  'a1000000-0000-0000-0000-000000000008',
  'ICT basics — typing and safety',
  'train_track', 'ICT', 'JHS 1',
  'Introductory ICT training for JHS students covering keyboard skills, online safety, and responsible device use.',
  NULL, 'published', 289, 4.60, 52,
  '{"creator_name":"SphereSDS Team","creator_initials":"SS","verified":true,"featured":false,"accent":"blue"}'::jsonb,
  now(), now()
),
(
  'b1000000-0000-0000-0000-000000000001',
  'Cell division — complete unit plan',
  'lesson_plan', 'Biology', 'JHS 2',
  'A complete 5-lesson unit on cell division for JHS 2 Biology. Includes mitosis and meiosis, diagrams, 30 assessment questions, and 2 ready-to-host Engage games.',
  NULL, 'pending_review', 0, 0, 0,
  '{"creator_name":"K. Owusu","creator_initials":"KO","attachments":["Lesson_plans_unit4.pdf","30Q_assessment_bank"]}'::jsonb,
  now(), now()
),
(
  'b1000000-0000-0000-0000-000000000002',
  'Algebra blitz — 50Q Engage game',
  'engage_game', 'Maths', 'JHS 3',
  'Fast-paced Engage quiz covering linear equations, factorisation, and word problems.',
  5.00, 'pending_review', 0, 0, 0,
  '{"creator_name":"Yaw A.","creator_initials":"YA"}'::jsonb,
  now(), now()
),
(
  'b1000000-0000-0000-0000-000000000003',
  'New staff onboarding train track',
  'train_track', 'Train', 'All staff',
  'Mandatory onboarding path for new teachers and admin staff.',
  NULL, 'pending_review', 0, 0, 0,
  '{"creator_name":"EduGhana","creator_initials":"EG"}'::jsonb,
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO marketplace_reviews (resource_id, rating, body, created_at)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  5,
  'Saved me hours. The Engage games are especially good. Students love them.',
  now()
)
ON CONFLICT DO NOTHING;
