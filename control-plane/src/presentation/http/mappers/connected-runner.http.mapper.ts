import type { ConnectedRunnerDto } from '@application/dto/connected-runner.dto';
import {
  ActiveRunResponseDto,
  ConnectedRunnerResponseDto,
} from '@presentation/http/dto/connected-runner.response.dto';

export const ConnectedRunnerHttpMapper = {
  toResponse(dto: ConnectedRunnerDto): ConnectedRunnerResponseDto {
    return new ConnectedRunnerResponseDto(
      dto.id,
      dto.pool,
      { ...dto.labels },
      dto.registeredAt,
      dto.lastSeenAt,
      dto.connected,
      dto.currentRun
        ? new ActiveRunResponseDto(dto.currentRun.id, dto.currentRun.state)
        : null,
    );
  },
};
