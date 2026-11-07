import {
  HOOK_CALLED,
  PROVISION_FAILED,
  RUN_PAUSED,
} from '@runs/domain/value-objects/journal-entry-type';

interface ReadEntry {
  readonly type: string;
  readonly message?: string | null;
  readonly data?: string | null;
}

export const entryFactsOf = (
  entry: Pick<ReadEntry, 'data'>,
): Readonly<Record<string, unknown>> => {
  if (!entry.data) {
    return {};
  }

  try {
    const facts: unknown = JSON.parse(
      Buffer.from(entry.data, 'base64').toString('utf8'),
    );

    return facts && typeof facts === 'object'
      ? (facts as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const named = (value: unknown, otherwise: string): string =>
  typeof value === 'string' && value ? value : otherwise;

const controlPlaneEntryText = (entry: ReadEntry): string | undefined => {
  const facts = entryFactsOf(entry);

  switch (entry.type) {
    case HOOK_CALLED:
      return `Hook ${named(facts.hook, 'a hook')} · ${named(facts.step, 'a step')} → ${named(facts.target, 'somewhere')}`;
    case PROVISION_FAILED:
      return `Provisioning failed · ${named(facts.failure, 'unknown')}`;
    case RUN_PAUSED:
      return facts.resumesAtOnce === true
        ? 'Messages came in during the turn. The run starts again to read them.'
        : 'Waiting for a person';
    default:
      return undefined;
  }
};

export const journalEntryText = (entry: ReadEntry): string | undefined =>
  entry.message ?? controlPlaneEntryText(entry);
