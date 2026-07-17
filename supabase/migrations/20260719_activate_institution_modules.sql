-- Institution subscriptions include every SphereSDS module.
-- Keep provisioned modules aligned with the plan so upgrading cannot leave
-- an institution restricted to the free Engage-only module set.
UPDATE institutions
SET modules = '["engage", "assess", "learn", "train"]'::jsonb
WHERE subscription_plan = 'institution';
