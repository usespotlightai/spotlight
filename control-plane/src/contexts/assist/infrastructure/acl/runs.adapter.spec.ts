import { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import { AssistSessionId } from '@assist/domain/value-objects/assist-session-id.vo';
import { Runs } from '@assist/infrastructure/acl/runs.adapter';
import type { RunOrderContract } from '@runs/application/contracts/run-order.contract';
import type { HarnessCommandsPort } from '@runs/application/ports/harness-commands.port';
import type { RunFacts } from '@runs/application/ports/run-facts.port';
import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import type { RunsPort as RunQueuePort } from '@runs/application/ports/runs.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  RunHarnessChoice,
  StationRunsPort,
} from '@work/application/ports/station-runs.port';
import { describe, expect, it } from 'vitest';

const BASED_ON = {
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  harness: HarnessId.of('claude-code'),
  team: TeamId.of('team_1'),
  placement: RunnerPlacement.of(['vpc-internal']),
  image: null,
  startedFrom: {
    archiveId: 'archive_started',
    archiveStored: true,
    at: new Date(0),
    checkouts: [],
  },
} as unknown as RunFacts;

const ORDER = {
  run: RunId.of('run_2'),
  session: AssistSessionId.of('assist_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  purpose: AssistPurpose.of('insights.judge'),
  basedOn: RunId.of('run_1'),
  briefing: 'Read .spotlight/assist/diff.patch.',
  files: { 'diff.patch': '+ fixed' },
};

const adapting = ({
  facts = [BASED_ON],
  restorable = 'archive_ended',
  choice = { harness: 'claude-code', model: 'opus', effort: 'high' },
  harnesses = ['claude-code'],
}: {
  facts?: readonly RunFacts[];
  restorable?: string | null;
  choice?: RunHarnessChoice | null;
  harnesses?: readonly string[];
} = {}) => {
  const enqueued: RunOrderContract[] = [];
  const chosen: unknown[] = [];
  const restoredFrom: RunId[] = [];
  const runs = {
    enqueue: async (order: RunOrderContract) => {
      enqueued.push(order);
      return { outcome: 'enqueued' as const };
    },
  } as unknown as RunQueuePort;
  const commands: HarnessCommandsPort = {
    problemOf: () => null,
    commandFor: (picked, trail) => {
      chosen.push({ ...picked, trail });
      return harnesses.includes(picked.harness)
        ? { executable: 'claude', args: [], env: {} }
        : null;
    },
  };
  const adapter = new Runs(
    runs,
    { of: async () => facts },
    {
      restorableFor: async (run: RunId) => {
        restoredFrom.push(run);
        return restorable;
      },
    },
    { leasedBy: async () => null } as unknown as RunLeasesPort,
    { harnessChoiceOf: async () => choice } as unknown as StationRunsPort,
    commands,
  );

  return { adapter, enqueued, chosen, restoredFrom };
};

describe('queuing the run of an assist session', () => {
  it('takes the harness, model, effort, placement and restorable archive of the run it is based on', async () => {
    const { adapter, enqueued, chosen, restoredFrom } = adapting();

    await expect(adapter.enqueue(ORDER)).resolves.toEqual({
      outcome: 'enqueued',
      on: { harness: 'claude-code', model: 'opus' },
    });
    expect(restoredFrom).toEqual([RunId.of('run_1')]);
    expect(chosen).toEqual([
      {
        harness: 'claude-code',
        model: 'opus',
        effort: 'high',
        trail: 'session:assist_1',
      },
    ]);
    expect(enqueued[0]).toMatchObject({
      runId: 'run_2',
      workspaceId: 'ws_1',
      harness: 'claude-code',
      priority: 0,
      placement: { labelGroups: [['vpc-internal']], image: null },
      spec: {
        briefing: ORDER.briefing,
        handover: { options: [], noteLimit: 0 },
      },
      requester: {
        owner: 'assist',
        kind: 'session',
        id: 'assist_1',
        team: 'team_1',
      },
      policy: { holdsTurn: false, asks: 'recorded', listed: false },
      workingCopy: { key: 'assist/assist_1', rejoinable: false },
      restore: { archive: 'archive_ended' },
      extensions: {
        assist: { purpose: 'insights.judge', files: ORDER.files },
      },
    });
  });

  it('places the run where the base run could run, not on the digest that run happened to start in', async () => {
    const ranIn = 'ghcr.io/acme/runner@sha256:' + 'a'.repeat(64);
    const onDefault = adapting({
      facts: [{ ...BASED_ON, image: ranIn }],
    });
    const onTag = adapting({
      facts: [
        {
          ...BASED_ON,
          image: ranIn,
          placement: RunnerPlacement.of(['vpc-internal']).in(
            RunnerImage.of('ghcr.io/acme/runner:node'),
          ),
        },
      ],
    });

    await onDefault.adapter.enqueue(ORDER);
    await onTag.adapter.enqueue(ORDER);

    expect(onDefault.enqueued[0]?.placement).toEqual({
      labelGroups: [['vpc-internal']],
      image: null,
    });
    expect(onTag.enqueued[0]?.placement).toEqual({
      labelGroups: [['vpc-internal']],
      image: 'ghcr.io/acme/runner:node',
    });
  });

  it('restores nothing when the run it is based on left no archive to restore', async () => {
    const { adapter, enqueued } = adapting({ restorable: null });

    await adapter.enqueue(ORDER);

    expect(enqueued[0]?.restore).toBeNull();
  });

  it('starts the run’s harness without a model when no station configured it', async () => {
    const { adapter, chosen } = adapting({ choice: null });

    await expect(adapter.enqueue(ORDER)).resolves.toEqual({
      outcome: 'enqueued',
      on: { harness: 'claude-code', model: null },
    });
    expect(chosen).toMatchObject([
      { harness: 'claude-code', model: null, effort: null },
    ]);
  });

  it('queues nothing when no runner can start the harness', async () => {
    const { adapter, enqueued } = adapting({ harnesses: ['codex'] });

    await expect(adapter.enqueue(ORDER)).resolves.toEqual({
      outcome: 'no-harness',
    });
    expect(enqueued).toEqual([]);
  });

  it('queues nothing for a base run of another workspace, or one it cannot find', async () => {
    const elsewhere = adapting({
      facts: [{ ...BASED_ON, workspaceId: WorkspaceId.of('ws_2') }],
    });
    const missing = adapting({ facts: [] });

    await expect(elsewhere.adapter.enqueue(ORDER)).resolves.toEqual({
      outcome: 'base-run-elsewhere',
    });
    await expect(missing.adapter.enqueue(ORDER)).resolves.toEqual({
      outcome: 'base-run-elsewhere',
    });
    expect([...elsewhere.enqueued, ...missing.enqueued]).toEqual([]);
  });
});
