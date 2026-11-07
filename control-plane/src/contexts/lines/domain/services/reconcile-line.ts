import { Line, type LineLayout } from '@lines/domain/aggregates/line.aggregate';
import { Station } from '@lines/domain/entities/station.entity';
import type { LinePlan } from '@lines/domain/value-objects/line-plan.vo';
import { Reaction } from '@lines/domain/value-objects/reaction.vo';
import { StationRoutes } from '@lines/domain/value-objects/station-routes.vo';
import type { TaskCounts } from '@lines/domain/value-objects/stranded-station';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface LineIdentity {
  readonly id: LineId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
}

export const reconcileLine = (input: {
  existing: Line;
  plan: LinePlan;
  taskCounts: TaskCounts;
  newId: () => string;
  by: ChangeActor;
}): Line => {
  const existingByKey = new Map(
    input.existing.stations.map((each) => [each.key.value, each]),
  );

  return input.existing.update(
    assemble(
      input.plan,
      (key) => existingByKey.get(key.value)?.id ?? null,
      input.newId,
    ),
    input.taskCounts,
    input.by,
  );
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
  existing: (key: StationKey) => StationId | null,
  newId: () => string,
): LineLayout => {
  const idOf = new Map<string, StationId>(
    plan.stations.map((each) => [
      each.key.value,
      existing(each.key) ?? StationId.of(newId()),
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
