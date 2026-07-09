-- Enable AI Engage Builder (GHS 100) and price AI Training Builder (GHS 150)
INSERT INTO add_ons (id, name, description, price_ghs, eligible_plans)
VALUES
  ('ai_engagement_builder', 'AI Engagement Builder', 'Generate a full live quiz game from a topic prompt.', 100, ARRAY['creator_quarterly','creator_marketplace','institution']),
  ('ai_training_builder', 'AI Training Builder', 'Generate structured training paths and step content from a brief.', 150, ARRAY['creator_quarterly','creator_marketplace','institution'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_ghs = EXCLUDED.price_ghs,
  eligible_plans = EXCLUDED.eligible_plans;
