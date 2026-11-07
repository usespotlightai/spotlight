import type {
  ControlPlaneFacts,
  UnreadableFacts,
} from '@runs/application/ports/run-journal.port';
import {
  HOOK_CALLED,
  PROVISION_FAILED,
  RUN_PAUSED,
} from '@runs/domain/value-objects/journal-entry-type';

export const controlPlaneEntryText = (
  facts: ControlPlaneFacts | UnreadableFacts,
): string => {
  switch (facts.type) {
    case HOOK_CALLED:
      return `Hook ${facts.call.hook} · ${facts.call.step} → ${facts.call.target}`;
    case PROVISION_FAILED:
      return `Provisioning failed · ${facts.failure}`;
    case RUN_PAUSED:
      return facts.resumesAtOnce
        ? 'Messages came in during the turn. The run starts again to read them.'
        : 'Waiting for a person';
    case 'unreadable':
      return `Unreadable journal entry · ${facts.entryType}`;
  }
};
