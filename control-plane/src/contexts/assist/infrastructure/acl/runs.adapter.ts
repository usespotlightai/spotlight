import {
  ASSIST_OWNER,
  type AssistRunEnqueueing,
  type AssistRunOrder,
  type RunsPort,
} from '@assist/application/ports/runs.port';
import {
  type RunPolicyContract,
  type RunRequesterContract,
  workingCopyKeyOf,
} from '@runs/application/contracts/run-order.contract';
import type {
  HarnessChoice,
  HarnessCommandsPort,
} from '@runs/application/ports/harness-commands.port';
import type { RunArchivesPort } from '@runs/application/ports/run-archives.port';
import type {
  RunFacts,
  RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import type { RunsPort as RunQueuePort } from '@runs/application/ports/runs.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { StationRunsPort } from '@work/application/ports/station-runs.port';

const RUN_POLICY: RunPolicyContract = {
  holdsTurn: false,
  gated: false,
  actsBeyondItself: false,
  asks: 'recorded',
  listed: false,
  exclusive: false,
};

/** After task runs, ahead of searches and trials. */
const ASSIST_PRIORITY = 0;

const REQUESTER_KIND = 'session';

export class Runs implements RunsPort {
  constructor(
    private readonly runs: RunQueuePort,
    private readonly facts: RunFactsPort,
    private readonly archives: RunArchivesPort,
    private readonly leases: RunLeasesPort,
    private readonly stations: StationRunsPort,
    private readonly commands: HarnessCommandsPort,
  ) {}

  async enqueue(order: AssistRunOrder): Promise<AssistRunEnqueueing> {
    const [basedOn] = await this.facts.of([order.basedOn]);

    if (!basedOn?.workspaceId.equals(order.workspaceId)) {
      return { outcome: 'base-run-elsewhere' };
    }

    const requester: RunRequesterContract = {
      owner: ASSIST_OWNER,
      kind: REQUESTER_KIND,
      id: order.session.value,
      token: null,
      team: basedOn.team?.value ?? null,
    };
    const choice = await this.choiceOf(basedOn);
    const command = this.commands.commandFor(
      choice,
      `${requester.kind}:${requester.id}`,
      order.run.value,
    );

    if (!command) {
      return { outcome: 'no-harness' };
    }

    const archive = await this.archives.restorableFor(basedOn.runId);
    const enqueued = await this.runs.enqueue({
      runId: order.run.value,
      workspaceId: order.workspaceId.value,
      harness: basedOn.harness.value,
      priority: ASSIST_PRIORITY,
      placement: {
        labelGroups: basedOn.placement.labelGroups,
        image: basedOn.placement.image?.value ?? basedOn.image,
      },
      spec: {
        command,
        briefing: order.briefing,
        handover: { options: [], noteLimit: 0 },
        resume: {},
      },
      requester,
      policy: RUN_POLICY,
      workingCopy: {
        key: workingCopyKeyOf(ASSIST_OWNER, order.session.value),
        rejoinable: false,
        restores: 'when-continuing',
      },
      restore: archive ? { archive } : null,
      extensions: {
        assist: { purpose: order.purpose.value, files: { ...order.files } },
      },
      apiGrant: null,
      tags: {},
      line: null,
      refusal: null,
    });

    return enqueued.outcome === 'enqueued'
      ? {
          outcome: 'enqueued',
          on: { harness: choice.harness, model: choice.model },
        }
      : { outcome: 'refused' };
  }

  async isLeasedBy(run: RunId, runnerId: string): Promise<boolean> {
    return (await this.leases.leasedBy(run, RunnerId.of(runnerId))) !== null;
  }

  private async choiceOf(run: RunFacts): Promise<HarnessChoice> {
    const configured = await this.stations.harnessChoiceOf(run.runId.value);

    return configured?.harness === run.harness.value
      ? configured
      : { harness: run.harness.value, model: null, effort: null };
  }
}
