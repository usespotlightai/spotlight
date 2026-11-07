import type {
  CompiledHook,
  HookEventInstance,
  HookRuntimePort,
  ListeningHook,
  WrittenStep,
} from '@integrations/application/ports/hook-runtime.port';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import type { HookStepOutcome } from '@integrations/domain/value-objects/hook-step-outcome.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import {
  compileHook,
  type HookIR,
  type HookStepIR,
} from '@integrations/infrastructure/hooks/hook.compile';
import { recordOfEvent } from '@integrations/infrastructure/hooks/hook-event-record';
import {
  asJson,
  requiredTextOf,
  requiredValueOf,
} from '@integrations/infrastructure/integrations/templating';
import type {
  DrizzleHookDefinitionsReader,
  StoredHookDefinition,
} from '@integrations/infrastructure/persistence/drizzle/readers/hook-definitions.reader';
import {
  type CelVariables,
  sanitizedForCel,
} from '@platform/expressions/cel-variables';
import type { ExpressionEnginePort } from '@platform/expressions/expression-engine.port';
import { isTrue } from '@platform/expressions/readings';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface Readable {
  readonly key: HookKey;
  readonly ir: HookIR;
}

const REMEMBERED = 256;

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const taskSeen = (instance: HookEventInstance) => ({
  id: instance.task.taskId.value,
  title: instance.task.title,
  url: instance.task.url,
  line: instance.task.line.value,
  station: instance.task.station.value,
  stationKey: instance.task.stationKey.value,
  marks: instance.task.marks,
  repositories: instance.task.repositories.map((each) => each.value),
  pullRequest: instance.task.pullRequest?.value ?? null,
});

const eventSeen = (instance: HookEventInstance) => ({
  ...recordOfEvent(instance.event),
  at: instance.at.toISOString(),
});

const outputOf = (outcome: HookStepOutcome): unknown =>
  outcome.status === 'waiting' ? null : outcome.output;

const celVariablesFor = (
  hook: Readable,
  instance: HookEventInstance,
  earlier: readonly HookStepOutcome[] = [],
): CelVariables => ({
  event: sanitizedForCel(eventSeen(instance)),
  task: sanitizedForCel(taskSeen(instance)),
  ...(instance.task.runId ? { run: { id: instance.task.runId.value } } : {}),
  vars: hook.ir.vars,
  hook: { key: hook.key.value },
  step: Object.fromEntries(
    earlier.map((each) => [
      each.name.value,
      { status: each.status, output: sanitizedForCel(outputOf(each)) },
    ]),
  ),
});

const defaultBody = (hook: Readable, instance: HookEventInstance) => ({
  hook: hook.key.value,
  on: instance.on,
  occurrence: instance.occurrence.value,
  event: eventSeen(instance),
  task: taskSeen(instance),
  run: instance.task.runId ? { id: instance.task.runId.value } : null,
});

const unwritable = (name: HookStepName, error: unknown): WrittenStep => ({
  kind: 'unwritable',
  name,
  failure: HookFailure.unwritable(reasoned(error)),
});

export class CompiledHookRuntime implements HookRuntimePort {
  private readonly compiled = new Map<string, ListeningHook>();

  private readonly irs = new WeakMap<CompiledHook, HookIR>();

  constructor(
    private readonly hooks: DrizzleHookDefinitionsReader,
    private readonly expressions: ExpressionEnginePort,
  ) {}

  async listening(
    teamId: TeamId,
    on: HookEventName,
  ): Promise<readonly ListeningHook[]> {
    return (await this.hooks.listening(teamId, on)).map((hook) =>
      this.compiledOf(hook),
    );
  }

  async hook(hookId: HookDefinitionId): Promise<ListeningHook | null> {
    const hook = await this.hooks.withId(hookId);

    return hook ? this.compiledOf(hook) : null;
  }

  whenHolds(hook: ListeningHook, instance: HookEventInstance): boolean {
    const compiled = this.readableOf(hook);

    if (!compiled) {
      return false;
    }

    return (
      compiled.ir.when === null ||
      isTrue(compiled.ir.when, celVariablesFor(compiled, instance))
    );
  }

  written(
    hook: ListeningHook,
    step: HookStepName,
    instance: HookEventInstance,
    earlier: readonly HookStepOutcome[],
  ): WrittenStep {
    const compiled = this.readableOf(hook);
    const found = compiled?.ir.steps.find((each) => each.name === step.value);

    if (!compiled || !found) {
      return {
        kind: 'unwritable',
        name: step,
        failure: compiled
          ? HookFailure.noLongerAStep()
          : HookFailure.ofBrokenHook(),
      };
    }

    const variables = celVariablesFor(compiled, instance, earlier);

    return found.kind === 'call'
      ? this.call(step, found, variables)
      : this.request(step, compiled, found, instance, variables);
  }

  private call(
    name: HookStepName,
    step: Extract<HookStepIR, { kind: 'call' }>,
    variables: CelVariables,
  ): WrittenStep {
    try {
      return {
        kind: 'call',
        name,
        tool: ToolName.of(step.tool),
        with: requiredValueOf(step.with, variables),
      };
    } catch (error) {
      return unwritable(name, error);
    }
  }

  private request(
    name: HookStepName,
    hook: Readable,
    step: Extract<HookStepIR, { kind: 'request' }>,
    instance: HookEventInstance,
    variables: CelVariables,
  ): WrittenStep {
    try {
      return {
        kind: 'request',
        name,
        url: new URL(requiredTextOf(step.url, variables) ?? ''),
        headers: Object.fromEntries(
          step.headers.map((header) => [
            header.name,
            requiredTextOf(header.value, variables) ?? '',
          ]),
        ),
        body: asJson(
          step.body
            ? requiredValueOf(step.body, variables)
            : defaultBody(hook, instance),
        ),
        fromNetwork: step.fromNetwork,
        signing: hook.ir.signing,
      };
    } catch (error) {
      return unwritable(name, error);
    }
  }

  private readableOf(hook: ListeningHook): Readable | null {
    const ir = hook.compiled ? this.irs.get(hook.compiled) : undefined;

    return ir ? { key: hook.key, ir } : null;
  }

  private compiledOf(hook: StoredHookDefinition): ListeningHook {
    const key = `${hook.id.value}@${hook.version}`;
    const known = this.compiled.get(key);

    if (known) {
      return known;
    }

    const read = compileHook(hook.document, this.expressions);
    let compiled: ListeningHook;

    if (read.ok) {
      const handle = Object.freeze({}) as CompiledHook;

      this.irs.set(handle, read.ir);
      compiled = {
        id: hook.id,
        key: hook.key,
        teamId: hook.teamId,
        blocks: read.ir.hook.blocks,
        broken: null,
        written: read.ir.hook,
        compiled: handle,
      };
    } else {
      compiled = {
        id: hook.id,
        key: hook.key,
        teamId: hook.teamId,
        blocks: hook.blocks,
        broken: read.problems
          .map((problem) => `${problem.field.rendered} ${problem.reason}`)
          .join('; '),
        written: null,
        compiled: null,
      };
    }

    this.compiled.set(key, compiled);

    if (this.compiled.size > REMEMBERED) {
      const [oldest] = this.compiled.keys();
      this.compiled.delete(oldest as string);
    }

    return compiled;
  }
}
