import { Station } from '@domain/entities/station.entity';
import { InvalidStationLayoutError } from '@domain/exceptions/invalid-station-layout.error';
import { UnknownHappeningError } from '@domain/exceptions/unknown-happening.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import {
  BUILT_IN_ANALYSIS,
  BUILT_IN_REACTIONS,
  BUILT_IN_STATIONS,
  type StationOpening,
} from '@domain/services/built-in-stations';
import { handoverOptions } from '@domain/services/handover-options';
import type { SourceContribution } from '@domain/services/source-contribution';
import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import type { AnalysisPrompt } from '@domain/value-objects/analysis-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import type { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HandoverOption } from '@domain/value-objects/handover-option.vo';
import type { Happening } from '@domain/value-objects/happening.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { Opener } from '@domain/value-objects/opener.vo';
import { Reaction } from '@domain/value-objects/reaction.vo';
import type { SourceKey } from '@domain/value-objects/source-key.vo';
import type { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class AssemblyLine {
  private constructor(
    readonly id: AssemblyLineId,
    readonly workspaceId: WorkspaceId,
    readonly factoryId: FactoryId,
    /** What it is called in the file that describes it. */
    readonly key: LineKey,
    readonly name: AssemblyLineName,
    readonly stations: readonly Station[],
    /** What a word from outside does to a task this line already has. */
    readonly reactions: readonly Reaction[],
    /** Where a word opens a task for work this line has none for yet. */
    readonly openers: readonly Opener[],
    /** How an analysis of a trace on this line is briefed, or the default. */
    readonly analysis: AnalysisPrompt | null,
  ) {}

  static open(input: {
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    name: AssemblyLineName;
    newId: () => string;
  }): AssemblyLine {
    const named = BUILT_IN_STATIONS;
    const ids = named.map(() => StationId.of(input.newId()));

    // The openings name each other, so the ids exist before any station does.
    const at = (name: string): StationId => {
      const found = named.filter((each) => each.name.value === name);

      if (found.length !== 1) {
        throw new InvalidStationLayoutError(
          `must name one station "${name}", but name ${found.length}`,
        );
      }

      return ids[named.indexOf(found[0] as StationOpening)] as StationId;
    };

    return AssemblyLine.of({
      id: AssemblyLineId.of(input.newId()),
      workspaceId: input.workspaceId,
      factoryId: input.factoryId,
      name: input.name,
      stations: named.map((each, position) =>
        Station.create({
          id: ids[position] as StationId,
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
        }),
      ),
      reactions: BUILT_IN_REACTIONS.map((each) =>
        Reaction.of({ happening: each.happening, to: at(each.to) }),
      ),
      analysis: BUILT_IN_ANALYSIS,
    });
  }

  static of(input: {
    id: AssemblyLineId;
    workspaceId: WorkspaceId;
    factoryId: FactoryId;
    key?: LineKey;
    name: AssemblyLineName;
    stations: readonly Station[];
    reactions?: readonly Reaction[];
    openers?: readonly Opener[];
    analysis?: AnalysisPrompt | null;
  }): AssemblyLine {
    const reactions = input.reactions ?? [];
    const openers = input.openers ?? [];

    AssemblyLine.guardPositionsAreContiguous(input.stations);
    AssemblyLine.guardBacklogStandsFirst(input.stations);
    AssemblyLine.guardCompletedStandsLast(input.stations);
    AssemblyLine.guardEveryPassLandsOnTheLine(input.stations);
    AssemblyLine.guardEveryReactionLandsOnTheLine(input.stations, reactions);
    AssemblyLine.guardNoWordReachesTwoStations(reactions);
    AssemblyLine.guardEveryOpenerLandsOnTheLine(input.stations, openers);
    AssemblyLine.guardNoWordOpensTwoStations(openers);

    return new AssemblyLine(
      input.id,
      input.workspaceId,
      input.factoryId,
      input.key ?? LineKey.from(input.name.value),
      input.name,
      [...input.stations].sort((a, b) => a.position - b.position),
      reactions,
      openers,
      input.analysis ?? null,
    );
  }

  renameStation(stationId: StationId, name: StationName): AssemblyLine {
    return this.withStation(stationId, (station) => station.rename(name));
  }

  repaintStation(stationId: StationId, color: StationColor): AssemblyLine {
    return this.withStation(stationId, (station) => station.repaint(color));
  }

  describeStation(
    stationId: StationId,
    description: StationDescription | null,
  ): AssemblyLine {
    return this.withStation(stationId, (station) =>
      station.describe(description),
    );
  }

  runStationOn(stationId: StationId, harness: HarnessId | null): AssemblyLine {
    return this.withStation(stationId, (station) => station.runsOn(harness));
  }

  instructStation(
    stationId: StationId,
    agentPrompt: AgentPrompt | null,
  ): AssemblyLine {
    return this.withStation(stationId, (station) =>
      station.instruct(agentPrompt),
    );
  }

  /**
   * What this line does with that word for a task standing there. A rule
   * naming the station beats one that applies wherever it stands, so a line
   * can say "comments go to review, but from spec they go back to triage".
   */
  reactionTo(happening: Happening, standingAt: StationId): Reaction | null {
    const applies = this.reactions.filter(
      (each) => each.happening.equals(happening) && each.appliesAt(standingAt),
    );

    return applies.find((each) => !each.isEverywhere) ?? applies[0] ?? null;
  }

  /** Where a word opens a new task when it concerns none, or nothing. */
  opensAt(happening: Happening): Station | null {
    const opener = this.openers.find((each) =>
      each.happening.equals(happening),
    );

    return opener ? (this.stationAt(opener.to) ?? null) : null;
  }

  /**
   * The same line with a chosen source's rules installed: what it opens filed
   * at the backlog, what it moves sent to the station it names. Each is added
   * once, so choosing a tool already listened to changes nothing.
   */
  installing(contribution: SourceContribution): AssemblyLine {
    const opensHere = new Set(this.openers.map((each) => each.happening.value));
    const openers = contribution.opens
      .filter((each) => !opensHere.has(each.value))
      .map((each) => Opener.of({ happening: each, to: this.backlog.id }));

    // One move per word, or the guard would refuse the fork: skip what it has.
    const movesHere = new Set(
      this.reactions
        .filter((each) => each.isEverywhere)
        .map((each) => each.happening.value),
    );
    const reactions = contribution.moves
      .filter((each) => !movesHere.has(each.happening.value))
      .map((each) => {
        const to = this.stationNamed(each.to);

        return to
          ? Reaction.of({ happening: each.happening, to: to.id })
          : null;
      })
      .filter((each): each is Reaction => each !== null);

    if (openers.length === 0 && reactions.length === 0) {
      return this;
    }

    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      stations: this.stations,
      reactions: [...this.reactions, ...reactions],
      openers: [...this.openers, ...openers],
      analysis: this.analysis,
    });
  }

  /** The same line with nothing it did on a source's words: a dropped tool takes its rules with it. */
  withoutRulesFrom(source: SourceKey): AssemblyLine {
    const reactions = this.reactions.filter(
      (each) => !source.raises(each.happening),
    );
    const openers = this.openers.filter(
      (each) => !source.raises(each.happening),
    );

    if (
      reactions.length === this.reactions.length &&
      openers.length === this.openers.length
    ) {
      return this;
    }

    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      key: this.key,
      name: this.name,
      stations: this.stations,
      reactions,
      openers,
      analysis: this.analysis,
    });
  }

  /**
   * Written whole rather than changed one at a time: the rules only make
   * sense together, and are few enough to say again.
   */
  reactsWith(
    reactions: readonly Reaction[],
    raised: readonly Happening[],
  ): AssemblyLine {
    AssemblyLine.guardEveryHappeningIsRaised(reactions, raised);

    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      name: this.name,
      stations: this.stations,
      reactions,
      openers: this.openers,
      analysis: this.analysis,
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

  reorderStations(order: readonly StationId[]): AssemblyLine {
    if (order[0] && !this.backlog.id.equals(order[0])) {
      throw new InvalidStationLayoutError(
        'must leave the backlog standing first',
      );
    }
    if (
      order.length > 0 &&
      !this.completed.id.equals(order[order.length - 1] as StationId)
    ) {
      throw new InvalidStationLayoutError('must leave completed standing last');
    }
    if (order.length !== this.stations.length) {
      throw new InvalidStationLayoutError(
        `must name every station, but named ${order.length} of ${this.stations.length}`,
      );
    }

    const moved = order.map((stationId, position) => {
      const standing = this.stations.find((each) => each.id.equals(stationId));

      if (!standing) {
        throw new UnknownStationError(stationId.value);
      }

      return standing.movedTo(position);
    });

    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      name: this.name,
      reactions: this.reactions,
      openers: this.openers,
      stations: moved,
      analysis: this.analysis,
    });
  }

  private withStation(
    stationId: StationId,
    change: (station: Station) => Station,
  ): AssemblyLine {
    const target = this.stations.find((each) => each.id.equals(stationId));

    if (!target) {
      throw new UnknownStationError(stationId.value);
    }

    return AssemblyLine.of({
      id: this.id,
      workspaceId: this.workspaceId,
      factoryId: this.factoryId,
      name: this.name,
      reactions: this.reactions,
      openers: this.openers,
      stations: this.stations.map((each) =>
        each.equals(target) ? change(each) : each,
      ),
      analysis: this.analysis,
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

  private static guardBacklogStandsFirst(stations: readonly Station[]): void {
    const backlogs = stations.filter((each) => each.isBacklog);

    if (backlogs.length !== 1) {
      throw new InvalidStationLayoutError(
        `must hold one backlog, but hold ${backlogs.length}`,
      );
    }
    if (backlogs[0]?.position !== 0) {
      throw new InvalidStationLayoutError(
        'must open with their backlog, which is where a task waits to start',
      );
    }
  }

  private static guardEveryPassLandsOnTheLine(
    stations: readonly Station[],
  ): void {
    const worked = new Set(
      stations.filter((each) => each.isWorked).map((each) => each.id.value),
    );

    for (const station of stations) {
      if (station.isCompleted && station.wayOut.stations.length > 0) {
        throw new InvalidStationLayoutError(
          'must end where they end, but completed hands on somewhere',
        );
      }

      for (const to of station.wayOut.stations) {
        if (to.equals(station.id)) {
          throw new InvalidStationLayoutError(
            `must not hand on to themselves, but ${station.name.value} does`,
          );
        }
        // Handing a task somewhere nobody works it would strand it.
        if (!worked.has(to.value)) {
          throw new InvalidStationLayoutError(
            `must hand on to a station work is done at, but ${station.name.value} does not`,
          );
        }
      }
    }
  }

  private static guardEveryReactionLandsOnTheLine(
    stations: readonly Station[],
    reactions: readonly Reaction[],
  ): void {
    const standing = new Set(stations.map((each) => each.id.value));

    for (const reaction of reactions) {
      if (!standing.has(reaction.to.value)) {
        throw new InvalidStationLayoutError(
          `must send "${reaction.happening.value}" to a station on the line`,
        );
      }
      if (reaction.from && !standing.has(reaction.from.value)) {
        throw new InvalidStationLayoutError(
          `must wait for "${reaction.happening.value}" at a station on the line`,
        );
      }
    }
  }

  private static guardEveryOpenerLandsOnTheLine(
    stations: readonly Station[],
    openers: readonly Opener[],
  ): void {
    const standing = new Set(stations.map((each) => each.id.value));

    for (const opener of openers) {
      if (!standing.has(opener.to.value)) {
        throw new InvalidStationLayoutError(
          `must open "${opener.happening.value}" at a station on the line`,
        );
      }
    }
  }

  /** A word opening a task in two places at once is a fork nobody can settle. */
  private static guardNoWordOpensTwoStations(openers: readonly Opener[]): void {
    const claimed = new Set<string>();

    for (const opener of openers) {
      if (claimed.has(opener.happening.value)) {
        throw new InvalidStationLayoutError(
          `must open a happening at one station, but two open "${opener.happening.value}"`,
        );
      }
      claimed.add(opener.happening.value);
    }
  }

  /** A word landing in two places at once is a fork nobody can settle. */
  private static guardNoWordReachesTwoStations(
    reactions: readonly Reaction[],
  ): void {
    const claimed = new Set<string>();

    for (const reaction of reactions) {
      // One rule per word for a given standing place, and one for wherever it
      // stands: the named place wins, so the two never collide.
      const at = `${reaction.happening.value}@${reaction.from?.value ?? '*'}`;

      if (claimed.has(at)) {
        throw new InvalidStationLayoutError(
          `must send a happening to one station, but two wait for "${reaction.happening.value}"`,
        );
      }
      claimed.add(at);
    }
  }

  private static guardCompletedStandsLast(stations: readonly Station[]): void {
    const ends = stations.filter((each) => each.isCompleted);

    if (ends.length !== 1) {
      throw new InvalidStationLayoutError(
        `must hold one completed, but hold ${ends.length}`,
      );
    }
    if (ends[0]?.position !== stations.length - 1) {
      throw new InvalidStationLayoutError(
        'must close with completed, which is where a merged task lands',
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

  /**
   * The station standing at this id, asked of the line rather than found in
   * it: a station is the line's to give out, and the line is what knows
   * whether it has one.
   */
  stationAt(stationId: StationId): Station | null {
    return this.stations.find((each) => each.id.equals(stationId)) ?? null;
  }

  private stationNamed(name: string): Station | null {
    return this.stations.find((each) => each.name.value === name) ?? null;
  }

  /** True where this line is the one holding that station. */
  holds(stationId: StationId): boolean {
    return this.stationAt(stationId) !== null;
  }

  /** Where a task standing here may be handed on to, or a person. */
  optionsFrom(stationId: StationId): HandoverOption[] {
    return handoverOptions(this.stationAt(stationId), this.stations);
  }

  equals(other: AssemblyLine): boolean {
    return this.id.equals(other.id);
  }
}
