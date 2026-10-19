import { telemetryInMemory } from '@shared-kernel/application/ports/telemetry.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunJournalPort } from '@work/application/ports/run-journal.port';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { CheckedRunJournal } from '@work/infrastructure/journal/checked-run-journal';
import { describe, expect, it, vi } from 'vitest';

const encoded = (text: string) => Buffer.from(text, 'utf8').toString('base64');

const checking = () => {
  const journal = {
    append: vi.fn(async () => undefined),
    appendControlPlaneEntry: vi.fn(async () => 1),
  } satisfies RunJournalPort;
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const telemetry = telemetryInMemory();

  return {
    journal,
    logger,
    telemetry,
    checked: new CheckedRunJournal(journal, logger, telemetry),
  };
};

const ATTEMPT = RunAttempt.of(RunId.of('run_1'), 1);
const AT = new Date('2026-10-19T12:00:00.000Z');

describe('CheckedRunJournal', () => {
  it('stores every entry and says once which entries do not read as JSON', async () => {
    const { journal, logger, telemetry, checked } = checking();
    const entries = [
      { seq: 1, type: 'usage', at: AT, data: encoded('{"tokens": 3}') },
      { seq: 2, type: 'usage', at: AT, data: encoded('secret prompt {') },
      { seq: 3, type: 'usage', at: AT, data: encoded('also broken {') },
      {
        seq: 4,
        type: 'output',
        at: AT,
        message: 'npm test',
        data: encoded('plain text'),
      },
      { seq: 5, type: 'workspace.ready', at: AT, data: encoded('not json') },
    ];

    await checked.append(ATTEMPT, entries);

    expect(journal.append).toHaveBeenCalledWith(ATTEMPT, entries);
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      { runId: 'run_1', attempt: 1, seq: 2, type: 'usage' },
      'A journal entry from a runner does not read as JSON',
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secret');
    expect(telemetry.counted).toHaveLength(2);
  });
});
