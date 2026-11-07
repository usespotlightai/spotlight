import type { Line } from '@lines/domain/aggregates/line.aggregate';
import type { Station } from '@lines/domain/entities/station.entity';
import type { ConfigSource } from '@lines/domain/value-objects/config-source.vo';
import type { ReplayCheckPolicy } from '@lines/domain/value-objects/replay-check-policy.vo';
import type { ReviewPolicy } from '@lines/domain/value-objects/review-policy.vo';
import type {
  ConfigSourceRow,
  ReplayCheckRow,
  ReviewsRow,
} from '@lines/infrastructure/persistence/drizzle/schemas/line.schema';
import { stationSearchRow } from '@lines/infrastructure/persistence/drizzle/search-rows';

export const reviewsRow = (policy: ReviewPolicy | null): ReviewsRow | null =>
  policy
    ? {
        start: policy.start,
        mention: policy.mention,
        label: policy.label,
        skip: {
          spotlight: policy.skip.spotlight,
          drafts: policy.skip.drafts,
          authors: [...policy.skip.authors],
        },
      }
    : null;

export const replayCheckRow = (
  policy: ReplayCheckPolicy | null,
): ReplayCheckRow | null =>
  policy
    ? {
        maxRegressions: policy.maxRegressions,
        ceiling: policy.ceiling,
        currency: policy.currency,
        minGain: policy.minGain,
      }
    : null;

export const sourceRow = (
  source: ConfigSource | null,
): ConfigSourceRow | null =>
  source ? { repository: source.repository.value, path: source.path } : null;

export const routeRowsOf = (line: Line) =>
  line.stations.flatMap((each) =>
    each.routes.stations.map((to) => ({
      stationId: each.id.value,
      toStationId: to.value,
    })),
  );

export const toolRowsOf = (line: Line) =>
  line.stations.flatMap((each) =>
    each.tools.map((tool, position) => ({
      stationId: each.id.value,
      tool: tool.value,
      position,
    })),
  );

export const skillRowsOf = (line: Line) =>
  line.stations.flatMap((each) =>
    each.skills.map((skill, position) => ({
      stationId: each.id.value,
      skill: skill.value,
      position,
    })),
  );

export const reactionRowsOf = (line: Line) =>
  line.reactions.map((each) => ({
    lineId: line.id.value,
    happening: each.happening.value,
    fromStationId: each.from?.value ?? null,
    toStationId: each.to.value,
  }));

export const repositoryRowsOf = (line: Line) =>
  line.repositories.entries.map((each) => ({
    lineId: line.id.value,
    repository: each.repository.value,
    image: each.image?.value ?? null,
    setup: each.setup?.value ?? null,
  }));

export const stationColumnsOf = (each: Station) => ({
  key: each.key.value,
  name: each.name.value,
  position: each.position,
  color: each.color.value,
  description: each.description?.value ?? null,
  harness: each.harness?.value ?? null,
  model: each.model?.value ?? null,
  effort: each.effort?.value ?? null,
  profile: each.profile?.value ?? null,
  agentPrompt: each.agentPrompt?.value ?? null,
  check: each.check?.value ?? null,
  runners: [...each.placement.requiredLabels],
  diffs: each.diffs,
  decisions: each.decisions,
  memories: each.memories,
  judge: each.judge
    ? {
        rubric: each.judge.rubric,
        claims: [...each.judge.claims],
        passThreshold: each.judge.passThreshold,
        sample: each.judge.sample,
        minAgreement: each.judge.minAgreement,
      }
    : null,
  alerts: each.alerts.map((alert) => ({
    measure: alert.measure,
    risesBy: alert.risesBy,
    above: alert.above,
    fallsBy: alert.fallsBy,
    below: alert.below,
    over: alert.over,
  })),
  search: stationSearchRow(each.search),
  kind: each.kind,
  finishes: each.routes.ends,
});
