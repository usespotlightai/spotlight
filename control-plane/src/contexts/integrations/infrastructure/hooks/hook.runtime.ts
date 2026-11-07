import type {
  HookEventInstance,
  HookRuntimePort,
  ListeningHook,
  WrittenStep,
} from '@integrations/application/ports/hook-runtime.port';
import type { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookStepOutcome } from '@integrations/domain/value-objects/hook-step-outcome.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import {
  compileHook,
  type HookIR,
  type HookStepIR,
} from '@integrations/infrastructure/hooks/hook.compile';
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
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface Compiled extends ListeningHook {
  readonly ir: HookIR | null;
}

interface Readable extends Compiled {
  readonly ir: HookIR;
}

const isReadable = (hook: Compiled): hook is Readable => hook.ir !== null;

const REMEMBERED = 256;

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const taskSeen = (instance: HookEventInstance) => ({
  id: instance.task.taskId.value,
  title: instance.task.title,
  url: instance.task.url,
  line: instance.task.line,
  station: instance.task.station,
  stationKey: instance.task.stationKey.value,
  marks: instance.task.marks,
  repositories: instance.task.repositories,
  pullRequest: instance.task.pullRequest,
});

const eventSeen = (instance: HookEventInstance) => ({
  ...instance.event,
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
      each.name,
      { status: each.status, output: sanitizedForCel(outputOf(each)) },
    ]),
  ),
});

const defaultBody = (hook: Readable, instance: HookEventInstance) => ({
  hook: hook.key.value,
  on: instance.on,
  occurrence: instance.occurrence,
  event: eventSeen(instance),
  task: taskSeen(instance),
  run: instance.task.runId ? { id: instance.task.runId.value } : null,
});

const unwritable = (name: string, error: unknown): WrittenStep => ({
  kind: 'unwritable',
  name,
  failure: HookFailure.unwritable(reasoned(error)),
});

export class CompiledHookRuntime implements HookRuntimePort {
  private readonly compiled = new Map<string, Compiled>();

  constructor(
    private readonly hooks: HookDefinitionRepository,
    private readonly expressions: ExpressionEnginePort,
  ) {}

  async listening(
    teamId: TeamId,
    on: HookEventName,
  ): Promise<readonly ListeningHook[]> {
    return (await this.hooks.ofTeam(teamId))
      .filter((hook) => hook.event.name === on)
      .map((hook) => this.compiledOf(hook));
  }

  async hook(hookId: HookDefinitionId): Promise<ListeningHook | null> {
    const hook = await this.hooks.withId(hookId);

    return hook ? this.compiledOf(hook) : null;
  }

  whenHolds(hook: ListeningHook, instance: HookEventInstance): boolean {
    const compiled = hook as Compiled;

    if (!isReadable(compiled)) {
      return false;
    }

    return (
      compiled.ir.when === null ||
      isTrue(compiled.ir.when, celVariablesFor(compiled, instance))
    );
  }

  written(
    hook: ListeningHook,
    step: string,
    instance: HookEventInstance,
    earlier: readonly HookStepOutcome[],
  ): WrittenStep {
    const compiled = hook as Compiled;
    const found = isReadable(compiled)
      ? compiled.ir.steps.find((each) => each.name === step)
      : undefined;

    if (!isReadable(compiled) || !found) {
      return {
        kind: 'unwritable',
        name: step,
        failure: isReadable(compiled)
          ? HookFailure.noLongerAStep()
          : HookFailure.ofBrokenHook(),
      };
    }

    const variables = celVariablesFor(compiled, instance, earlier);

    return found.kind === 'call'
      ? this.call(found, variables)
      : this.request(compiled, found, instance, variables);
  }

  private call(
    step: Extract<HookStepIR, { kind: 'call' }>,
    variables: CelVariables,
  ): WrittenStep {
    try {
      return {
        kind: 'call',
        name: step.name,
        tool: ToolName.of(step.tool),
        with: requiredValueOf(step.with, variables),
      };
    } catch (error) {
      return unwritable(step.name, error);
    }
  }

  private request(
    hook: Readable,
    step: Extract<HookStepIR, { kind: 'request' }>,
    instance: HookEventInstance,
    variables: CelVariables,
  ): WrittenStep {
    try {
      return {
        kind: 'request',
        name: step.name,
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
      return unwritable(step.name, error);
    }
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
          id: hook.id,
          key: hook.key,
          teamId: hook.teamId,
          blocks: read.ir.hook.blocks,
          broken: null,
          written: read.ir.hook,
          ir: read.ir,
        }
      : {
          id: hook.id,
          key: hook.key,
          teamId: hook.teamId,
          blocks: hook.blocks,
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
