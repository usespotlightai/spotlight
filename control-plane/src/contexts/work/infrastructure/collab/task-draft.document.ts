import type { Doc } from 'yjs';

export const TASK_DRAFT = 'task-draft';

// The web composer reads and writes these same names.
export const draftParts = (doc: Doc) => ({
  meta: doc.getMap<number | string>('meta'),
  writers: doc.getMap<boolean>('writers'),
  attachments: doc.getArray<unknown>('attachments'),
});

export const generationOf = (doc: Doc): number => {
  const generation = draftParts(doc).meta.get('generation');

  return typeof generation === 'number' ? generation : 0;
};
