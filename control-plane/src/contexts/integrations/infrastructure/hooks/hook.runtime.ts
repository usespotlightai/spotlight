import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type {
  HookEventInstance,
  HookRuntimePort,
  ListeningHook,
  StepOutcome,
  StepRequest,
  StepResult,
} from '@integrations/application/ports/hook-runtime.port';
import type {
  IntegrationRuntimePort,
  IntegrationTaskView,
} from '@integrations/application/ports/integration-runtime.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import type { HookFailureCode } from '@integrations/domain/value-objects/hook-failure.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import {
  compileHook,
  type HookIR,
  type HookStepIR,
} from '@integrations/infrastructure/hooks/hook.compile';
import type {
  HookRequest,
  HookRequests,
} from '@integrations/infrastructure/hooks/hook-requests';
import {
  asJson,
  requiredTextOf,
  requiredValueOf,
} from '@integrations/infrastructure/integrations/templating';
import {
  type CelVariables,
  sanitizedForCel,
} from '@platform/expressions/cel-variables';
import type { ExpressionEnginePort } from '@platform/expressions/expression-engine.port';
import { isTrue } from '@platform/expressions/readings';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { JsonValue } from '@shared-kernel/domain/services/json-value';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  ToolDeclaration,
  ToolInputValues,
} from '@work/application/contracts/tools.contract';

interface Compiled extends ListeningHook {
  readonly ir: HookIR | null;
}

interface Readable extends Compiled {
  readonly ir: HookIR;
}

const isReadable = (hook: Compiled): hook is Readable => hook.ir !== null;

const REMEMBERED = 256;

const failedAt = (
  name: string,
  code: HookFailureCode,
  reason: string,
): StepResult => ({
  outcome: { name, status: 'failed', code, reason, output: null },
  denyReason: null,
  trace: null,
});

class StepFailure extends Error {
  constructor(
    readonly code: HookFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'StepFailure';
  }
}

const within = <T>(
  working: Promise<T>,
  ms: number,
  late: Error,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(late), Math.max(ms, 0));
  });

  return Promise.race([working, timedOut]).finally(() => clearTimeout(timer));
};

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const integrationTaskView = (
  instance: HookEventInstance,
): IntegrationTaskView => ({
  taskId: instance.task.taskId,
  workspaceId: instance.task.workspaceId,
  teamId: instance.task.teamId,
  line: instance.task.line,
  station: instance.task.station,
  stationKey: instance.task.stationKey,
  marks: instance.task.marks,
  waiting: null,
});

const taskSeen = (instance: HookEventInstance) => ({
  id: instance.task.taskId,
  title: instance.task.title,
  url: instance.task.url,
  line: instance.task.line,
  station: instance.task.station,
  stationKey: instance.task.stationKey,
  marks: instance.task.marks,
  repositories: instance.task.repositories,
  pullRequest: instance.task.pullRequest,
});

const eventSeen = (instance: HookEventInstance) => ({
  ...instance.event,
  at: instance.at.toISOString(),
});

const outputOf = (outcome: StepOutcome): unknown =>
  outcome.status === 'waiting' ? null : outcome.output;

const celVariablesFor = (
  hook: Readable,
  instance: HookEventInstance,
  earlier: readonly StepOutcome[] = [],
): CelVariables => ({
  event: sanitizedForCel(eventSeen(instance)),
  task: sanitizedForCel(taskSeen(instance)),
  ...(instance.task.runId ? { run: { id: instance.task.runId } } : {}),
  vars: hook.ir.vars,
  hook: { key: hook.key },
  step: Object.fromEntries(
    earlier.map((each) => [
      each.name,
      { status: each.status, output: sanitizedForCel(outputOf(each)) },
    ]),
  ),
});

const defaultBody = (hook: Readable, instance: HookEventInstance) => ({
  hook: hook.key,
  on: instance.on,
  occurrence: instance.occurrence,
  event: eventSeen(instance),
  task: taskSeen(instance),
  run: instance.task.runId ? { id: instance.task.runId } : null,
});

