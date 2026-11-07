import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';
import {
  ClaimedCheckResponseDto,
  ClaimedCheckStepResponseDto,
  ClaimedRunResponseDto,
  ClaimedWorkResponseDto,
} from '@runs/presentation/http/dto/runner.response.dto';

type ClaimedRun = Extract<ClaimedWorkDto, { kind: 'run' }>['run'];

const wireSpecOf = (run: ClaimedRun): Readonly<Record<string, unknown>> => ({
  ...run.extensions,
  ...run.spec,
  resume: { key: run.workingCopyKey ?? '', ...run.spec.resume },
});

export const ClaimedWorkHttpMapper = {
  toResponse(claimed: ClaimedWorkDto): ClaimedWorkResponseDto {
    if (claimed.kind === 'run') {
      return new ClaimedWorkResponseDto(
        'run',
        new ClaimedRunResponseDto(
          claimed.run.id,
          claimed.run.harness,
          claimed.run.attempt,
          wireSpecOf(claimed.run),
        ),
        null,
      );
    }

    const { check } = claimed;

    return new ClaimedWorkResponseDto(
      'check',
      null,
      new ClaimedCheckResponseDto(
        check.checkId.value,
        check.repeat,
        check.runId.value,
        check.repository,
        check.base,
        check.setup,
        check.command,
        check.steps.map(
          (step) =>
            new ClaimedCheckStepResponseDto(
              step.id,
              step.patch,
              step.stopsOnFailure,
              step.runsSetup,
            ),
        ),
      ),
    );
  },
};
