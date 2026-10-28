import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line, type LineLayout } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LinePlan } from '@work/domain/value-objects/line-plan.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import type { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationRoutes } from '@work/domain/value-objects/station-routes.vo';

export interface Stranded {
  readonly key: string;
  readonly name: string;
  readonly tasks: number;
}

export type TaskCounts = ReadonlyMap<string, number>;

export interface LineIdentity {
  readonly id: LineId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
}

export type Reconciled =
  | { readonly ok: true; readonly line: Line }
  | { readonly ok: false; readonly stranded: readonly Stranded[] };

export const reconcileLine = (input: {
  existing: Line;
  plan: LinePlan;
  taskCounts: TaskCounts;
  newId: () => string;
  by: ChangeActor;
}): Reconciled => {
  const existingByKey = new Map(
    input.existing.stations.map((each) => [each.key.value, each]),
  );
  const planned = new Set(input.plan.stations.map((each) => each.key.value));

  const stranded: Stranded[] = input.existing.stations
    .filter((each) => !planned.has(each.key.value))
    .map((each) => ({
      key: each.key.value,
      name: each.name.value,
      tasks: input.taskCounts.get(each.id.value) ?? 0,
    }))
    .filter((each) => each.tasks > 0);

  if (stranded.length > 0) {
    return { ok: false, stranded };
  }

  return {
    ok: true,
    line: input.existing.update(
      assemble(
        input.plan,
        (key) => existingByKey.get(key)?.id ?? null,
        input.newId,
      ),
      input.by,
    ),
  };
};

export const createLine = (input: {
  identity: LineIdentity;
  plan: LinePlan;
  newId: () => string;
  by: ChangeActor;
}): Line =>
  Line.createFromLayout({
    ...input.identity,
    by: input.by,
    ...assemble(input.plan, () => null, input.newId),
  });

const assemble = (
  plan: LinePlan,
  existing: (key: string) => StationId | null,
  newId: () => string,
): LineLayout => {
  const idOf = new Map<string, StationId>(
    plan.stations.map((each) => [
      each.key.value,
      existing(each.key.value) ?? StationId.of(newId()),
    ]),
  );

  const at = (key: StationKey): StationId => idOf.get(key.value) as StationId;

  const stations = plan.stations.map((planned, position) =>
    Station.of({
      id: idOf.get(planned.key.value) as StationId,
      key: planned.key,
      name: planned.name,
      position,
      color: planned.color,
      description: planned.description,
      kind: planned.kind,
      harness: planned.harness,
      model: planned.model,
      effort: planned.effort,
      profile: planned.profile,
      agentPrompt: planned.agentPrompt,
      check: planned.check,
      placement: planned.placement,
      diffs: planned.diffs,
      decisions: planned.decisions,
      memories: planned.memories,
      judge: planned.judge,
      alerts: planned.alerts,
      search: planned.search,
      tools: planned.tools,
      skills: planned.skills,
      routes: StationRoutes.of({
        stations: planned.passesTo.map((each) => at(each)),
        ends: planned.ends,
      }),
    }),
  );

  return {
    key: plan.key,
    name: plan.name,
    role: plan.role,
    repositories: plan.repositories.entries,
    reviews: plan.reviews,
    placement: plan.placement,
    replayCheck: plan.replayCheck,
    search: plan.search,
    source: plan.source,
    stations,
    reactions: plan.reactions.map((planned) =>
      Reaction.of({
        happening: planned.happening,
        from: planned.from ? at(planned.from) : null,
        to: at(planned.to),
      }),
    ),
  };
};
