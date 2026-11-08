import { InvalidAgentPromptError } from '@lines/domain/exceptions/invalid-agent-prompt.error';
import { InvalidConfigSourceError } from '@lines/domain/exceptions/invalid-config-source.error';
import { InvalidLinePlanError } from '@lines/domain/exceptions/invalid-line-plan.error';
import { InvalidReplayCheckPolicyError } from '@lines/domain/exceptions/invalid-replay-check-policy.error';
import { InvalidRepositorySetupError } from '@lines/domain/exceptions/invalid-repository-setup.error';
import { InvalidReviewPolicyError } from '@lines/domain/exceptions/invalid-review-policy.error';
import { InvalidSearchPolicyError } from '@lines/domain/exceptions/invalid-search-policy.error';
import { InvalidStationAlertError } from '@lines/domain/exceptions/invalid-station-alert.error';
import { InvalidStationCheckError } from '@lines/domain/exceptions/invalid-station-check.error';
import { InvalidStationColorError } from '@lines/domain/exceptions/invalid-station-color.error';
import { InvalidStationDescriptionError } from '@lines/domain/exceptions/invalid-station-description.error';
import { InvalidStationJudgeError } from '@lines/domain/exceptions/invalid-station-judge.error';
import { InvalidEffortError } from '@shared-kernel/domain/exceptions/invalid-effort.error';
import { InvalidHarnessIdError } from '@shared-kernel/domain/exceptions/invalid-harness-id.error';
import { InvalidHarnessModelError } from '@shared-kernel/domain/exceptions/invalid-harness-model.error';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { InvalidLineNameError } from '@shared-kernel/domain/exceptions/invalid-line-name.error';
import { InvalidRepositoryError } from '@shared-kernel/domain/exceptions/invalid-repository.error';
import { InvalidRunnerImageError } from '@shared-kernel/domain/exceptions/invalid-runner-image.error';
import { InvalidRunnerPlacementError } from '@shared-kernel/domain/exceptions/invalid-runner-placement.error';
import { InvalidStationNameError } from '@shared-kernel/domain/exceptions/invalid-station-name.error';
import { InvalidWarmSandboxCountError } from '@shared-kernel/domain/exceptions/invalid-warm-sandbox-count.error';

const DEFINITION_ERRORS = [
  InvalidAgentPromptError,
  InvalidConfigSourceError,
  InvalidEffortError,
  InvalidHarnessIdError,
  InvalidHarnessModelError,
  InvalidIdentifierError,
  InvalidLineNameError,
  InvalidLinePlanError,
  InvalidReplayCheckPolicyError,
  InvalidRepositoryError,
  InvalidRepositorySetupError,
  InvalidReviewPolicyError,
  InvalidRunnerImageError,
  InvalidRunnerPlacementError,
  InvalidSearchPolicyError,
  InvalidStationAlertError,
  InvalidStationCheckError,
  InvalidStationColorError,
  InvalidStationDescriptionError,
  InvalidStationJudgeError,
  InvalidStationNameError,
  InvalidWarmSandboxCountError,
] as const;

export const refusalOf = (error: unknown): Error => {
  if (DEFINITION_ERRORS.some((type) => error instanceof type)) {
    return error as Error;
  }

  throw error;
};
