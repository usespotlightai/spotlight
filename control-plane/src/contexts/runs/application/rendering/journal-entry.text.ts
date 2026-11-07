import type {
  ControlPlaneFacts,
  UnreadableFacts,
} from '@runs/application/ports/run-journal.port';

export const controlPlaneEntryText = (
  facts: ControlPlaneFacts | UnreadableFacts,
): string => {
  switch (facts.type) {
    case 'hook.called':
      return `Hook ${facts.call.hook} · ${facts.call.step} → ${facts.call.target}`;
    case 'provision.failed':
      return `Provisioning failed · ${facts.failure}`;
    case 'run.paused':
      return facts.resumesAtOnce
        ? 'Messages came in during the turn. The run starts again to read them.'
        : 'Waiting for a person';
    case 'unreadable':
      return `Unreadable journal entry · ${facts.entryType}`;
  }
};
