import { Line } from '@work/domain/aggregates/line.aggregate';
import {
  Station,
  type StationInput,
} from '@work/domain/entities/station.entity';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export type CandidateChange = Omit<Partial<StationInput>, 'id'>;

export const candidateOf = (
  line: Line,
  stationId: StationId,
  changed: CandidateChange,
): Line => {
  const current = line.stationAt(stationId);

  if (!current) {
    throw new Error(`the line has no station ${stationId.value}`);
  }

  const candidate = Station.of({
    key: current.key,
    name: current.name,
    position: current.position,
    color: current.color,
    description: current.description,
    harness: current.harness,
    model: current.model,
    effort: current.effort,
    profile: current.profile,
    agentPrompt: current.agentPrompt,
    check: current.check,
    placement: current.placement,
    diffs: current.diffs,
    decisions: current.decisions,
    memories: current.memories,
    judge: current.judge,
    alerts: current.alerts,
    kind: current.kind,
    routes: current.routes,
    tools: current.tools,
    skills: current.skills,
    ...changed,
    id: current.id,
  });

  return Line.rehydrate({
    id: line.id,
    workspaceId: line.workspaceId,
    teamId: line.teamId,
    key: line.key,
    name: line.name,
    stations: line.stations.map((each) =>
      each.id.equals(stationId) ? candidate : each,
    ),
    reactions: line.reactions,
    role: line.role,
    repositories: line.repositories.entries,
    reviews: line.reviews,
    placement: line.placement,
    version: line.version,
  });
};
