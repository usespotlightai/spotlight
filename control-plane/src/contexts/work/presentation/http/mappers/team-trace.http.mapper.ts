import type {
  TeamTraceDto,
  TeamTracesDto,
  TraceStationDto,
} from '@work/application/dto/team-trace.dto';
import {
  TeamTraceResponseDto,
  TeamTracesResponseDto,
  TraceStationResponseDto,
  TraceVolumeBucketResponseDto,
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
  toTracesResponse(dto: TeamTracesDto): TeamTracesResponseDto {
    return new TeamTracesResponseDto(
      dto.range,
      dto.from,
      dto.to,
      dto.volume.map(
        (bucket) =>
          new TraceVolumeBucketResponseDto(
            bucket.from,
            bucket.to,
            bucket.count,
            bucket.faults,
          ),
      ),
      dto.traces.map(TeamTraceHttpMapper.toResponse),
    );
  },
};
