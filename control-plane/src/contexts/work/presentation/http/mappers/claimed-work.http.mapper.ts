import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import {
  ClaimedCheckResponseDto,
  ClaimedCheckStepResponseDto,
  ClaimedRunResponseDto,
  ClaimedWorkResponseDto,
} from '@work/presentation/http/dto/runner.response.dto';

export const ClaimedWorkHttpMapper = {
  toResponse(claimed: ClaimedWorkDto): ClaimedWorkResponseDto {
    if (claimed.kind === 'run') {
      return new ClaimedWorkResponseDto(
        'run',
        new ClaimedRunResponseDto(
          claimed.run.id,
          claimed.run.harness,
          claimed.run.spec,
        ),
        null,
      );
    }

    const { check } = claimed;

    return new ClaimedWorkResponseDto(
      'check',
      null,
      new ClaimedCheckResponseDto(
        check.stackId,
        check.runId,
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
