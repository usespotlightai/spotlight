import type { LineDto, StationDto } from '@work/application/dto/line.dto';
import type {
  LineDetail,
  StationSummary,
} from '@work/application/ports/line-reader.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';

export const LineMapper = {
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
      judge: summary.judge ? { ...summary.judge } : null,
      alerts: summary.alerts.map((each) => ({ ...each })),
      kind: summary.kind,
      skills: summary.skills,
    };
  },

  stationToDto(station: Station): StationDto {
    return {
      id: station.id.value,
      key: station.key.value,
      name: station.name.value,
      position: station.position,
      color: station.color.value,
      description: station.description?.value ?? null,
      harness: station.harness?.value ?? null,
      model: station.model?.value ?? null,
      effort: station.effort?.value ?? null,
      agentPrompt: station.agentPrompt?.value ?? null,
      judge: station.judge
        ? {
            rubric: station.judge.rubric,
            sample: station.judge.sample,
            trust: station.judge.trust,
          }
        : null,
      alerts: station.alerts.map((each) => ({
        measure: each.measure,
        risesBy: each.risesBy,
        above: each.above,
        fallsBy: each.fallsBy,
        below: each.below,
        over: each.over,
      })),
      kind: station.kind,
      skills: station.skills.map((each) => each.value),
    };
  },

  lineToDto(line: Line): LineDto {
    return {
      id: line.id.value,
      key: line.key.value,
      name: line.name.value,
      stations: line.stations.map(LineMapper.stationToDto),
      reactions: line.reactions.map((each) => ({
        happening: each.happening.value,
        from: each.from?.value ?? null,
        to: each.to.value,
      })),
      repositories: line.repositories.all.map((each) => each.value),
      source: line.source
        ? { repository: line.source.repository.value, path: line.source.path }
        : null,
      replayCheck: line.replayCheck
        ? {
            mostRegressions: line.replayCheck.mostRegressions,
            ceiling: line.replayCheck.ceiling,
            currency: line.replayCheck.currency,
          }
        : null,
    };
  },

  detailToDto(detail: LineDetail): LineDto {
    return {
      id: detail.id,
      key: detail.key,
      name: detail.name,
      stations: detail.stations.map(LineMapper.summaryToDto),
      reactions: detail.reactions.map((each) => ({ ...each })),
      repositories: detail.repositories,
      source: detail.source ? { ...detail.source } : null,
      replayCheck: detail.replayCheck ? { ...detail.replayCheck } : null,
    };
  },
};
