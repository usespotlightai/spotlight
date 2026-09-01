-- A reaction belongs to the line now, not to the station that waited for it.
-- Each station that waited becomes a rule sending the word there from
-- wherever the task stands, which is how the line already behaved.
INSERT INTO "assembly_line_reaction" ("assembly_line_id", "happening", "from_station_id", "to_station_id")
SELECT "station"."assembly_line_id", "station_reaction"."happening", NULL, "station_reaction"."station_id"
FROM "station_reaction"
JOIN "station" ON "station"."id" = "station_reaction"."station_id";