const inputsFor = (
  declared: ToolDeclaration,
  value: unknown,
  defaultFor: (name: string) => unknown,
): ToolInputValues => {
  const fields =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const inputs: Record<string, JsonValue> = {};

  for (const name of Object.keys(fields)) {
    if (!declared.inputs.some((input) => input.name === name)) {
      throw new Error(`${declared.tool} takes no input called ${name}`);
    }
  }

  for (const input of declared.inputs) {
    const value = fields[input.name] ?? defaultFor(input.name) ?? undefined;

    if (value === undefined || value === null || value === '') {
      if (input.required) {
        throw new Error(`${declared.tool} needs its ${input.name} input`);
      }

      continue;
    }

    const schema = InputSchema.of(input.schema);
    const coerced = schema.coerce(value);
    const problem = schema.problemWith(coerced);

    if (problem) {
      throw new Error(
        `${declared.tool} takes ${input.name}, and ${
          problem.at.isRoot
            ? JSON.stringify(coerced)
            : FieldPath.of([input.name, ...problem.at.segments]).rendered
        } ${problem.why}`,
      );
    }

    inputs[input.name] = coerced as JsonValue;
  }

  return inputs;
};

export class CompiledHookRuntime implements HookRuntimePort {
  private readonly compiled = new Map<string, Compiled>();

  constructor(
    private readonly hooks: HookDefinitionRepository,
    private readonly expressions: ExpressionEnginePort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly callAuthResolver: CallAuthResolver,
    private readonly requests: HookRequests,
    private readonly clock: ClockPort,
  ) {}

  async listening(
    teamId: string,
    on: HookEventName,
  ): Promise<readonly ListeningHook[]> {
    return (await this.hooks.ofTeam(TeamId.of(teamId)))
      .filter((hook) => hook.event.name === on)
      .map((hook) => this.compiledOf(hook));
  }

  async hook(hookId: string): Promise<ListeningHook | null> {
    const hook = await this.hooks.withId(HookDefinitionId.of(hookId));

    return hook ? this.compiledOf(hook) : null;
  }

  matches(hook: ListeningHook, instance: HookEventInstance): boolean {
    const compiled = hook as Compiled;

    if (!isReadable(compiled)) {
      return false;
    }
    const variables = celVariablesFor(compiled, instance);

    return compiled.ir.conditions.every((condition) =>
      isTrue(condition, variables),
    );
  }

  async step(stepRequest: StepRequest): Promise<StepResult> {
    const hook = stepRequest.hook as Compiled;

    if (!isReadable(hook)) {
      return failedAt(
        stepRequest.step,
        'broken',
        'belongs to a hook that no longer reads as it was written',
      );
    }
    const step = hook.ir.steps.find((each) => each.name === stepRequest.step);
    const now = this.clock.now();

    if (!step) {
      return failedAt(
        stepRequest.step,
        'broken',
        'is no longer a step of the hook',
      );
    }

    if (stepRequest.resuming === null && now >= stepRequest.deadline) {
      return failedAt(
        step.name,
        'timeout',
        `did not start within the hook's ${hook.timeoutSeconds} seconds`,
      );
    }

    try {
      const variables = celVariablesFor(
        hook,
        stepRequest.instance,
        stepRequest.earlier,
      );

      return step.kind === 'call'
        ? await this.called(hook, step, stepRequest, variables, now)
        : await this.requested(hook, step, stepRequest, variables, now);
    } catch (error) {
      return failedAt(step.name, 'errored', reasoned(error));
    }
  }

  private async requested(
    hook: Readable,
    step: Extract<HookStepIR, { kind: 'request' }>,
    stepRequest: StepRequest,
    variables: CelVariables,
    now: Date,
  ): Promise<StepResult> {
    let url: string;
    let body: string;
    let headers: Record<string, string>;

    try {
      url = requiredTextOf(step.url, variables) ?? '';
      new URL(url);
      headers = Object.fromEntries(
        step.headers.map((header) => [
          header.name,
          requiredTextOf(header.value, variables) ?? '',
        ]),
      );
      body = asJson(
        step.body
          ? requiredValueOf(step.body, variables)
          : defaultBody(hook, stepRequest.instance),
      );
    } catch (error) {
      return failedAt(
        step.name,
        'unwritable',
        `could not be written: ${reasoned(error)}`,
      );
    }

    const request: HookRequest = {
      hook,
      instance: stepRequest.instance,
      step: step.name,
      url,
      headers,
      body,
      fromNetwork: step.fromNetwork,
      signing: hook.ir.signing,
      deadline: stepRequest.deadline,
      waitMode: stepRequest.waitMode,
      resuming: stepRequest.resuming,
    };
    const denial = hook.ir.hook.requestDenial(step.name, new URL(url));

    return denial
      ? this.requests.notSent(request, denial, now)
      : this.requests.sent(request, now);
  }

