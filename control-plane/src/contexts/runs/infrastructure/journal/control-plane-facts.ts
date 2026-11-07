import type {
  ControlPlaneEntry,
  ControlPlaneFacts,
  UnreadableFacts,
} from '@runs/application/ports/run-journal.port';
import { controlPlaneEntryText } from '@runs/application/rendering/journal-entry.text';
import {
  HOOK_CALLED,
  isControlPlaneType,
  PROVISION_FAILED,
  RUN_PAUSED,
} from '@runs/domain/value-objects/journal-entry-type';
import { decoded } from '@runs/infrastructure/journal/journalled';

const encoded = (value: object): string =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64');

export const encodedFacts = (entry: ControlPlaneEntry): string => {
  switch (entry.type) {
    case 'hook.called':
      return encoded({
        ...entry.call,
        startedAt: entry.call.startedAt.toISOString(),
      });
    case 'provision.failed':
      return encoded({ failure: entry.failure, detail: entry.detail });
    case 'run.paused':
      return encoded({ resumesAtOnce: entry.resumesAtOnce });
  }
};

type Stored = Readonly<Record<string, unknown>>;

const storedOf = (data: string | null): Stored | null => {
  if (!data) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(decoded(data));

    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Stored)
      : null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
};

const text = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const hookCalledOf = (stored: Stored): ControlPlaneFacts | null => {
  const hook = text(stored.hook);
  const step = text(stored.step);
  const target = text(stored.target);
  const startedAt = text(stored.startedAt);

  if (
    hook === null ||
    step === null ||
    target === null ||
    startedAt === null ||
    (stored.kind !== 'call' && stored.kind !== 'request') ||
    typeof stored.attempt !== 'number' ||
    typeof stored.failed !== 'boolean' ||
    typeof stored.ms !== 'number' ||
    (stored.status !== null && typeof stored.status !== 'number')
  ) {
    return null;
  }

  return {
    type: 'hook.called',
    call: {
      attempt: stored.attempt,
      hook,
      step,
      kind: stored.kind,
      target,
      request: stored.request,
      response: stored.response,
      status: stored.status,
      failed: stored.failed,
      startedAt: new Date(startedAt),
      ms: stored.ms,
    },
  };
};

const readFacts = (type: string, stored: Stored): ControlPlaneFacts | null => {
  switch (type) {
    case HOOK_CALLED:
      return hookCalledOf(stored);
    case PROVISION_FAILED: {
      const failure = text(stored.failure);
      const detail = text(stored.detail);

      return failure === null || detail === null
        ? null
        : { type: 'provision.failed', failure, detail };
    }
    case RUN_PAUSED:
      return typeof stored.resumesAtOnce === 'boolean'
        ? { type: 'run.paused', resumesAtOnce: stored.resumesAtOnce }
        : null;
    default:
      return null;
  }
};

export const controlPlaneFactsOf = (entry: {
  readonly type: string;
  readonly data: string | null;
}): ControlPlaneFacts | UnreadableFacts => {
  const stored = storedOf(entry.data);
  const facts = stored && readFacts(entry.type, stored);

  return facts ?? { type: 'unreadable', entryType: entry.type };
};

export const journalEntryText = (entry: {
  readonly type: string;
  readonly message: string | null;
  readonly data: string | null;
}): string | undefined =>
  entry.message ??
  (isControlPlaneType(entry.type)
    ? controlPlaneEntryText(controlPlaneFactsOf(entry))
    : undefined);
