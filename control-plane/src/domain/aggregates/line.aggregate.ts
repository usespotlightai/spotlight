import { Station } from '@domain/entities/station.entity';
import { InvalidStationLayoutError } from '@domain/exceptions/invalid-station-layout.error';
import { UnknownHappeningError } from '@domain/exceptions/unknown-happening.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import type { LineOpening } from '@domain/services/built-in-lines';
import {
  reactionsRefused,
  stationsRefused,
} from '@domain/services/line-layout';
import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import type { Effort } from '@domain/value-objects/effort.vo';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HandoverOption } from '@domain/value-objects/handover-option.vo';
import type { Happening } from '@domain/value-objects/happening.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import type { LineKey } from '@domain/value-objects/line-key.vo';
import type { LineName } from '@domain/value-objects/line-name.vo';
import { LineRepositories } from '@domain/value-objects/line-repositories.vo';
import type { LineRole } from '@domain/value-objects/line-role.vo';
import { Reaction } from '@domain/value-objects/reaction.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';
import type { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import type { StationKey } from '@domain/value-objects/station-key.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export type PassRefusal = 'standing-there' | 'nothing-runs' | 'no-way';

export class Line {
  private constructor(
    readonly id: LineId,
    readonly workspaceId: WorkspaceId,
    readonly factoryId: FactoryId,
    readonly key: LineKey,
    readonly name: LineName,
    readonly stations: readonly Station[],
    readonly reactions: readonly Reaction[],
    readonly role: LineRole | null,
    readonly repositories: LineRepositories,
  ) {}

  static open(input: {
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    line: LineOpening;
    newId: () => string;
  }): Line {
    const named = input.line.stations;
    const ids = named.map(() => StationId.of(input.newId()));

    // The openings name each other, so the ids exist before any station does.
    const at = (key: StationKey): StationId => {
      const found = named.findIndex((each) => each.key.equals(key));

      if (found < 0) {
        throw new InvalidStationLayoutError(
          `must name one station "${key.value}", but name none`,
        );
      }

      return ids[found] as StationId;
    };

    return Line.of({
      id: LineId.of(input.newId()),
      workspaceId: input.workspaceId,
      factoryId: input.factoryId,
      key: input.line.key,
      name: input.line.name,
      role: input.line.role,
      repositories: input.line.repositories,
      stations: named.map((each, position) =>
        Station.of({
          id: ids[position] as StationId,
          key: each.key,
          name: each.name,
          color: each.color,
          position,
          kind: each.kind,
          agentPrompt: each.agentPrompt,
          wayOut: WayOut.of({
            stations: each.passesTo.map((to) => at(to)),
            ends: each.ends,
          }),
          tools: each.tools,
          skills: each.skills,
        }),
      ),
      reactions: input.line.reactions.map((each) =>
        Reaction.of({ happening: each.happening, to: at(each.to) }),
      ),
    });
  }

  static of(input: {
    id: LineId;
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    key: LineKey;
    name: LineName;
    stations: readonly Station[];
    reactions?: readonly Reaction[];
    role?: LineRole | null;
    repositories?: readonly Repository[];
  }): Line {
    const reactions = input.reactions ?? [];

    Line.guardPositionsAreContiguous(input.stations);

    const stations = [...input.stations].sort(
      (a, b) => a.position - b.position,
    );
    const keyOf = new Map(
      stations.map((each) => [each.id.value, each.key.value]),
    );
    const laid = stationsRefused(
      stations.map((each) => ({
        key: each.key.value,
        name: each.name.value,
        kind: each.kind,
        passesTo: each.wayOut.stations.map((to) => keyOf.get(to.value) ?? ''),
      })),
    );

    if (laid) {
      throw new InvalidStationLayoutError(laid.reason);
    }

    const reacting = reactionsRefused(
      reactions.map((each) => ({
        happening: each.happening.value,
        from: each.from ? (keyOf.get(each.from.value) ?? '') : null,
        to: keyOf.get(each.to.value) ?? '',
      })),
      new Set(keyOf.values()),
    );

    if (reacting) {
      throw new InvalidStationLayoutError(reacting.reason);
    }

    return new Line(
      input.id,
      input.workspaceId,
      input.factoryId,
      input.key,
      input.name,
      stations,
      reactions,
      input.role ?? null,
      LineRepositories.of(input.repositories ?? []),
    );
  }

  repositoryNamed(name: string): Repository | null {
    return this.repositories.named(name);
  }

  worksIn(repositories: readonly Repository[]): Line {
    return Line.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      stations: this.stations,
      reactions: this.reactions,
      role: this.role,
      repositories,
    });
  }

  opening(name: string | null): Repository {
    return this.repositories.opening(name);
  }

  runsOn(harness: HarnessId | null, model: HarnessModel | null): Line {
    return Line.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      stations: this.stations.map((each) =>
        each.isWorked ? each.runsOn(harness, model) : each,
      ),
      reactions: this.reactions,
      role: this.role,
      repositories: this.repositories.all,
    });
  }

  thinksAt(effort: Effort | null): Line {
    return Line.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      stations: this.stations.map((each) =>
        each.isWorked ? each.atEffort(effort) : each,
      ),
      reactions: this.reactions,
      role: this.role,
      repositories: this.repositories.all,
    });
  }

  renameStation(stationId: StationId, name: StationName): Line {
    return this.withStation(stationId, (station) => station.rename(name));
  }

  repaintStation(stationId: StationId, color: StationColor): Line {
    return this.withStation(stationId, (station) => station.repaint(color));
  }

  describeStation(
    stationId: StationId,
    description: StationDescription | null,
  ): Line {
    return this.withStation(stationId, (station) =>
      station.describe(description),
    );
  }

  changeStationHarness(
    stationId: StationId,
    change: { harness?: HarnessId | null; model?: HarnessModel | null },
  ): Line {
    return this.withStation(stationId, (station) =>
      station.runsOn(
        change.harness !== undefined ? change.harness : station.harness,
        change.model !== undefined ? change.model : station.model,
      ),
    );
  }

  setStationEffort(stationId: StationId, effort: Effort | null): Line {
    return this.withStation(stationId, (station) => station.atEffort(effort));
  }

  instructStation(stationId: StationId, agentPrompt: AgentPrompt | null): Line {
    return this.withStation(stationId, (station) =>
      station.instruct(agentPrompt),
    );
  }

  giveStationSkills(stationId: StationId, skills: readonly SkillKey[]): Line {
    return this.withStation(stationId, (station) =>
      station.givesSkills(skills),
    );
  }

  reactionTo(happening: Happening, standingAt: StationId): Reaction | null {
    const applies = this.reactions.filter(
      (each) => each.happening.equals(happening) && each.appliesAt(standingAt),
    );

    return applies.find((each) => !each.isEverywhere) ?? applies[0] ?? null;
  }

  reactsWith(
    reactions: readonly Reaction[],
    raised: readonly Happening[],
  ): Line {
    Line.guardEveryHappeningIsRaised(reactions, raised);

    return Line.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      stations: this.stations,
      reactions,
      role: this.role,
      repositories: this.repositories.all,
    });
  }

  private static guardEveryHappeningIsRaised(
    reactions: readonly Reaction[],
    raised: readonly Happening[],
  ): void {
    const said = new Set(raised.map((each) => each.value));

    for (const reaction of reactions) {
      if (!said.has(reaction.happening.value)) {
        throw new UnknownHappeningError(reaction.happening.value);
      }
    }
  }

  private withStation(
    stationId: StationId,
    change: (station: Station) => Station,
  ): Line {
    const target = this.stations.find((each) => each.id.equals(stationId));

    if (!target) {
      throw new UnknownStationError(stationId.value);
    }

    return Line.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      reactions: this.reactions,
      stations: this.stations.map((each) =>
        each.equals(target) ? change(each) : each,
      ),
      role: this.role,
      repositories: this.repositories.all,
    });
  }

  private static guardPositionsAreContiguous(
    stations: readonly Station[],
  ): void {
    if (stations.length === 0) {
      throw new InvalidStationLayoutError('must number at least one');
    }

    const positions = stations
      .map((each) => each.position)
      .sort((a, b) => a - b);

    if (positions.some((position, index) => position !== index)) {
      throw new InvalidStationLayoutError(
        `must sit at positions 0 to ${stations.length - 1}, but sit at ${positions.join(', ')}`,
      );
    }
  }

  get completed(): Station {
    const standing = this.stations.find((each) => each.isCompleted);

    if (!standing) {
      throw new InvalidStationLayoutError(
        'must hold one completed, but hold 0',
      );
    }

    return standing;
  }

  get backlog(): Station {
    const standing = this.stations.find((each) => each.isBacklog);

    if (!standing) {
      throw new InvalidStationLayoutError('must hold one backlog, but hold 0');
    }

    return standing;
  }

  get worked(): readonly Station[] {
    return this.stations.filter((each) => each.isWorked);
  }

  get entry(): Station | null {
    return this.worked[0] ?? null;
  }

  stationAt(stationId: StationId): Station | null {
    return this.stations.find((each) => each.id.equals(stationId)) ?? null;
  }

  holds(stationId: StationId): boolean {
    return this.stationAt(stationId) !== null;
  }

  optionsFrom(stationId: StationId): HandoverOption[] {
    const from = this.stationAt(stationId);

    return [
      ...this.stations
        .filter(
          (station) => from && this.refusalToPass(from.id, station) === null,
        )
        .map((station) => HandoverOption.station(station.key, station.name)),
      HandoverOption.review(),
      ...(from?.wayOut.ends ? [HandoverOption.done()] : []),
    ];
  }

  refusalToPass(from: StationId, to: Station): PassRefusal | null {
    if (to.id.equals(from)) {
      return 'standing-there';
    }
    if (!to.harness) {
      return 'nothing-runs';
    }
    if (!this.stationAt(from)?.wayOut.leadsTo(to.id)) {
      return 'no-way';
    }
    return null;
  }

  endsAt(stationId: StationId): boolean {
    return this.stationAt(stationId)?.wayOut.ends ?? false;
  }

  depthOf(stationId: StationId): number {
    return this.depths().get(stationId.value) ?? 0;
  }

  private depths(): ReadonlyMap<string, number> {
    const byId = new Map(this.stations.map((each) => [each.id.value, each]));
    const depth = new Map<string, number>([[this.backlog.id.value, 0]]);
    const queue: Station[] = [this.backlog];

    // Breadth-first so rework loops never deepen a station past its shortest path.
    while (queue.length > 0) {
      const station = queue.shift() as Station;
      const here = depth.get(station.id.value) as number;

      for (const to of station.wayOut.stations) {
        const next = byId.get(to.value);

        if (next && !depth.has(to.value)) {
          depth.set(to.value, here + 1);
          queue.push(next);
        }
      }
    }

    const reached = this.stations
      .filter((each) => !each.isCompleted)
      .map((each) => depth.get(each.id.value) ?? 0);
    const last = Math.max(0, ...reached) + 1;

    for (const station of this.stations) {
      if (station.isCompleted) {
        depth.set(station.id.value, last);
      }
    }

    return depth;
  }

  equals(other: Line): boolean {
    return this.id.equals(other.id);
  }
}
