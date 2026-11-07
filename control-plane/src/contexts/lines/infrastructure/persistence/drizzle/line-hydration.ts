import { Line } from '@lines/domain/aggregates/line.aggregate';
import { Station } from '@lines/domain/entities/station.entity';
import { AgentPrompt } from '@lines/domain/value-objects/agent-prompt.vo';
import { ConfigSource } from '@lines/domain/value-objects/config-source.vo';
import { LineRepositoryConfig } from '@lines/domain/value-objects/line-repository-config.vo';
import { Reaction } from '@lines/domain/value-objects/reaction.vo';
import { ReplayCheckPolicy } from '@lines/domain/value-objects/replay-check-policy.vo';
import { RepositorySetup } from '@lines/domain/value-objects/repository-setup.vo';
import { ReviewPolicy } from '@lines/domain/value-objects/review-policy.vo';
import { StationAlert } from '@lines/domain/value-objects/station-alert.vo';
import { StationCheck } from '@lines/domain/value-objects/station-check.vo';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { StationDescription } from '@lines/domain/value-objects/station-description.vo';
import { StationJudge } from '@lines/domain/value-objects/station-judge.vo';
import { StationRoutes } from '@lines/domain/value-objects/station-routes.vo';
import {
  line,
  lineReaction,
  lineRepository,
  station,
  stationRoute,
  stationSkill,
  stationTool,
} from '@lines/infrastructure/persistence/drizzle/schemas/line.schema';
import {
  lineSearchOf,
  stationSearchOf,
} from '@lines/infrastructure/persistence/drizzle/search-rows';
import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { inArray } from 'drizzle-orm';

export type LineRow = typeof line.$inferSelect;
type StationRow = typeof station.$inferSelect;

type Ways = {
  routes: Map<string, StationId[]>;
  tools: Map<string, Tool[]>;
  skills: Map<string, SkillKey[]>;
};

const toStation = (row: StationRow, ways: Ways): Station =>
  Station.of({
    key: StationKey.of(row.key),
    id: StationId.of(row.id),
    name: StationName.of(row.name),
    position: row.position,
    color: StationColor.of(row.color),
    description: row.description
      ? StationDescription.of(row.description)
      : null,
    harness: row.harness ? HarnessId.of(row.harness) : null,
    model: row.model ? HarnessModel.of(row.model) : null,
    effort: row.effort ? Effort.of(row.effort) : null,
    profile: row.profile ? ProfileKey.of(row.profile) : null,
    agentPrompt: row.agentPrompt ? AgentPrompt.of(row.agentPrompt) : null,
    check: row.check ? StationCheck.of(row.check) : null,
    placement: RunnerPlacement.of(row.runners),
    diffs: row.diffs,
    decisions: row.decisions,
    memories: row.memories,
    judge: row.judge
      ? StationJudge.of({
          rubric: row.judge.rubric,
          claims: row.judge.claims.length > 0 ? row.judge.claims : null,
          passThreshold:
            row.judge.claims.length > 0 ? row.judge.passThreshold : null,
          sample: row.judge.sample,
          minAgreement: row.judge.minAgreement,
        })
      : null,
    alerts: row.alerts.map((each) => StationAlert.of(each)),
    search: stationSearchOf(row.search),
    kind: row.kind,
    routes: StationRoutes.of({
      stations: ways.routes.get(row.id) ?? [],
      ends: row.finishes,
    }),
    tools: ways.tools.get(row.id) ?? [],
    skills: ways.skills.get(row.id) ?? [],
  });

const toLine = (
  line: LineRow,
  stations: readonly StationRow[],
  ways: Ways,
  reactions: readonly Reaction[],
  repositories: readonly LineRepositoryConfig[],
): Line =>
  Line.rehydrate({
    id: LineId.of(line.id),
    workspaceId: WorkspaceId.of(line.workspaceId),
    teamId: TeamId.of(line.teamId),
    key: LineKey.of(line.key),
    name: LineName.of(line.name),
    stations: stations.map((row) => toStation(row, ways)),
    reactions,
    role: line.role ? LineRole.of(line.role) : null,
    reviews: line.reviews ? ReviewPolicy.of(line.reviews) : null,
    replayCheck: line.replayCheck
      ? ReplayCheckPolicy.of(line.replayCheck)
      : null,
    search: lineSearchOf(line.search),
    source: line.source ? ConfigSource.of(line.source) : null,
    placement: RunnerPlacement.of(line.runners),
    repositories,
    version: line.version,
  });

const waysOf = async (
  context: DrizzleContext,
  stations: readonly StationRow[],
): Promise<Ways> => {
  const stationIds = stations.map((each) => each.id);
  const ways: Ways = {
    routes: new Map(),
    tools: new Map(),
    skills: new Map(),
  };

  if (stationIds.length === 0) {
    return ways;
  }

  const routes = await context.db
    .select()
    .from(stationRoute)
    .where(inArray(stationRoute.stationId, stationIds));

  for (const row of routes) {
    const found = ways.routes.get(row.stationId) ?? [];
    found.push(StationId.of(row.toStationId));
    ways.routes.set(row.stationId, found);
  }

  const tools = await context.db
    .select()
    .from(stationTool)
    .where(inArray(stationTool.stationId, stationIds))
    .orderBy(stationTool.position);

  for (const row of tools) {
    const found = ways.tools.get(row.stationId) ?? [];
    found.push(Tool.of(row.tool));
    ways.tools.set(row.stationId, found);
  }

  const skills = await context.db
    .select()
    .from(stationSkill)
    .where(inArray(stationSkill.stationId, stationIds))
    .orderBy(stationSkill.position);

  for (const row of skills) {
    const found = ways.skills.get(row.stationId) ?? [];
    found.push(SkillKey.of(row.skill));
    ways.skills.set(row.stationId, found);
  }

  return ways;
};

export const hydratedLines = async (
  context: DrizzleContext,
  rows: readonly LineRow[],
): Promise<Line[]> => {
  if (rows.length === 0) {
    return [];
  }

  const lineIds = rows.map((each) => each.id);
  const stations = await context.db
    .select()
    .from(station)
    .where(inArray(station.lineId, lineIds))
    .orderBy(station.position);
  const ways = await waysOf(context, stations);
  const reactions = await context.db
    .select()
    .from(lineReaction)
    .where(inArray(lineReaction.lineId, lineIds));
  const repositories = await context.db
    .select()
    .from(lineRepository)
    .where(inArray(lineRepository.lineId, lineIds));

  return rows.map((row) =>
    toLine(
      row,
      stations.filter((each) => each.lineId === row.id),
      ways,
      reactions
        .filter((each) => each.lineId === row.id)
        .map((each) =>
          Reaction.of({
            happening: Happening.of(each.happening),
            from: each.fromStationId ? StationId.of(each.fromStationId) : null,
            to: StationId.of(each.toStationId),
          }),
        ),
      repositories
        .filter((each) => each.lineId === row.id)
        .map((each) =>
          LineRepositoryConfig.of(Repository.of(each.repository), {
            image: each.image ? RunnerImage.of(each.image) : null,
            setup: each.setup ? RepositorySetup.of(each.setup) : null,
          }),
        ),
    ),
  );
};
