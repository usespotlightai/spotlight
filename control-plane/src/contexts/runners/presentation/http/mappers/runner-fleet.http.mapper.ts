import type {
  AdmittedThroughDto,
  RunnerFleetDto,
} from '@runners/application/dto/runner-fleet.dto';
import {
  AdmittedThroughResponseDto,
  HostResponseDto,
  LiveRunnerResponseDto,
  RunnerFleetResponseDto,
} from '@runners/presentation/http/dto/runner-fleet.response.dto';

const through = (dto: AdmittedThroughDto) =>
  new AdmittedThroughResponseDto(dto.kind, dto.key);

export const RunnerFleetHttpMapper = {
  toResponse(dto: RunnerFleetDto): RunnerFleetResponseDto {
    return new RunnerFleetResponseDto(
      dto.hosts.map(
        (host) =>
          new HostResponseDto({ ...host, through: through(host.through) }),
      ),
      dto.runners.map(
        (runner) =>
          new LiveRunnerResponseDto({
            ...runner,
            through: through(runner.through),
          }),
      ),
    );
  },
};
