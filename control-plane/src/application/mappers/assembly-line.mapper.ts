import type {
  AssemblyLineDto,
  StationDto,
} from '@application/dto/assembly-line.dto';
import type {
  AssemblyLineDetail,
  StationSummary,
} from '@application/ports/assembly-line-reader.port';
import type { Station } from '@domain/entities/station.entity';

/** Two sources reach the same station shape: the reader answers queries
 *  without going through the domain, while a command answers with the
 *  aggregate it just wrote. They are kept side by side so they stay in step. */
export const AssemblyLineMapper = {
  summaryToDto(summary: StationSummary): StationDto {
    return {
      id: summary.id,
      name: summary.name,
      position: summary.position,
      description: summary.description,
      pool: summary.pool,
      agentPrompt: summary.agentPrompt,
    };
  },

  stationToDto(station: Station): StationDto {
    return {
      id: station.id.value,
      name: station.name.value,
      position: station.position,
      description: station.description?.value ?? null,
      pool: station.pool?.value ?? null,
      agentPrompt: station.agentPrompt?.value ?? null,
    };
  },

  detailToDto(detail: AssemblyLineDetail): AssemblyLineDto {
    return {
      id: detail.id,
      name: detail.name,
      stations: detail.stations.map(AssemblyLineMapper.summaryToDto),
    };
  },
};
