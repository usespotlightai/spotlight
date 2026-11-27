import type {
  CredentialSourceDto,
  RunnerFleetDto,
} from '@runners/application/dto/runner-fleet.dto';
import {
  CredentialSourceResponseDto,
  HostResponseDto,
  LiveRunnerResponseDto,
  OfflineHarnessResponseDto,
  OfflineHostResponseDto,
  PlatformPoolSourceResponseDto,
  RunnerFleetResponseDto,
} from '@runners/presentation/http/dto/runner-fleet.response.dto';

const sourceOf = (dto: CredentialSourceDto) =>
  new CredentialSourceResponseDto(
    dto.kind,
    dto.key,
    dto.kind === 'pool' && dto.platform
      ? new PlatformPoolSourceResponseDto(dto.platform.egress)
      : null,
  );

export const RunnerFleetHttpMapper = {
  toResponse(dto: RunnerFleetDto): RunnerFleetResponseDto {
    return new RunnerFleetResponseDto(
      dto.hosts.map(
        (host) =>
          new HostResponseDto({ ...host, source: sourceOf(host.source) }),
      ),
      dto.runners.map(
        (runner) =>
          new LiveRunnerResponseDto({
            ...runner,
            source: sourceOf(runner.source),
          }),
      ),
      dto.readyToRun,
      dto.offlineHarnesses.map(
        (each) =>
          new OfflineHarnessResponseDto(
            each.harness,
            each.hosts.map(
              (host) => new OfflineHostResponseDto(host.id, host.name),
            ),
            each.since,
          ),
      ),
    );
  },
};
