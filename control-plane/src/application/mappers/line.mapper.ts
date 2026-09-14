import type { LineDto, StationDto } from '@application/dto/line.dto';
import type {
  LineDetail,
  StationSummary,
} from '@application/ports/line-reader.port';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { Station } from '@domain/entities/station.entity';

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
    };
  },
};
