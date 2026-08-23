import type { AssemblyLineDto } from '@application/dto/assembly-line.dto';
import {
  AssemblyLineResponseDto,
  StationResponseDto,
} from '@presentation/http/dto/assembly-line.response.dto';

export const AssemblyLineHttpMapper = {
  toResponse(dto: AssemblyLineDto): AssemblyLineResponseDto {
    return new AssemblyLineResponseDto(
      dto.id,
      dto.name,
      dto.stations.map(
        (each) => new StationResponseDto(each.id, each.name, each.position),
      ),
    );
  },
};
