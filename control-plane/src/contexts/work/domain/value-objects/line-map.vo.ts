import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import type { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import type {
  MoveDenial,
  PassDenial,
} from '@work/domain/value-objects/line-denial';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import type { Reaction } from '@work/domain/value-objects/reaction.vo';
import type { RepositoryName } from '@work/domain/value-objects/repository-name.vo';
import type { ReviewIntake } from '@work/domain/value-objects/review-intake.vo';
import type { ReviewRequestReceived } from '@work/domain/value-objects/review-request.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { WarmSandboxQuota } from '@work/domain/value-objects/warm-sandbox-quota.vo';

export interface LineMapInput {
  readonly id: LineId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly key: LineKey;
  readonly name: LineName;
  readonly role?: LineRole | null;
  readonly stations: readonly Station[];
  readonly reactions?: readonly Reaction[];
  readonly repositories?: LineRepositories;
  readonly reviews?: ReviewIntake | null;
  readonly placement?: RunnerPlacement;
  readonly warmSandboxes?: WarmSandboxQuota;
  readonly welcomesTeams?: boolean;
}

const topologyProblemOf = (stations: readonly Station[]): string | null => {
  for (const kind of ['backlog', 'completed'] as const) {
    const count = stations.filter((each) => each.kind === kind).length;

    if (count !== 1) {
      return `has ${count} ${kind} stations, not one`;
    }
  }

  const ids = new Set(stations.map((each) => each.id.value));
  const astray = stations.find((each) =>
    each.passesTo.some((target) => !ids.has(target.value)),
  );

  return astray
    ? `passes from ${astray.id.value} to a station it does not have`
    : null;
};

export class LineMap {
  private constructor(
    readonly id: LineId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly key: LineKey,
    readonly name: LineName,
    readonly role: LineRole | null,
    readonly stations: readonly Station[],
    readonly reactions: readonly Reaction[],
    readonly repositories: LineRepositories,
    readonly reviews: ReviewIntake | null,
    readonly placement: RunnerPlacement,
    readonly warmSandboxes: WarmSandboxQuota,
    readonly welcomesTeams: boolean,
  ) {}

  static of(input: LineMapInput): LineMap {
    const stations = [...input.stations].sort(
      (a, b) => a.position - b.position,
    );
    const problem = topologyProblemOf(stations);

    if (problem) {
      throw new InconsistentStateError('line', problem);
    }

    return new LineMap(
      input.id,
      input.workspaceId,
      input.teamId,
      input.key,
      input.name,
      input.role ?? null,
      stations,
      [...(input.reactions ?? [])],
      input.repositories ?? LineRepositories.none(),
      input.reviews ?? null,
      input.placement ?? RunnerPlacement.anywhere(),
      input.warmSandboxes ?? WarmSandboxQuota.NONE,
      input.welcomesTeams ?? false,
    );
  }

  get completed(): Station {
    return this.onlyOf('completed');
  }

  get backlog(): Station {
    return this.onlyOf('backlog');
  }

  get entry(): Station | null {
    return this.stations.find((each) => each.isAgentStation) ?? null;
  }

  get harness(): HarnessId | null {
    return this.entry?.harness ?? null;
  }

  get image(): RunnerImage | null {
    return this.repositories.image;
  }

  get runsIn(): RunnerPlacement {
    return this.placement.in(this.image);
  }

  stationAt(stationId: StationId): Station | null {
    return this.stations.find((each) => each.id.equals(stationId)) ?? null;
  }

  stationKeyed(key: StationKey): Station | null {
    return this.stations.find((each) => each.key.equals(key)) ?? null;
  }

  placementOf(stationId: StationId): RunnerPlacement {
    return RunnerPlacement.forStation(
      this.stationAt(stationId)?.placement ?? null,
      this.placement,
      this.image,
    );
  }

  names(repository: Repository): boolean {
    return this.repositories.names(repository);
  }

  opening(name: RepositoryName | null): Repository {
    return this.repositories.opening(name);
  }

  takesReview(request: ReviewRequestReceived): boolean {
    const repository = request.pullRequest.repository;

    return (
      (this.role?.equals(LineRole.REVIEW) ?? false) &&
      repository !== null &&
      (this.repositories.isEmpty || this.names(repository)) &&
      (this.reviews?.takes(request) ?? false)
    );
  }

  reactionTo(happening: Happening, currentStation: StationId): Reaction | null {
    const applies = this.reactions.filter(
      (each) =>
        each.happening.equals(happening) && each.appliesAt(currentStation),
    );

    return applies.find((each) => !each.isEverywhere) ?? applies[0] ?? null;
  }

  optionsFrom(stationId: StationId): readonly HandoverOption[] {
    const from = this.stationAt(stationId);

    return [
      ...this.stations
        .filter((station) => from && this.passDenial(from.id, station) === null)
        .map((station) => HandoverOption.station(station.key, station.name)),
      HandoverOption.review(),
      ...(from?.ends ? [HandoverOption.done()] : []),
    ];
  }

  passDenial(from: StationId, to: Station): PassDenial | null {
    if (to.id.equals(from)) {
      return 'already-there';
    }
    if (!to.harness) {
      return 'nothing-runs';
    }
    if (!this.stationAt(from)?.routesTo(to.id)) {
      return 'no-route';
    }
    return null;
  }

  moveDenial(from: Station, to: Station): MoveDenial | null {
    if (from.id.equals(to.id)) {
      return null;
    }
    if (from.isCompleted) {
      return 'out-of-completed';
    }

    const starts = from.isBacklog && to.isAgentStation;
    const parks = from.isAgentStation && to.isBacklog;

    return starts || parks || to.isCompleted ? null : 'between-work-stations';
  }

  endsAt(stationId: StationId): boolean {
    return this.stationAt(stationId)?.ends ?? false;
  }

  depthOf(stationId: StationId): number {
    return this.depths().get(stationId.value) ?? 0;
  }

  private depths(): ReadonlyMap<string, number> {
    const byId = new Map(this.stations.map((each) => [each.id.value, each]));
    const depth = new Map<string, number>([[this.backlog.id.value, 0]]);
    const queue: Station[] = [this.backlog];

    while (queue.length > 0) {
      const station = queue.shift() as Station;
      const here = depth.get(station.id.value) as number;

      for (const to of station.passesTo) {
        const next = byId.get(to.value);

        if (next && !depth.has(to.value)) {
          depth.set(to.value, here + 1);
          queue.push(next);
        }
      }
    }

    const depths = this.stations
      .filter((each) => !each.isCompleted)
      .map((each) => depth.get(each.id.value) ?? 0);
    const last = Math.max(0, ...depths) + 1;

    for (const station of this.stations) {
      if (station.isCompleted) {
        depth.set(station.id.value, last);
      }
    }

    return depth;
  }

  private onlyOf(kind: 'backlog' | 'completed'): Station {
    const station = this.stations.find((each) => each.kind === kind);

    if (!station) {
      throw new InconsistentStateError('line', `has no ${kind} station`);
    }

    return station;
  }
}
