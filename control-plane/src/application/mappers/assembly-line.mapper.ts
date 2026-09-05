import type {
  AssemblyLineDto,
  StationDto,
} from '@application/dto/assembly-line.dto';
import type {
  AssemblyLineDetail,
  StationSummary,
} from '@application/ports/assembly-line-reader.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Station } from '@domain/entities/station.entity';

export const AssemblyLineMapper = {
  summaryToDto(summary: StationSummary): StationDto {
    return {
      id: summary.id,
      name: summary.name,
      position: summary.position,
      color: summary.color,
      description: summary.description,
      harness: summary.harness,
      agentPrompt: summary.agentPrompt,
      kind: summary.kind,
    };
  },

  stationToDto(station: Station): StationDto {
    return {
      id: station.id.value,
      name: station.name.value,
      position: station.position,
      color: station.color.value,
      description: station.description?.value ?? null,
      harness: station.harness?.value ?? null,
      agentPrompt: station.agentPrompt?.value ?? null,
      kind: station.kind,
    };
  },

  lineToDto(line: AssemblyLine): AssemblyLineDto {
    return {
      id: line.id.value,
      name: line.name.value,
      stations: line.stations.map(AssemblyLineMapper.stationToDto),
      reactions: line.reactions.map((each) => ({
        happening: each.happening.value,
        from: each.from?.value ?? null,
        to: each.to.value,
      })),
    };
  },

  detailToDto(detail: AssemblyLineDetail): AssemblyLineDto {
    return {
      id: detail.id,
      name: detail.name,
      stations: detail.stations.map(AssemblyLineMapper.summaryToDto),
      reactions: detail.reactions.map((each) => ({ ...each })),
    };
  },
};
