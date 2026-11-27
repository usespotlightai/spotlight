import { traceParentOf } from '@platform/telemetry/trace-parent';
import {
  type RunCommandShape,
  TRACE_PARENT_VAR,
} from '@runs/application/contracts/run-spec.contract';
import type {
  HarnessChoice,
  HarnessChoiceProblem,
  HarnessCommandsPort,
} from '@runs/application/ports/harness-commands.port';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import { InvalidEffortError } from '@shared-kernel/domain/exceptions/invalid-effort.error';
import { InvalidHarnessModelError } from '@shared-kernel/domain/exceptions/invalid-harness-model.error';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { EFFORTS, Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import {
  HARNESS_MODEL_MAX_LENGTH,
  HarnessModel,
} from '@shared-kernel/domain/value-objects/harness-model.vo';

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

export class HarnessCommands implements HarnessCommandsPort {
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
    trail: string,
    runId: string,
  ): RunCommandShape | null {
    if (this.problemOf(choice)) {
      return null;
    }

    const command = this.launch.commandFor(HarnessId.of(choice.harness), {
      model: nonEmpty(choice.model) ? HarnessModel.of(choice.model) : null,
      effort: nonEmpty(choice.effort) ? Effort.of(choice.effort) : null,
    });

    return command
      ? {
          ...command,
          env: {
            ...command.env,
            [TRACE_PARENT_VAR]: traceParentOf(trail, runId),
          },
        }
      : null;
  }
}
