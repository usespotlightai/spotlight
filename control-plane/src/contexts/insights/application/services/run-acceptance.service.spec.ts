import { RunAcceptance } from '@insights/application/services/run-acceptance.service';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import { ownedRecordOf } from '@insights/insights.fake-spec';
import { PullRequestRecordsInMemory } from '@insights/pull-requests.fake-spec';
import {
  endedRecord,
  RunRecordsInMemory,
  StationFactsInMemory,
} from '@insights/runs.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T11:00:00.000Z');

const ACTOR = UserId.of('user_lin');

const acceptanceOf = async (
  record: RunRecord,
  pullRequest: { merged: boolean } | null = null,
) => {
  const records = new RunRecordsInMemory();
  const pullRequests = new PullRequestRecordsInMemory();

  await records.add(record);
  if (pullRequest) {
    await pullRequests.add(
      ownedRecordOf('task_1', {
        openedAt: AT,
        closedAt: AT,
        merged: pullRequest.merged,
      }),
    );
  }

  const acceptance = new RunAcceptance(
    new StationFactsInMemory(records, { pullRequests }),
  );

  return {
    acceptedAfter: await acceptance.acceptedAfter('run_1'),
    disposition: (await acceptance.dispositions(['run_1'])).get('run_1'),
  };
};

const accepted = (ending: RunEnding) =>
  endedRecord('run_1', { ending }).recordAction(
    PersonAction.of('accepted', AT, ACTOR),
  );

describe('RunAcceptance', () => {
  it.each(['completed', 'stopped'] as const)(
    'counts a run that %s and a person accepted as accepted',
    async (ending) => {
      expect(await acceptanceOf(accepted(ending))).toEqual({
        acceptedAfter: true,
        disposition: 'accepted',
      });
    },
  );

  it('never counts a run that failed as accepted, though a person accepted it', async () => {
    expect(await acceptanceOf(accepted('failed'))).toEqual({
      acceptedAfter: false,
      disposition: 'failed',
    });
  });

  it('counts a completed run whose task’s pull request merged as accepted, as its resolution does', async () => {
    expect(await acceptanceOf(endedRecord('run_1'), { merged: true })).toEqual({
      acceptedAfter: true,
      disposition: 'accepted',
    });
  });

  it('never counts a run whose task’s pull request closed without a merge as accepted', async () => {
    expect(await acceptanceOf(endedRecord('run_1'), { merged: false })).toEqual(
      { acceptedAfter: false, disposition: 'other' },
    );
  });

  it('counts a run a person accepted after answering it as accepted', async () => {
    expect(
      await acceptanceOf(
        endedRecord('run_1')
          .recordAction(PersonAction.of('answered', AT, ACTOR))
          .recordAction(
            PersonAction.of(
              'accepted',
              new Date('2026-09-30T12:00:00.000Z'),
              ACTOR,
            ),
          ),
      ),
    ).toEqual({ acceptedAfter: true, disposition: 'accepted' });
  });
});
