import type {
  ControlPlaneEntry,
  JournalEntry,
  RunJournalPort,
} from '@runs/application/ports/run-journal.port';
import {
  HARNESS_CONNECTED,
  HOOK_CALLED,
  TOOL_REFUSED,
} from '@runs/domain/value-objects/journal-entry-type';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import {
  HARNESS_EVENT_TYPES,
  HARNESS_FRAME,
} from '@runs/infrastructure/journal/harness-events';
import { decoded } from '@runs/infrastructure/journal/journalled';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import { OncePer } from '@shared-kernel/application/services/once-per';

const SPAN = 'span';

const CARRIES_JSON = new Set([
  TOOL_REFUSED,
  HOOK_CALLED,
  SPAN,
  HARNESS_CONNECTED,
  HARNESS_FRAME,
  ...HARNESS_EVENT_TYPES,
]);

const NOTED_FOR_MS = 10 * 60_000;

const carriesJson = (entry: JournalEntry): boolean =>
  CARRIES_JSON.has(entry.type);

const readable = (data: string): boolean => {
  try {
    JSON.parse(decoded(data));
    return true;
  } catch {
    return false;
  }
};

export class CheckedRunJournal implements RunJournalPort {
  readonly #noted = new OncePer(NOTED_FOR_MS);

  constructor(
    private readonly journal: RunJournalPort,
    private readonly logger: LoggerPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async append(
    attempt: RunAttempt,
    entries: readonly JournalEntry[],
  ): Promise<void> {
    await this.journal.append(attempt, entries);

    for (const entry of entries) {
      if (entry.data && carriesJson(entry) && !readable(entry.data)) {
        this.unread(attempt, entry);
      }
    }
  }

  appendControlPlaneEntry(
    attempt: RunAttempt,
    entry: ControlPlaneEntry,
  ): Promise<JournalEntry> {
    return this.journal.appendControlPlaneEntry(attempt, entry);
  }

  private unread(attempt: RunAttempt, entry: JournalEntry): void {
    this.telemetry.count('spotlight.journal.unread', {
      'spotlight.journal.type': entry.type,
    });

    if (this.#noted.due(`${attempt.runId.value}\n${entry.type}`, new Date())) {
      this.logger.warn(
        {
          runId: attempt.runId.value,
          attempt: attempt.number,
          seq: entry.seq,
          type: entry.type,
        },
        'A journal entry from a runner does not read as JSON',
      );
    }
  }
}
