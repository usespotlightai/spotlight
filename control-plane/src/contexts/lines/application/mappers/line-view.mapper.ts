import type {
  LineView,
  SearchPolicyView,
  StationView,
} from '@lines/application/contracts/line-view.contract';
import type { ContentHashPort } from '@lines/application/ports/content-hash.port';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import type { Station } from '@lines/domain/entities/station.entity';
import type { SearchPolicy } from '@lines/domain/value-objects/search-policy.vo';

const searchOf = (policy: SearchPolicy | null): SearchPolicyView | null =>
  policy && {
    enabled: policy.enabled,
    monthlyCeiling: policy.monthlyCeiling.amount,
    currency: policy.monthlyCeiling.currency,
    ceiling: policy.ceiling.amount,
    period: policy.period.text,
    periodMilliseconds: policy.period.milliseconds,
    onAlert: policy.onAlert,
    cooldown: policy.cooldown.text,
    cooldownMilliseconds: policy.cooldown.milliseconds,
    agent: policy.agent?.toPrimitives() ?? null,
    iterations: policy.iterations,
    repeats: policy.repeats,
    objective: policy.objective,
  };

const stationOf = (
  line: Line,
  station: Station,
  hash: ContentHashPort,
): StationView => ({
  id: station.id.value,
  key: station.key.value,
  name: station.name.value,
  kind: station.kind,
  position: station.position,
  color: station.color.value,
  description: station.description?.value ?? null,
  passesTo: station.routes.stations.map((each) => each.value),
  ends: station.routes.ends,
  harness: station.harness?.value ?? null,
  model: station.model?.value ?? null,
  effort: station.effort?.value ?? null,
  profile: station.profile?.value ?? null,
  agentPrompt: station.agentPrompt?.value ?? null,
  check: station.check?.value ?? null,
  runners: [...station.placement.requiredLabels],
  diffs: station.diffs,
  decisions: station.decisions,
  memories: station.memories,
  judge: station.judge && {
    rubric: station.judge.rubric,
    claims: [...station.judge.claims],
    passThreshold: station.judge.passThreshold,
    rubricVersion: station.judge.rubricVersion((text) => hash.sha256(text)),
    sample: station.judge.sample,
    minAgreement: station.judge.minAgreement,
  },
  alerts: station.alerts.map((each) => ({
    measure: each.measure,
    risesBy: each.risesBy,
    above: each.above,
    fallsBy: each.fallsBy,
    below: each.below,
    over: each.over,
  })),
  search: searchOf(line.searchPolicy.resolvedFor(station)),
  tools: station.tools.map((each) => each.value),
  skills: station.skills.map((each) => each.value),
});

export const LineViewMapper = {
  of(line: Line, hash: ContentHashPort): LineView {
    return {
      id: line.id.value,
      workspaceId: line.workspaceId.value,
      teamId: line.teamId.value,
      key: line.key.value,
      name: line.name.value,
      role: line.role?.value ?? null,
      runners: [...line.placement.requiredLabels],
      warmSandboxes: line.warmSandboxes.value,
      defaultAssignee: line.defaultAssignee?.email ?? null,
      image: line.repositories.image?.value ?? null,
      repositories: line.repositories.entries.map((each) => ({
        repository: each.repository.value,
        setup: each.setup?.value ?? null,
      })),
      reviews: line.reviews && {
        start: line.reviews.start,
        mention: line.reviews.mention,
        label: line.reviews.label,
        skip: {
          spotlight: line.reviews.skip.spotlight,
          drafts: line.reviews.skip.drafts,
          authors: [...line.reviews.skip.authors],
        },
      },
      replayCheck: line.replayCheck && {
        maxRegressions: line.replayCheck.maxRegressions,
        ceiling: line.replayCheck.ceiling,
        currency: line.replayCheck.currency,
        minGain: line.replayCheck.minGain,
      },
      source: line.source && {
        repository: line.source.repository.value,
        path: line.source.path,
      },
      reactions: line.reactions.map((each) => ({
        happening: each.happening.value,
        from: each.from?.value ?? null,
        to: each.to.value,
      })),
      stations: line.stations.map((each) => stationOf(line, each, hash)),
    };
  },
};
