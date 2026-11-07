export const TASK_DRAFT_DOCUMENT = 'task-draft';

// The web composer reads and writes these same names.
export const TASK_DRAFT_PARTS = {
  meta: 'meta',
  writers: 'writers',
  attachments: 'attachments',
} as const;

export const TASK_DRAFT_META = {
  generation: 'generation',
  sent: 'sent',
} as const;
