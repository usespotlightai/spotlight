import type { ConnectedRunnerDto } from '@runners/application/dto/connected-runner.dto';
import { ConnectedRunnerResponseDto } from '@runners/presentation/http/dto/connected-runner.response.dto';

export const ConnectedRunnerHttpMapper = {
  toResponse(dto: ConnectedRunnerDto): ConnectedRunnerResponseDto {
    return new ConnectedRunnerResponseDto(
      dto.id,
      dto.name,
      dto.harnesses,
      dto.registeredAt,
      dto.lastSeenAt,
      dto.revokedAt,
      dto.connected,
    );
  },
};
