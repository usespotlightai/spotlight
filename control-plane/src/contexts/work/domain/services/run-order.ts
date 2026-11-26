import type { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import {
  type EnabledForRun,
  enabledAt,
} from '@work/domain/services/enabled-for-run';
import {
  checkoutsOf,
  type TaskCheckout,
} from '@work/domain/services/task-checkouts';
import type { BoundSecret } from '@work/domain/value-objects/bound-secret';
import type { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import type { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import type { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';
import type { ReadySkill } from '@work/domain/value-objects/ready-skill';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';
import type { Resume } from '@work/domain/value-objects/resume.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { SecretAwaitingValue } from '@work/domain/value-objects/secret-awaiting-value.vo';
import { SecretSandboxNotAllowed } from '@work/domain/value-objects/secret-sandbox-not-allowed.vo';
import type { Station } from '@work/domain/value-objects/station.vo';

export interface RunOrder {
  readonly harness: HarnessId;
  readonly model: HarnessModel | null;
  readonly effort: Effort | null;
  readonly stationId: StationId;
  readonly priority: RunPriority;
  readonly placement: RunnerPlacement;
  readonly options: readonly HandoverOption[];
  readonly resumeOptions: readonly HandoverOption[];
  readonly noteLimit: number;
  readonly resume: Resume;
  readonly checkouts: readonly TaskCheckout[];
  readonly enabled: EnabledForRun;
  readonly diffs: boolean;
  readonly check: string | null;
  readonly refusals: readonly RefusalReason[];
  readonly boundSecrets: readonly BoundSecret[];
}

export interface OrderedAt {
  readonly stationId: StationId;
  readonly resume: Resume;
  readonly checkouts: readonly TaskCheckout[];
}

export type RunLaunch = Pick<
  RunOrder,
  'harness' | 'model' | 'effort' | 'enabled'
>;

export interface StationLaunch {
  readonly station: Station;
  readonly launch: RunLaunch;
}

interface Launching {
  line: LineMap;
  harnesses: HarnessCatalogue;
  ready: readonly ReadySkill[];
  profiles: readonly ReadyProfile[];
  toolsOnMarks?: readonly Tool[];
}

interface Ordering extends Launching {
  denied?: readonly DeniedCatalogItem[];
  boundSecrets: readonly BoundSecret[];
}

export const launchAt = ({
  stationId,
  line,
  harnesses,
  ready,
  profiles,
  toolsOnMarks = [],
}: Launching & { stationId: StationId }): StationLaunch | null => {
  const station = line.stationAt(stationId);

  if (!station?.harness || !harnesses.knows(station.harness)) {
    return null;
  }

  return {
    station,
    launch: {
      harness: station.harness,
      model: station.model,
      effort: station.effort,
      enabled: enabledAt(station, ready, profiles, toolsOnMarks),
    },
  };
};

export const orderAt = ({
  at,
  line,
  denied = [],
  boundSecrets,
  ...launching
}: Ordering & { at: OrderedAt }): RunOrder | null => {
  const launched = launchAt({ ...launching, line, stationId: at.stationId });

  if (!launched) {
    return null;
  }

  const { station, launch } = launched;
  const envSecrets = (launch.enabled.profile?.sandboxEnv ?? []).map(
    ({ secret }) => secret,
  );
  const needed = [
    ...(launch.enabled.profile?.injectedSecrets ?? []),
    ...envSecrets,
  ];
  const named = launch.enabled.profile?.secrets ?? [];
  const bound = boundSecrets.filter((each) =>
    needed.some((name) => name.equals(each.name)),
  );
  const refusals = [
    ...denied,
    ...launch.enabled.refusals,
    ...bound
      .filter(
        (each) =>
          !each.allowsSandbox &&
          envSecrets.some((name) => name.equals(each.name)),
      )
      .map((each) => SecretSandboxNotAllowed.at(station.name, each.name)),
    ...bound
      .filter((each) => each.awaitingValue)
      .map((each) => SecretAwaitingValue.at(station.name, each.name)),
  ];

  return {
    ...launch,
    stationId: station.id,
    priority: RunPriority.forTask(line.depthOf(station.id)),
    placement: line.placementOf(station.id),
    options: line.optionsFrom(station.id),
    resumeOptions: line.resumeOptionsAt(station.id),
    noteLimit: 0,
    resume: at.resume,
    checkouts: at.checkouts,
    diffs: station.diffs,
    check: station.diffs ? station.check : null,
    refusals,
    boundSecrets: bound.filter((each) =>
      named.some((name) => name.equals(each.name)),
    ),
  };
};

export const taskOrderedAt = (task: Task, line: LineMap): OrderedAt => ({
  stationId: task.stationId,
  resume: task.resume(),
  checkouts: checkoutsOf(task, line),
});
