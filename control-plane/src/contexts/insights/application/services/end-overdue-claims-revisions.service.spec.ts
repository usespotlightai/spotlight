import { EndOverdueClaimsRevisions } from '@insights/application/services/end-overdue-claims-revisions.service';
import { PULL_REQUEST_DEADLINE_MS } from '@insights/domain/aggregates/claims-revision.aggregate';
import { REVISION_COOLDOWN_MS } from '@insights/domain/services/revision-trigger';
import { clockAt } from '@insights/judge-repair-setup.fake-spec';
import {
  ClaimsRevisionsInMemory,
  OPENED_AT,
  startedRevision,
} from '@insights/judge-repair.fake-spec';
import { inTransaction } from '@insights/runs.fake-spec';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import { describe, expect, it } from 'vitest';

const logger: LoggerPort = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

const PICK = {
  claims: ['It retries the upload once.'],
  agreement: {
    searched: { before: 0.1, after: 0.5, runs: 30 },
    heldOut: { before: 0.2, after: 0.6, runs: 12 },
  },
};

const later = (ms: number) => new Date(OPENED_AT.getTime() + ms);

const pickedRevisions = async (ids: readonly string[]) => {
  const revisions = new ClaimsRevisionsInMemory();

  for (const id of ids) {
    const started = startedRevision({ id });
    await revisions.add(started);
    const stored = await revisions.find(started.id);
    if (stored) {
      await revisions.save(stored.picked({ pick: PICK, now: OPENED_AT }));
    }
  }
  revisions.events.length = 0;

  return revisions;
};

const sweepAt = (revisions: ClaimsRevisionsInMemory, now: Date) =>
  new EndOverdueClaimsRevisions(
    revisions,
    inTransaction,
    clockAt(now),
    logger,
  ).processDue();

describe('EndOverdueClaimsRevisions', () => {
  it('keeps a pick that may still get its pull request', async () => {
    const revisions = await pickedRevisions(['revision_1']);

    await sweepAt(revisions, later(PULL_REQUEST_DEADLINE_MS));

    expect([...revisions.stored.values()][0]?.outcome).toBeNull();
    expect(revisions.events).toEqual([]);
  });

  it('ends a pick at its deadline, with no new disagreement, so the cooldown starts from the deadline', async () => {
    const revisions = await pickedRevisions(['revision_1']);

    await sweepAt(revisions, later(REVISION_COOLDOWN_MS));

    const ended = firstOf([...revisions.stored.values()]);
    expect(ended?.outcome?.reason).toBe('pull-request-failed');
    expect(ended?.endedAt).toEqual(later(PULL_REQUEST_DEADLINE_MS));
    expect(revisions.events.map((each) => each.kind)).toEqual([
      'claims-revision.ended',
    ]);
  });

  it('leaves a revision that is not picked yet', async () => {
    const revisions = new ClaimsRevisionsInMemory();
    await revisions.add(startedRevision());

    await sweepAt(revisions, later(REVISION_COOLDOWN_MS));

    expect([...revisions.stored.values()][0]?.endedAt).toBeNull();
  });
});
