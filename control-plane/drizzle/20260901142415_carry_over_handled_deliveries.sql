-- Deliveries are kept as they arrived now, and worked afterwards. What was
-- already acted on is carried over as done, so a host redelivering an old
-- word still changes nothing. GitHub was the only source there was, and the
-- bodies are gone: only the fact of having handled them is worth keeping.
INSERT INTO "inbound_delivery" ("source", "id", "headers", "body", "state", "handled_at", "received_at")
SELECT 'github', "id", '{}'::jsonb, '{}'::jsonb, 'done', "handled_at", "handled_at"
FROM "handled_delivery"
ON CONFLICT DO NOTHING;
