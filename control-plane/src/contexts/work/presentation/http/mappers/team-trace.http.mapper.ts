import type {
  TeamTraceDto,
  TraceStationDto,
} from '@work/application/dto/team-trace.dto';
import {
  TeamTraceResponseDto,
  TraceStationResponseDto,
} from '@work/presentation/http/dto/team-trace.response.dto';

const stationToResponse = (station: TraceStationDto): TraceStationResponseDto =>
  new TraceStationResponseDto(
    station.name,
    station.color,
    station.position,
    station.count,
  );

export const TeamTraceHttpMapper = {
  toResponse(dto: TeamTraceDto): TeamTraceResponseDto {
    return new TeamTraceResponseDto(
      dto.taskId,
      dto.title,
      dto.station && stationToResponse(dto.station),
      dto.stations.map(stationToResponse),
      dto.harness,
      dto.state,
      dto.startedAt,
      dto.runs,
      dto.input,
      dto.output,
      dto.ms,
      dto.steps,
      dto.faults,
      dto.cost,
      dto.currency,
    );
  },
};
