import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskNote } from '@work/domain/entities/task-note.entity';

export const feedbackAfter = (
  notes: readonly TaskNote[],
  run: RunId,
): readonly string[] => {
  const last = notes.reduce(
    (found, note, at) => (note.voice.run?.equals(run) ? at : found),
    -1,
  );

  if (last < 0) {
    return [];
  }

  const after = notes.slice(last + 1);
  const next = after.findIndex(
    (note) => note.voice.run !== null && !note.voice.run.equals(run),
  );

  return (next < 0 ? after : after.slice(0, next))
    .filter((note) => note.voice.isPerson && note.form === 'words')
    .map((note) => note.body.value.trim())
    .filter((body) => body.length > 0);
};
