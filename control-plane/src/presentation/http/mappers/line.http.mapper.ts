import type { CustomiseStationCommand } from '@application/commands/customise-station.command';
import type { LineDto, StationDto } from '@application/dto/line.dto';
import type { CustomiseStationRequestDto } from '@presentation/http/dto/customise-station.request.dto';
import {
  LineResponseDto,
  ReactionResponseDto,
  StationResponseDto,
} from '@presentation/http/dto/line.response.dto';

const emptied = (raw: string | null | undefined): string | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  return raw !== null && raw.trim().length > 0 ? raw : null;
};

export const LineHttpMapper = {
  toStationChanges(
    body: CustomiseStationRequestDto,
  ): CustomiseStationCommand['changes'] {
    return {
      name: body.name,
      color: body.color,
      description: emptied(body.description),
      harness: emptied(body.harness),
      model: emptied(body.model),
      effort: emptied(body.effort),
      agentPrompt: emptied(body.agentPrompt),
      skills: body.skills,
    };
  },

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
      dto.kind,
      dto.skills,
    );
  },

  toResponse(dto: LineDto): LineResponseDto {
    return new LineResponseDto(
      dto.id,
      dto.key,
      dto.name,
      dto.stations.map(LineHttpMapper.stationToResponse),
      dto.reactions.map(
        (each) => new ReactionResponseDto(each.happening, each.from, each.to),
      ),
      [...dto.repositories],
    );
  },
};
