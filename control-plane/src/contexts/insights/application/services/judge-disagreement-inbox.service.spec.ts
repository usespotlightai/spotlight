import { JudgeDisagreementInbox } from '@insights/application/services/judge-disagreement-inbox.service';
import { JudgeDisagreementAnswered } from '@insights/domain/events/judge-disagreement-answered.event';
import { JudgeDisagreementOpened } from '@insights/domain/events/judge-disagreement-opened.event';
import { JudgeDisagreementWithdrawn } from '@insights/domain/events/judge-disagreement-withdrawn.event';
import {
  JudgeDisagreementsInMemory,
  openDisagreement,
} from '@insights/judge-repair.fake-spec';
import { RUBRIC_VERSION } from '@insights/judging.fake-spec';
import { WORKSPACE } from '@insights/runs.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const ADA = UserId.of('user_ada');
const NOW = new Date('2026-10-02T10:00:00.000Z');

const setUp = async () => {
  const disagreements = new JudgeDisagreementsInMemory();
  const opened = openDisagreement('run_1', { askedOf: ADA });
  await disagreements.add(opened);
  const moved: string[] = [];
  const inbox = new JudgeDisagreementInbox(disagreements, {
    ask: (taskId, disagreementId, askedOf) => {
      moved.push(
        `ask ${taskId.value} ${disagreementId.value} ${askedOf?.value}`,
      );

      return Promise.resolve();
    },
    resolve: (taskId, disagreementId, askedOf) => {
      moved.push(
        `resolve ${taskId.value} ${disagreementId.value} ${askedOf?.value}`,
      );

      return Promise.resolve();
    },
  });
  const args = [
    opened.id,
    RunId.of('run_1'),
    WORKSPACE,
    opened.location,
    RUBRIC_VERSION,
  ] as const;

  return { disagreements, inbox, moved, args, opened };
};

describe('JudgeDisagreementInbox', () => {
  it('asks the person while the disagreement is open, and resolves the question once it is answered', async () => {
    const { disagreements, inbox, moved, args, opened } = await setUp();

    await inbox.moved(new JudgeDisagreementOpened(...args));
    await disagreements.save(
      [1, 2].reduce(
        (disagreement, claim) =>
          disagreement.answerClaim({
            claim,
            answer: 'judge-right',
            note: null,
            by: ADA,
            now: NOW,
          }),
        opened,
      ),
    );
    await inbox.moved(new JudgeDisagreementAnswered(...args));

    expect(moved).toEqual([
      'ask task_run_1 disagreement_run_1 user_ada',
      'resolve task_run_1 disagreement_run_1 user_ada',
    ]);
  });

  it('resolves the question, still asked of the person, when the opened event comes after the disagreement was withdrawn', async () => {
    const { disagreements, inbox, moved, args, opened } = await setUp();
    await disagreements.save(opened.withdraw(NOW, 'verdicts-agree'));

    await inbox.moved(
      new JudgeDisagreementWithdrawn(...args, 'verdicts-agree'),
    );
    await inbox.moved(new JudgeDisagreementOpened(...args));

    expect(moved).toEqual([
      'resolve task_run_1 disagreement_run_1 user_ada',
      'resolve task_run_1 disagreement_run_1 user_ada',
    ]);
  });

  it('leaves the inbox alone once the disagreement is gone with its task', async () => {
    const { disagreements, inbox, moved, args, opened } = await setUp();
    disagreements.stored.delete(opened.id.value);

    await inbox.moved(new JudgeDisagreementOpened(...args));

    expect(moved).toEqual([]);
  });
});
