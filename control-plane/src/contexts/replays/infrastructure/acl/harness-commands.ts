import { traceParentOf } from '@platform/telemetry/trace-parent';
import type { RunRequesterContract } from '@runs/application/contracts/run-order.contract';
import {
  type RunSpecShape,
  TRACE_PARENT_VAR,
} from '@runs/application/contracts/run-spec.contract';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import { InvalidEffortError } from '@shared-kernel/domain/exceptions/invalid-effort.error';
import { InvalidHarnessModelError } from '@shared-kernel/domain/exceptions/invalid-harness-model.error';
import { EFFORTS, Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import {
  HARNESS_MODEL_MAX_LENGTH,
  HarnessModel,
} from '@shared-kernel/domain/value-objects/harness-model.vo';

export interface HarnessChoice {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
}

export interface HarnessChoiceProblem {
  readonly field: 'harness' | 'model' | 'effort';
  readonly reason: string;
}

const refusedBy = (
  made: () => unknown,
  refusal: new (...args: never[]) => Error,
): boolean => {
  try {
    made();
    return false;
  } catch (error) {
    if (error instanceof refusal) {
      return true;
    }
    throw error;
  }
};

export class HarnessCommands {
  constructor(private readonly launch: HarnessLaunchPort) {}

  problemOf({
    harness,
    model,
    effort,
  }: HarnessChoice): HarnessChoiceProblem | null {
    const known = this.launch.catalogue().map((each) => each.id);

    if (!known.includes(harness)) {
      return {
        field: 'harness',
        reason: `Harness ${harness} is not one that a runner can start. Harnesses: ${known.join(', ')}`,
      };
    }
    if (
      model !== null &&
      refusedBy(() => HarnessModel.of(model), InvalidHarnessModelError)
    ) {
      return {
        field: 'model',
        reason: `Model must be 1 to ${HARNESS_MODEL_MAX_LENGTH} characters, or empty.`,
      };
    }
    if (
      effort !== null &&
      refusedBy(() => Effort.of(effort), InvalidEffortError)
    ) {
      return {
        field: 'effort',
        reason: `Effort must be one of ${EFFORTS.join(', ')}, or empty.`,
      };
    }

    return null;
  }

  commandFor(
    choice: HarnessChoice,
    requester: RunRequesterContract,
    runId: string,
  ): RunSpecShape['command'] | null {
    if (this.problemOf(choice)) {
      return null;
    }

    const command = this.launch.commandFor(HarnessId.of(choice.harness), {
      model: choice.model ? HarnessModel.of(choice.model) : null,
      effort: choice.effort ? Effort.of(choice.effort) : null,
    });

    return command
      ? {
          ...command,
          env: {
            ...command.env,
            [TRACE_PARENT_VAR]: traceParentOf(
              `${requester.kind}:${requester.id}`,
              runId,
            ),
          },
        }
      : null;
  }
}
