-- Persist importable content payloads on catalog resources (server-side import without client demo fallback)

UPDATE marketplace_resources
SET metadata = metadata || '{"content":{"modules":[{"id":"m1","title":"Lesson 1 — Cell structure","type":"reading","content":{},"duration_minutes":45},{"id":"m2","title":"Lesson 2 — Mitosis","type":"video","content":{},"duration_minutes":40},{"id":"m3","title":"Lesson 3 — Meiosis","type":"reading","content":{},"duration_minutes":40},{"id":"m4","title":"Lesson 4 — Cell division diseases","type":"reading","content":{},"duration_minutes":35},{"id":"m5","title":"Lesson 5 — Assessment review","type":"quiz","content":{},"duration_minutes":30}],"thumbnail_color":"#1A8966"}}'::jsonb
WHERE id = 'a1000000-0000-0000-0000-000000000001';

UPDATE marketplace_resources
SET metadata = metadata || '{"content":{"modules":[{"id":"e1","title":"Reading: The market day","type":"reading","content":{},"duration_minutes":40},{"id":"e2","title":"Comprehension quiz","type":"quiz","content":{},"duration_minutes":25}],"thumbnail_color":"#1A8966"}}'::jsonb
WHERE id = 'a1000000-0000-0000-0000-000000000006';

UPDATE marketplace_resources
SET metadata = metadata || '{"content":{"modules":[{"id":"c1","title":"Properties of acids and bases","type":"reading","content":{},"duration_minutes":35},{"id":"c2","title":"pH and indicators","type":"video","content":{},"duration_minutes":30}],"thumbnail_color":"#2E2886"}}'::jsonb
WHERE id = 'a1000000-0000-0000-0000-000000000007';

UPDATE marketplace_resources
SET metadata = metadata || '{"content":{"questions":[{"id":"q1","type":"mcq","text":"Sample algebra question","options":[{"label":"A","text":"2"},{"label":"B","text":"4"}],"correct":"A","marks":2}]}}'::jsonb
WHERE id = 'a1000000-0000-0000-0000-000000000002';

UPDATE marketplace_resources
SET metadata = metadata || '{"content":{"questions":[{"id":"bece1","type":"mcq","text":"BECE sample question 1","options":[{"label":"A","text":"2"},{"label":"B","text":"4"}],"correct":"A","marks":1}],"duration_minutes":120,"instructions":"Answer all questions. Show working where required."}}'::jsonb
WHERE id = 'a1000000-0000-0000-0000-000000000005';

UPDATE marketplace_resources
SET metadata = metadata || '{"content":{"questions":[{"id":"pq1","type":"mcq","text":"Waves and optics question 1","options":[{"label":"A","text":"Option A"},{"label":"B","text":"Option B"}],"correct":"A","marks":2}],"duration_minutes":90}}'::jsonb
WHERE id = 'a1000000-0000-0000-0000-000000000004';

UPDATE marketplace_resources
SET metadata = metadata || '{"content":{"steps":[{"id":"s1","title":"Welcome and policies","type":"reading","duration_minutes":15},{"id":"s2","title":"Classroom setup","type":"task","duration_minutes":20}],"category":"Train"}}'::jsonb
WHERE id = 'a1000000-0000-0000-0000-000000000003';

UPDATE marketplace_resources
SET metadata = metadata || '{"content":{"steps":[{"id":"i1","title":"Keyboard basics","type":"reading","duration_minutes":20},{"id":"i2","title":"Online safety","type":"reading","duration_minutes":25}],"category":"ICT"}}'::jsonb
WHERE id = 'a1000000-0000-0000-0000-000000000008';
