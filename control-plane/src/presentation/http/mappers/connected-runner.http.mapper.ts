import type { ConnectedRunnerDto } from '@application/dto/connected-runner.dto';
import {
  ActiveRunResponseDto,
  ConnectedRunnerResponseDto,
} from '@presentation/http/dto/connected-runner.response.dto';

export const ConnectedRunnerHttpMapper = {
  toResponse(dto: ConnectedRunnerDto): ConnectedRunnerResponseDto {
    return new ConnectedRunnerResponseDto(
      dto.id,
      dto.name,
      dto.pool,
      dto.registeredAt,
      dto.lastSeenAt,
      dto.revokedAt,
      dto.connected,
      dto.currentRun
        ? new ActiveRunResponseDto(dto.currentRun.id, dto.currentRun.state)
        : null,
    );
  },
};
