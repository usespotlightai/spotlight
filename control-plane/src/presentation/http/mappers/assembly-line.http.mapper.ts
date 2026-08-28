import type { CustomiseStationCommand } from '@application/commands/customise-station.command';
import type {
  AssemblyLineDto,
  StationDto,
} from '@application/dto/assembly-line.dto';
import {
  AssemblyLineResponseDto,
  StationResponseDto,
} from '@presentation/http/dto/assembly-line.response.dto';
import type { CustomiseStationRequestDto } from '@presentation/http/dto/customise-station.request.dto';

const emptied = (raw: string | null | undefined): string | null | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  return raw !== null && raw.trim().length > 0 ? raw : null;
};

export const AssemblyLineHttpMapper = {
  toStationChanges(
    body: CustomiseStationRequestDto,
  ): CustomiseStationCommand['changes'] {
    return {
      name: body.name,
      color: body.color,
      description: emptied(body.description),
      pool: emptied(body.pool),
      agentPrompt: emptied(body.agentPrompt),
    };
  },

  stationToResponse(dto: StationDto): StationResponseDto {
    return new StationResponseDto(
      dto.id,
      dto.name,
      dto.position,
      dto.color,
      dto.description,
      dto.pool,
      dto.agentPrompt,
    );
  },

  toResponse(dto: AssemblyLineDto): AssemblyLineResponseDto {
    return new AssemblyLineResponseDto(
      dto.id,
      dto.name,
      dto.stations.map(AssemblyLineHttpMapper.stationToResponse),
    );
  },
};
