export const threadAt = <T extends { runId: string | null; stationId: string }>(
  notes: readonly T[],
  stationId: string | null,
  runId: string,
): T[] =>
  notes.filter(
    (note) =>
      note.runId === runId ||
      (stationId !== null && note.stationId === stationId),
  );
