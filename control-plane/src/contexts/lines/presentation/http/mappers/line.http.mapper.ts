import type { LineDto, StationDto } from '@lines/application/dto/line.dto';
import {
  LineResponseDto,
  ReactionResponseDto,
  StationResponseDto,
} from '@lines/presentation/http/dto/line.response.dto';

export const LineHttpMapper = {
  stationToResponse(dto: StationDto): StationResponseDto {
    return new StationResponseDto(
      dto.id,
      dto.key,
      dto.name,
      dto.position,
      dto.color,
      dto.description,
      dto.harness,
      dto.model,
      dto.effort,
      dto.agentPrompt,
      dto.judge,
      dto.alerts,
      dto.search,
      dto.kind,
      dto.skills,
    );
  },

  toResponse(dto: LineDto): LineResponseDto {
    return new LineResponseDto(
      dto.id,
      dto.key,
      dto.name,
      dto.stations.map((each) => LineHttpMapper.stationToResponse(each)),
      dto.reactions.map(
        (each) => new ReactionResponseDto(each.happening, each.from, each.to),
      ),
      dto.repositories,
      dto.source,
      dto.replayCheck,
      dto.search,
    );
  },
};
