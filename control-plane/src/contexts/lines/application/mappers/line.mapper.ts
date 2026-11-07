import type { LineDto, StationDto } from '@lines/application/dto/line.dto';
import type {
  LineDetail,
  LineSearchSummary,
  RepositorySummary,
  SearchPolicySummary,
  StationSummary,
} from '@lines/application/ports/line-reader.port';
import type {
  LineSearchPolicy,
  SearchPolicy,
} from '@lines/domain/value-objects/search-policy.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export const LineMapper = {
  lineSearchToSummary(policy: LineSearchPolicy): LineSearchSummary {
    return policy.toPrimitives();
  },

  searchToSummary(policy: SearchPolicy | null): SearchPolicySummary | null {
    return (
      policy && {
        enabled: policy.enabled,
        monthlyCeiling: policy.monthlyCeiling.amount,
        currency: policy.monthlyCeiling.currency,
        ceiling: policy.ceiling.amount,
        period: policy.period.text,
        onAlert: policy.onAlert,
        cooldown: policy.cooldown.text,
        agent: policy.agent?.toPrimitives() ?? null,
        iterations: policy.iterations,
        repeats: policy.repeats,
        objective: policy.objective,
      }
    );
  },

  summaryToDto(summary: StationSummary): StationDto {
    return {
      id: summary.id,
      key: summary.key,
      name: summary.name,
      position: summary.position,
      color: summary.color,
      description: summary.description,
      harness: summary.harness,
      model: summary.model,
      effort: summary.effort,
      agentPrompt: summary.agentPrompt,
      judge: summary.judge
        ? { ...summary.judge, claims: [...summary.judge.claims] }
        : null,
      alerts: summary.alerts.map((each) => ({ ...each })),
      search: summary.search && {
        ...summary.search,
        agent: summary.search.agent && { ...summary.search.agent },
      },
      kind: summary.kind,
      skills: summary.skills,
    };
  },

  repositoryToSummary(repository: Repository): RepositorySummary {
    return {
      fullName: repository.value,
      host: repository.host,
      url: repository.url,
    };
  },

  detailToDto(detail: LineDetail): LineDto {
    return {
      id: detail.id,
      key: detail.key,
      name: detail.name,
      stations: detail.stations.map(LineMapper.summaryToDto),
      reactions: detail.reactions.map((each) => ({ ...each })),
      repositories: detail.repositories.map((each) => ({ ...each })),
      source: detail.source ? { ...detail.source } : null,
      replayCheck: detail.replayCheck ? { ...detail.replayCheck } : null,
      search: { ...detail.search },
    };
  },
};
