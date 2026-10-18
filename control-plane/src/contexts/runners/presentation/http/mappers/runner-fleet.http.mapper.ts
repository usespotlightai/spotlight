import type {
  CredentialSourceDto,
  RunnerFleetDto,
} from '@runners/application/dto/runner-fleet.dto';
import {
  CredentialSourceResponseDto,
  HostResponseDto,
  LiveRunnerResponseDto,
  RunnerFleetResponseDto,
} from '@runners/presentation/http/dto/runner-fleet.response.dto';

const sourceOf = (dto: CredentialSourceDto) =>
  new CredentialSourceResponseDto(dto.kind, dto.key);

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
    );
  },
};