  private async called(
    hook: Readable,
    step: Extract<HookStepIR, { kind: 'call' }>,
    stepRequest: StepRequest,
    variables: CelVariables,
    started: Date,
  ): Promise<StepResult> {
    const { instance } = stepRequest;
    let inputs: ToolInputValues = {};
    let output: unknown = null;
    let failure: { code: HookFailureCode; reason: string } | null = null;

    try {
      const definitions = await this.defined.ofTeam(
        TeamId.of(instance.task.teamId),
      );
      const resolved = await this.runtime.tool(
        definitions,
        step.tool,
        integrationTaskView(instance),
      );

      const denial = hook.ir.hook.callDenial(
        ToolName.of(step.tool),
        resolved?.provided ?? null,
      );

      if (denial || !resolved) {
        throw new StepFailure(
          denial?.code ?? 'not-allowed',
          denial?.reason ?? `names ${step.tool}, which no integration offers`,
        );
      }

      try {
        inputs = inputsFor(
          resolved.declared,
          requiredValueOf(step.with, variables),
          (name) => resolved.defaultFor(name),
        );
      } catch (error) {
        throw new StepFailure(
          'unwritable',
          `could not be written: ${reasoned(error)}`,
        );
      }

      if (resolved.integration.actsAs.byRequester) {
        throw new StepFailure(
          'not-allowed',
          `names ${step.tool}, which acts as the person who started a task. A hook acts as nobody`,
        );
      }

      const callAuth = await this.callAuthResolver.of(
        TeamId.of(instance.task.teamId),
        resolved.integration,
      );

      output = await within(
        resolved.call(inputs, callAuth),
        stepRequest.deadline.getTime() - this.clock.now().getTime(),
        new StepFailure(
          'timeout',
          `took longer than the hook's ${hook.timeoutSeconds} seconds`,
        ),
      );
    } catch (error) {
      failure = {
        code: error instanceof StepFailure ? error.code : 'tool-failed',
        reason: reasoned(error),
      };
    }

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
        hook: hook.key,
        step: step.name,
        kind: 'call',
        target: step.tool,
        request: inputs,
        response: failure?.reason ?? output,
        status: null,
        failed: failure !== null,
        startedAt: started,
        ms: Math.max(ended.getTime() - started.getTime(), 0),
      },
    };
  }

  private compiledOf(hook: HookDefinition): Compiled {
    const key = `${hook.id.value}@${hook.version}`;
    const known = this.compiled.get(key);

    if (known) {
      return known;
    }

    const read = compileHook(hook.document.fields, this.expressions);
    const compiled: Compiled = read.ok
      ? {
          id: hook.id.value,
          key: hook.key.value,
          teamId: hook.teamId.value,
          blocks: read.ir.hook.blocks,
          timeoutSeconds: read.ir.hook.timeoutSeconds,
          steps: read.ir.steps.map((step) => step.name),
          broken: null,
          written: read.ir.hook,
          ir: read.ir,
        }
      : {
          id: hook.id.value,
          key: hook.key.value,
          teamId: hook.teamId.value,
          blocks: hook.blocks,
          timeoutSeconds: 1,
          steps: [],
          broken: read.problems
            .map((problem) => `${problem.field.rendered} ${problem.reason}`)
            .join('; '),
          written: null,
          ir: null,
        };

    this.compiled.set(key, compiled);

    if (this.compiled.size > REMEMBERED) {
      const [oldest] = this.compiled.keys();
      this.compiled.delete(oldest as string);
    }

    return compiled;
  }
}
