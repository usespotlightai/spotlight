import type { ToolCallInputs } from '@integrations/application/dto/declared-tool.dto';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { HookCallsPort } from '@integrations/application/ports/hook-calls.port';
import type {
  HookRequest,
  HookRequestsPort,
} from '@integrations/application/ports/hook-requests.port';
import type {
  HookEventInstance,
  HookRuntimePort,
  StepRequest,
  StepResult,
  WrittenStep,
} from '@integrations/application/ports/hook-runtime.port';
import type {
  CallAttempt,
  IntegrationRuntimePort,
} from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { HookCallbackTokens } from '@integrations/application/services/hook-callback-tokens.service';
import { InvalidToolInputsError } from '@integrations/domain/exceptions/invalid-tool-inputs.error';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import {
  type WaitingHookStep,
  waitExpiredAt,
} from '@integrations/domain/value-objects/hook-step-outcome.vo';
import type { Hook } from '@integrations/domain/value-objects/hook.vo';
import { ToolInputs } from '@integrations/domain/value-objects/tool-inputs.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

type CallStep = Extract<WrittenStep, { kind: 'call' }>;

type RequestStep = Extract<WrittenStep, { kind: 'request' }>;

type Called =
  | { readonly inputs: ToolCallInputs; readonly failure: HookFailure }
  | { readonly inputs: ToolCallInputs; readonly attempt: CallAttempt };

const failedAt = (name: HookStepName, failure: HookFailure): StepResult => ({
  outcome: {
    name,
    status: 'failed',
    code: failure.code,
    reason: failure.reason,
    output: null,
  },
  denyReason: null,
  trace: null,
});

const failureOf = (attempt: CallAttempt, hook: Hook): HookFailure | null => {
  if (attempt.kind === 'answered') {
    return null;
  }

  return attempt.kind === 'timed-out'
    ? HookFailure.tookLongerThan(hook.timeoutSeconds)
    : HookFailure.callFailed(attempt.fact);
};

export class HookSteps {
  constructor(
    private readonly runtime: HookRuntimePort,
    private readonly requests: HookRequestsPort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly integrations: IntegrationRuntimePort,
    private readonly callAuth: CallAuthResolver,
    private readonly callbacks: HookCallbackTokens,
    private readonly calls: HookCallsPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async take(request: StepRequest): Promise<StepResult> {
    const hook = request.hook.written;

    if (!hook) {
      return failedAt(request.step, HookFailure.ofBrokenHook());
    }

    const now = this.clock.now();
    const unstartable = hook.startFailure(request.step, {
      deadline: request.deadline,
      now,
      resuming: request.resuming !== null,
    });

    if (unstartable) {
      return failedAt(request.step, unstartable);
    }

    const step = this.runtime.written(
      request.hook,
      request.step,
      request.instance,
      request.earlier,
    );

    if (step.kind === 'unwritable') {
      return failedAt(step.name, step.failure);
    }

    return step.kind === 'call'
      ? this.called(hook, step, request, now)
      : this.requested(hook, step, request, now);
  }

  async traced(
    instance: HookEventInstance,
    stepResult: StepResult,
  ): Promise<void> {
    const { run } = instance;

    if (!stepResult.trace || !run) {
      return;
    }

    try {
      await this.calls.record(run, stepResult.trace);
    } catch (error) {
      this.logger.warn(
        { err: error, run: run.runId.value, attempt: run.attempt },
        'Could not trace a hook call',
      );
    }
  }

  private async requested(
    hook: Hook,
    step: RequestStep,
    request: StepRequest,
    now: Date,
  ): Promise<StepResult> {
    const sending: HookRequest = {
      hook: request.hook,
      instance: request.instance,
      step: step.name,
      url: step.url.toString(),
      headers: step.headers,
      body: step.body,
      fromNetwork: step.fromNetwork,
      signing: step.signing,
      deadline: request.deadline,
      waitMode: request.waitMode,
    };
    const denial = hook.requestDenial(step.name, step.url);

    if (denial) {
      return this.requests.notSent(sending, denial, now);
    }

    if (request.resuming) {
      return this.resumed(sending, request.resuming, now);
    }

    const { instance } = request;
    const callback = await this.callbacks.issued({
      workspaceId: instance.task.workspaceId,
      taskId: instance.task.taskId,
      hook: request.hook.key,
      firing: instance.firing,
    });

    return this.requests.sent(sending, callback, now);
  }

  private async resumed(
    sending: HookRequest,
    waiting: WaitingHookStep,
    now: Date,
  ): Promise<StepResult> {
    const answered = await this.requests.resumed(sending, waiting, now);

    if (answered) {
      return answered;
    }

    return waitExpiredAt(waiting, now)
      ? this.requests.unanswered(sending, now)
      : { outcome: waiting, denyReason: null, trace: null };
  }

  private async called(
    hook: Hook,
    step: CallStep,
    request: StepRequest,
    started: Date,
  ): Promise<StepResult> {
    const called = await this.calling(hook, step, request);
    const failure =
      'failure' in called ? called.failure : failureOf(called.attempt, hook);
    const output =
      'attempt' in called && called.attempt.kind === 'answered'
        ? called.attempt.output
        : null;
    const ended = this.clock.now();

    return {
      outcome:
        failure === null
          ? { name: step.name, status: 'done', output }
          : {
              name: step.name,
              status: 'failed',
              code: failure.code,
              reason: failure.reason,
              output: null,
            },
      denyReason: null,
      trace: {
        hook: request.hook.key.value,
        step: step.name.value,
        kind: 'call',
        target: step.tool.value,
        request: called.inputs,
        response: failure?.reason ?? output,
        status: null,
        failed: failure !== null,
        startedAt: started,
        ms: Math.max(ended.getTime() - started.getTime(), 0),
      },
    };
  }

  private async calling(
    hook: Hook,
    step: CallStep,
    request: StepRequest,
  ): Promise<Called> {
    const { task } = request.instance;
    const resolved = await this.integrations.tool(
      await this.defined.ofTeam(task.teamId),
      step.tool,
      request.instance.task,
    );
    const denial = hook.callDenial(
      step.tool,
      resolved?.provided ?? null,
      resolved?.integration.actsAs ?? null,
    );

    if (denial || !resolved) {
      return {
        inputs: {},
        failure:
          denial ??
          HookFailure.refusedByPolicy(
            `names ${step.tool.value}, which no integration offers`,
          ),
      };
    }

    let inputs: ToolInputs;

    try {
      inputs = ToolInputs.of(resolved.provided, step.with, (name) =>
        resolved.defaultFor(name),
      );
    } catch (error) {
      if (!(error instanceof InvalidToolInputsError)) {
        throw error;
      }

      return { inputs: {}, failure: HookFailure.unwritable(error.because) };
    }

    const callAuth = await this.callAuth.of(task.teamId, resolved.integration);

    return {
      inputs: inputs.values,
      attempt: await resolved.attempt(
        inputs.values,
        callAuth,
        request.deadline.getTime() - this.clock.now().getTime(),
      ),
    };
  }
}
