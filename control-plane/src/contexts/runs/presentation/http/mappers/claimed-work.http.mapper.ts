import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';
import {
  ClaimedCheckResponseDto,
  ClaimedCheckStepResponseDto,
  ClaimedPushDiffResponseDto,
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

    if (claimed.kind === 'diff') {
      const { diff } = claimed;

      return new ClaimedWorkResponseDto(
        'diff',
        null,
        null,
        null,
        new ClaimedPushDiffResponseDto(
          diff.diffId.value,
          diff.repository,
          diff.baseTip,
          diff.head,
        ),
      );
    }

    const { check } = claimed;

    return new ClaimedWorkResponseDto(
      'check',
      null,
      new ClaimedCheckResponseDto(
        check.checkId.value,
        check.recheck,
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
