import type { AssemblyLineDto } from '@application/dto/assembly-line.dto';
import type { AssemblyLineDetail } from '@application/ports/assembly-line-reader.port';

export const AssemblyLineMapper = {
  detailToDto(detail: AssemblyLineDetail): AssemblyLineDto {
    return {
      id: detail.id,
      name: detail.name,
      stations: detail.stations.map((each) => ({
        id: each.id,
        name: each.name,
        position: each.position,
      })),
    };
  },
};
