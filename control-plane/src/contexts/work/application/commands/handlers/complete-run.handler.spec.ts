import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CompleteRunHandler } from '@work/application/commands/handlers/complete-run.handler';
import { CompleteRunCommand } from '@work/application/commands/runner.commands';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { orderedFor } from '@work/domain/aggregates/run.fake-spec';
import { RunSuspended } from '@work/domain/events/run-suspended.event';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-17T09:00:00.000Z');

const leased = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    ...orderedFor.task('task_1', 0),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    }),
  }).claim(RunnerId.of('runner_1'), NOW);

const attaching = () => {
  const asked: [string, readonly string[]][] = [];
  const taken: [string, readonly string[]][] = [];

  return {
    asked,
    taken,
    uploadedBy: async (
      run: RunId,
      workspaceId: WorkspaceId,
      ids: readonly string[],
    ) => {
      asked.push([`${run.value}@${workspaceId.value}`, ids]);
      return ids.map((id) =>
        Attachment.of({
          id,
          name: `${id.replace('file_', '')}.png`,
          contentType: 'image/png',
          size: 3,
        }),
      );
    },
    takenIn: async (workspaceId: WorkspaceId, files: readonly Attachment[]) =>
      void taken.push([workspaceId.value, files.map((each) => each.id.value)]),
  } as unknown as FilesLoader & {
    asked: [string, readonly string[]][];
    taken: [string, readonly string[]][];
  };
};

const completing = (
  save: (run: Run) => Promise<void>,
  stored: { run?: () => Run; files?: FilesLoader } = {},
) =>
  new CompleteRunHandler(
    {
      findById: async () => (stored.run ? stored.run() : leased()),
      save,
    } as unknown as RunRepository,
    {
      inTransaction: (work: () => Promise<unknown>) => work(),
    } as TransactionPort,
    { now: () => NOW, sleep: async () => {} },
    stored.files ??
      ({
        uploadedBy: async () => [],
        takenIn: async () => {},
      } as unknown as FilesLoader),
  );

const chatRun = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    ...orderedFor.chat('chat_1'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    }),
  }).claim(RunnerId.of('runner_1'), NOW);

describe('CompleteRunHandler', () => {
  const reviewing = new CompleteRunCommand(
    'run_1',
    'runner_1',
    0,
    false,
    undefined,
    {
      next: 'review',
      note: 'Which queue should I drain?',
      attachments: ['file_light'],
    },
    'session_1',
  );

  it('suspends a task run that hands over, changing nothing but the run, until its task decides the turn', async () => {
    const saved: Run[] = [];
    const files = attaching();

    await completing(async (run) => void saved.push(run), { files }).execute(
      reviewing,
    );

    const [run] = saved;
    expect(run?.state).toBe('suspended');
    expect(run?.claimedBy).toBeNull();
    expect(run?.turnAt(1)?.state).toBe('pending');
    expect(run?.turnAt(1)?.report.session?.value).toBe('session_1');
    expect(
      run?.turnAt(1)?.report.handover?.attachments.map((each) => each.id.value),
    ).toEqual(['file_light']);
    expect(run?.spec.value.resume).toEqual({
      sessionId: 'session_1',
      resumeSession: true,
    });
    expect(files.asked).toEqual([['run_1@ws_1', ['file_light']]]);
    expect(files.taken).toEqual([]);
    expect(run?.pullEvents().some((each) => each instanceof RunSuspended)).toBe(
      true,
    );
  });

  it('takes the files of a run that ends its turn at once, such as a chat’s', async () => {
    const files = attaching();

    await completing(async () => {}, { files, run: chatRun }).execute(
      reviewing,
    );

    expect(files.taken).toEqual([['ws_1', ['file_light']]]);
  });

  it('takes no files from a turn that failed, and ends it at once', async () => {
    const saved: Run[] = [];
    const files = attaching();

    await completing(async (run) => void saved.push(run), { files }).execute(
      new CompleteRunCommand('run_1', 'runner_1', 1, true, 'boom', {
        next: 'review',
        attachments: ['file_light'],
      }),
    );

    expect(files.asked).toEqual([]);
    expect(saved[0]?.state).toBe('failed');
  });

  it('refuses a second report of a turn whose run it suspended', async () => {
    const saved: Run[] = [];
    const suspended = () =>
      leased().reportTurn(
        RunnerId.of('runner_1'),
        RunOutcome.of({ exitCode: 0, failed: false }),
        HandoverReport.none(),
        NOW,
      );

    await expect(
      completing(async (run) => void saved.push(run), {
        run: suspended,
      }).execute(reviewing),
    ).rejects.toThrow();
    expect(saved).toEqual([]);
  });

  it('keeps whether the run was stopped on what it ended with', async () => {
    const saved: Run[] = [];

    await completing(async (run) => void saved.push(run)).execute(
      new CompleteRunCommand(
        'run_1',
        'runner_1',
        130,
        false,
        undefined,
        null,
        null,
        true,
      ),
    );

    expect(saved[0]?.outcome?.stopped).toBe(true);
  });

  describe('a run its host stopped for running past its time', () => {
    const RUNNER = RunnerId.of('runner_1');
    const timedOut = new CompleteRunCommand(
      'run_1',
      'runner_1',
      -1,
      true,
      "Sandbox stopped at the host's time limit. Time limit: 2h0m0s",
      null,
      null,
      false,
      false,
      true,
    );
    const lastAttempt = () =>
      leased()
        .timedOut(RUNNER, NOW)
        .claim(RUNNER, NOW)
        .timedOut(RUNNER, NOW)
        .claim(RUNNER, NOW);

    it('goes back on the queue, as a run whose lease expired does', async () => {
      const saved: Run[] = [];

      await completing(async (run) => void saved.push(run)).execute(timedOut);

      expect(saved[0]?.state).toBe('queued');
    });

    it('is exhausted as timed out at its last attempt', async () => {
      const saved: Run[] = [];

      await completing(async (run) => void saved.push(run), {
        run: lastAttempt,
      }).execute(timedOut);

      expect(saved[0]?.outcome?.failure?.code).toBe('timed-out');
    });

    it('tries again when the run changed while it was told of its end, as by the lease its host was still renewing', async () => {
      const saved: Run[] = [];
      let tries = 0;

      await completing(async (run) => {
        tries += 1;
        if (tries === 1) {
          throw new RunVersionConflictError(run.id.value);
        }
        saved.push(run);
      }).execute(timedOut);

      expect(tries).toBe(2);
      expect(saved[0]?.state).toBe('queued');
    });
  });

  it('reports a run that changed while it was completing as a conflict', async () => {
    await expect(
      completing(async (run) => {
        throw new RunVersionConflictError(run.id.value);
      }).execute(new CompleteRunCommand('run_1', 'runner_1', 0, false)),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('refuses a report from a runner that does not lease the run', async () => {
    await expect(
      completing(async () => {}).execute(
        new CompleteRunCommand('run_1', 'runner_2', 0, false, undefined, {
          next: 'deploy',
        }),
      ),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });
});
