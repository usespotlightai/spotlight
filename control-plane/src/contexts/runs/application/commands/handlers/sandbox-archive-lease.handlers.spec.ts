import type {
  AuthenticatedSandbox,
  SandboxesPort,
} from '@runners/application/ports/sandboxes.port';
import { AppendSandboxArchiveJournalHandler } from '@runs/application/commands/handlers/append-sandbox-archive-journal.handler';
import { HoldSandboxArchiveHandler } from '@runs/application/commands/handlers/hold-sandbox-archive.handler';
import { ReleaseSandboxArchiveHandler } from '@runs/application/commands/handlers/release-sandbox-archive.handler';
import {
  AppendSandboxArchiveJournalCommand,
  HoldSandboxArchiveCommand,
  ReleaseSandboxArchiveCommand,
} from '@runs/application/commands/working-copy-archive.commands';
import type { JournalEntry } from '@runs/application/ports/run-journal.port';
import { RunJournalAppends } from '@runs/application/services/run-journal-appends.service';
import { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import {
  aLeasedRun,
  runsOf,
} from '@runs/application/services/working-copy-archives.fake-spec';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { Handover } from '@runs/domain/value-objects/handover.vo';
import { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TOKEN = 'sandbox-token';

const NOW = new Date('2026-11-14T10:00:00.000Z');

const reported = (run: Run): Run =>
  run.reportTurn(
    RunnerId.of('runner_1'),
    RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
    HandoverReport.of({}),
    NOW,
  );

const entry = {
  seq: 41,
  type: 'output',
  at: '2026-11-14T10:00:14.000Z',
  message: 'archive',
  data: 'Captured the workspace for the next run (12.0 MB)',
};

const setUp = (input: {
  run: Run;
  holds?: boolean;
  archived?: number;
  workspaceId?: string;
}) => {
  const sandbox: AuthenticatedSandbox = {
    id: 'sandbox_1',
    workspaceId: input.workspaceId ?? 'ws_1',
    key: 'requester/subject-task_1',
  };
  const port = {
    authenticate: async (token: string | undefined) =>
      token === TOKEN ? sandbox : null,
    holdArchive: vi.fn(async () => input.holds ?? true),
    renewArchive: vi.fn(async () => input.holds ?? true),
    releaseArchive: vi.fn(async () => {}),
    archivedAttemptOf: vi.fn(async () => input.archived ?? null),
  };
  const sandboxes = new SandboxArchives(port as unknown as SandboxesPort);
  const appended: { attempt: RunAttempt; entries: readonly JournalEntry[] }[] =
    [];
  const published: string[] = [];
  const appends = new RunJournalAppends(
    {
      append: async (attempt, entries) =>
        void appended.push({ attempt, entries }),
      appendControlPlaneEntry: async () => {
        throw new Error('not used');
      },
    },
    { publish: (runId: string) => void published.push(runId) } as never,
  );
  const clock = { now: () => NOW, sleep: async () => {} };
  const runs = runsOf(input.run);

  return {
    port,
    appended,
    published,
    hold: new HoldSandboxArchiveHandler(sandboxes, runs, clock),
    release: new ReleaseSandboxArchiveHandler(sandboxes, clock),
    append: new AppendSandboxArchiveJournalHandler(
      sandboxes,
      runs,
      appends,
      clock,
    ),
  };
};

describe('a sandbox that archives a run’s workspace after the run reported its turn', () => {
  it('holds itself for the archive of the run in it', async () => {
    const { hold, port } = setUp({ run: aLeasedRun() });

    await expect(
      hold.execute(
        new HoldSandboxArchiveCommand('sandbox_1', TOKEN, 'run_1', 1),
      ),
    ).resolves.toBe(true);
    expect(port.holdArchive).toHaveBeenCalledWith('sandbox_1', 'run_1', 1, NOW);
    expect(port.renewArchive).not.toHaveBeenCalled();
  });

  it('only renews the lease of an attempt no longer in its turn', async () => {
    const { hold, port } = setUp({ run: reported(aLeasedRun()) });

    await expect(
      hold.execute(
        new HoldSandboxArchiveCommand('sandbox_1', TOKEN, 'run_1', 1),
      ),
    ).resolves.toBe(true);
    expect(port.renewArchive).toHaveBeenCalledWith(
      'sandbox_1',
      'run_1',
      1,
      NOW,
    );
    expect(port.holdArchive).not.toHaveBeenCalled();
  });

  it('holds nothing for a wrong token, an unknown run, or a run of another workspace', async () => {
    const cases = [
      { token: 'stolen', runId: 'run_1', workspaceId: 'ws_1' },
      { token: TOKEN, runId: 'run_9', workspaceId: 'ws_1' },
      { token: TOKEN, runId: 'run_1', workspaceId: 'ws_2' },
    ];

    for (const each of cases) {
      const { hold, port } = setUp({
        run: aLeasedRun(),
        workspaceId: each.workspaceId,
      });

      await expect(
        hold.execute(
          new HoldSandboxArchiveCommand('sandbox_1', each.token, each.runId, 1),
        ),
      ).resolves.toBe(false);
      expect(port.holdArchive).not.toHaveBeenCalled();
    }
  });

  it('says so when the sandbox does not hold the run', async () => {
    const { hold } = setUp({ run: aLeasedRun(), holds: false });

    await expect(
      hold.execute(
        new HoldSandboxArchiveCommand('sandbox_1', TOKEN, 'run_1', 1),
      ),
    ).resolves.toBe(false);
  });

  it('journals the archive step under the attempt that reported its turn', async () => {
    const run = reported(aLeasedRun());
    const { append, appended, published } = setUp({
      run,
      archived: 1,
    });

    await expect(
      append.execute(
        new AppendSandboxArchiveJournalCommand('sandbox_1', TOKEN, 'run_1', [
          entry,
        ]),
      ),
    ).resolves.toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0]?.attempt.equals(run.attempt)).toBe(true);
    expect(appended[0]?.entries[0]).toMatchObject({
      seq: 41,
      message: 'archive',
    });
    expect(published).toEqual(['run_1']);
  });

  it('journals the archive step under the attempt that reported it, also once the person answered and the run is queued again', async () => {
    const run = aLeasedRun()
      .reportTurn(
        RunnerId.of('runner_1'),
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        HandoverReport.of({
          handover: Handover.of({ next: 'review', note: 'Which queue?' }),
          session: HarnessSession.of('session_1'),
        }),
        NOW,
      )
      .resumed(
        RunAttempt.of(RunId.of('run_1'), 1),
        'messages',
        [],
        new Date(NOW.getTime() + 5_000),
      );
    const { append, appended } = setUp({ run, archived: 1 });

    expect(run.attempt.number).toBe(2);
    await expect(
      append.execute(
        new AppendSandboxArchiveJournalCommand('sandbox_1', TOKEN, 'run_1', [
          entry,
        ]),
      ),
    ).resolves.toBe(true);
    expect(appended[0]?.attempt.number).toBe(1);
  });

  it('refuses to journal an attempt that is queued and never reported a turn', async () => {
    const run = aLeasedRun()
      .reportTurn(
        RunnerId.of('runner_1'),
        RunOutcome.of({ exitCode: ExitCode.of(0), failed: false }),
        HandoverReport.of({
          handover: Handover.of({ next: 'review', note: 'Which queue?' }),
          session: HarnessSession.of('session_1'),
        }),
        NOW,
      )
      .resumed(
        RunAttempt.of(RunId.of('run_1'), 1),
        'messages',
        [],
        new Date(NOW.getTime() + 5_000),
      );
    const queued = setUp({ run, archived: 2 });
    const unknown = setUp({ run, archived: 3 });

    await expect(
      queued.append.execute(
        new AppendSandboxArchiveJournalCommand('sandbox_1', TOKEN, 'run_1', [
          entry,
        ]),
      ),
    ).rejects.toBeInstanceOf(ApplicationError);
    await expect(
      unknown.append.execute(
        new AppendSandboxArchiveJournalCommand('sandbox_1', TOKEN, 'run_1', [
          entry,
        ]),
      ),
    ).resolves.toBe(false);
  });

  it('journals nothing for a run whose archive it does not hold', async () => {
    const { append, appended } = setUp({ run: reported(aLeasedRun()) });

    await expect(
      append.execute(
        new AppendSandboxArchiveJournalCommand('sandbox_1', TOKEN, 'run_1', [
          entry,
        ]),
      ),
    ).resolves.toBe(false);
    expect(appended).toEqual([]);
  });

  it('refuses to journal a run that has not reported its turn: its runner journals it', async () => {
    const run = aLeasedRun();
    const { append, appended } = setUp({
      run,
      archived: 1,
    });

    await expect(
      append.execute(
        new AppendSandboxArchiveJournalCommand('sandbox_1', TOKEN, 'run_1', [
          entry,
        ]),
      ),
    ).rejects.toBeInstanceOf(ApplicationError);
    expect(appended).toEqual([]);
  });

  it('releases the sandbox for its next run', async () => {
    const { release, port } = setUp({ run: reported(aLeasedRun()) });

    await expect(
      release.execute(
        new ReleaseSandboxArchiveCommand('sandbox_1', TOKEN, 'run_1'),
      ),
    ).resolves.toBe(true);
    expect(port.releaseArchive).toHaveBeenCalledWith('sandbox_1', 'run_1', NOW);
    await expect(
      release.execute(
        new ReleaseSandboxArchiveCommand('sandbox_1', 'stolen', 'run_1'),
      ),
    ).resolves.toBe(false);
  });
});
