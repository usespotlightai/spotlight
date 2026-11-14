import type {
  EgressEnforcement,
  JournalStep,
  RunMarks,
  StepChange,
  StepLocation,
} from '@runs/application/contracts/run-journal.contract';
import type { CalledStep } from '@runs/domain/services/tool-attribution';
import { AgentTurns } from '@runs/domain/value-objects/agent-turns.vo';
import {
  AGENT_REMINDED,
  AGENT_STOPPED,
  BACKGROUND_LOST,
  BACKGROUND_SETTLED,
  BACKGROUND_WAITING,
  EGRESS_CHECKED,
  HARNESS_CONNECTED,
  HOOK_CALLED,
  PROVISION_FAILED,
  RUN_PAUSED,
  TOOL_REFUSED,
} from '@runs/domain/value-objects/journal-entry-type';
import { Money } from '@runs/domain/value-objects/money.vo';
import type { SpentReading } from '@runs/domain/value-objects/run-usage.vo';
import type { StepKind } from '@runs/domain/value-objects/step-kind';
import { Tokens } from '@runs/domain/value-objects/tokens.vo';
import {
  backgroundWorkIn,
  type WaitEnded,
} from '@runs/infrastructure/journal/background-work';
import {
  controlPlaneFactsOf,
  journalEntryText,
} from '@runs/infrastructure/journal/control-plane-facts';
import { enforcementOf } from '@runs/infrastructure/journal/egress-enforcement';
import {
  type AgentMessage,
  type BackgroundItem,
  type ChildChanged,
  type ChildMessage,
  type ContextChanged,
  type FileChange,
  type HarnessEvent,
  harnessConnectedOf,
  harnessEventOf,
  type PlanEntry,
  type ToolChanged,
  type ToolLocation,
  type SessionStateName,
  type ToolOutput,
  type TurnStarted,
  type TurnUsage,
} from '@runs/infrastructure/journal/harness-events';
import {
  callEndingOf,
  harnessToolOf,
  readingPaths,
  requestedSkillOf,
} from '@runs/infrastructure/journal/harness-tools';
import {
  decoded,
  type Journalled,
} from '@runs/infrastructure/journal/journalled';

const countOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;

const DETAIL_LIMIT = 4_000;

const priced = (cost: ContextChanged['cost']): Money | null =>
  cost?.currency && Money.isCurrency(cost.currency)
    ? Money.maybe(cost.amount, cost.currency)
    : null;

const unfenced = (text: string): string => {
  const lines = text.split('\n');
  const opens = lines[0]?.trimEnd().startsWith('```');
  const closes = lines[lines.length - 1]?.trim() === '```';

  if (!opens) {
    return text;
  }

  return lines
    .slice(1, closes ? -1 : undefined)
    .join('\n')
    .trim();
};

const changed = (
  files: readonly FileChange[] | undefined,
): StepChange | null => {
  const file = files?.[0];

  return file
    ? {
        path: file.path,
        before: (file.before ?? '').slice(0, DETAIL_LIMIT),
        after: (file.after ?? '').slice(0, DETAIL_LIMIT),
      }
    : null;
};

const changedOnce = (call: ToolChanged): StepChange | null =>
  call.status === 'completed' ? changed(call.files) : null;

const locationsOf = (
  locations: readonly ToolLocation[] | undefined,
): StepLocation[] =>
  (locations ?? []).flatMap((each) =>
    each.path ? [{ path: each.path, line: each.line ?? null }] : [],
  );

const written = (raw: unknown): string | null => {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === 'string') {
    return raw.slice(0, DETAIL_LIMIT) || null;
  }

  try {
    return JSON.stringify(raw, null, 2).slice(0, DETAIL_LIMIT);
  } catch {
    return null;
  }
};

interface HookCalled {
  readonly hook?: string;
  readonly step?: string;
  readonly target?: string;
  readonly request?: unknown;
  readonly response?: unknown;
  readonly failed?: boolean;
  readonly startedAt?: string;
  readonly ms?: number;
}

const startedAt = (called: HookCalled, fallback: Date): Date => {
  const at = called.startedAt ? new Date(called.startedAt) : fallback;

  return Number.isNaN(at.getTime()) ? fallback : at;
};

const inPlace = (
  steps: readonly JournalStep[],
  step: JournalStep,
): JournalStep[] => {
  const at = steps.findIndex((each) => each.startedAt > step.startedAt);

  return at === -1
    ? [...steps, step]
    : [...steps.slice(0, at), step, ...steps.slice(at)];
};

const planned = (entries: readonly PlanEntry[]): string =>
  entries
    .map((each) => {
      const status = each.status ? `[${each.status}] ` : '';
      return `${status}${each.content}`.trim();
    })
    .filter(Boolean)
    .join('\n');

interface Building {
  id: string | null;
  kind: StepKind;
  text: string;
  status: string | null;
  tool: string | null;
  named: string | null;
  detail: string | null;
  locations: StepLocation[];
  input: string | null;
  output: string | null;
  change: StepChange | null;
  startedAt: Date;
  workingAt: Date | null;
  endedAt: Date;
}

const bare = (kind: StepKind, text: string, at: Date): Building => ({
  id: null,
  kind,
  text,
  status: null,
  tool: null,
  named: null,
  detail: null,
  locations: [],
  input: null,
  output: null,
  change: null,
  startedAt: at,
  workingAt: null,
  endedAt: at,
});

const WORKING = 'in_progress';

const ENDED_STATUSES = new Set(['completed', 'failed']);

interface RefusedCall {
  readonly toolCallId?: unknown;
}

const WAIT_ENDS: Readonly<
  Record<
    WaitEnded,
    { status: string; detail: (still: string) => string | null }
  >
> = {
  settled: { status: 'completed', detail: () => null },
  'handed-over': { status: 'completed', detail: () => null },
  limit: {
    status: 'completed',
    detail: (still) => `Still running at the wait limit: ${still}`,
  },
  message: { status: 'completed', detail: () => 'A person sent a message.' },
  stopped: { status: 'completed', detail: () => 'The run stopped waiting.' },
  gone: { status: 'failed', detail: () => 'The agent stopped.' },
};

const tasksIn = (data: string | null): readonly string[] =>
  backgroundWorkIn(data).tasks;

const subagentStatusOf = (changed: ChildChanged): string | null => {
  if (!changed.state) {
    return null;
  }
  if (changed.state !== 'idle') {
    return 'running';
  }
  return changed.stop === 'failed' || changed.stop === 'cancelled'
    ? 'failed'
    : 'completed';
};

const NOTIFIED = new Set<HarnessEvent['type']>([
  'message',
  'tool.changed',
  'tool.output',
  'plan.changed',
  'context.changed',
  'child.changed',
  'child.message',
]);

const transcriptOf = (steps: readonly JournalStep[]): string | null =>
  steps
    .flatMap((step) => {
      if (step.kind === 'tool') {
        return [`- ${step.text}`];
      }
      return step.kind === 'message' && step.text ? [step.text] : [];
    })
    .join('\n')
    .slice(0, DETAIL_LIMIT) || null;

export class JournalBuilder {
  #steps: Building[] = [];
  #hooks: JournalStep[] = [];
  #tools = new Map<string, number>();
  #printed = new Map<string, string>();
  #refused = new Set<string>();
  #textStep: Building | null = null;
  #textId: string | null = null;
  #spent: SpentReading | null = null;
  #egressEnforcement: EgressEnforcement | null = null;
  #spentBySession = new Map<string, SpentReading>();
  #tokens = Tokens.UNREPORTED;
  #first: Date | null = null;
  #last: Date | null = null;
  #notifiedAt: Date[] = [];
  #pausedAt: Date[] = [];
  #opened: Date | null = null;
  #ready: Date | null = null;
  #agentStopped: Date | null = null;
  #closed: Date | null = null;
  #seen: Date | null = null;
  #reading = false;
  #root = '';
  #subagents = new Map<string, { at: number; journal: JournalBuilder }>();
  #waiting: Building | null = null;
  #status: SessionStateName | null = null;
  #background: readonly BackgroundItem[] = [];

  constructor(began: Date | null = null) {
    this.#opened = began;
    this.#seen = began;
  }

  take(event: Journalled): void {
    if (event.type === HOOK_CALLED) {
      this.hookCalled(event);
      return;
    }

    this.#opened = this.#opened ?? event.at;
    this.#closed = event.at;

    switch (event.type) {
      case 'working-copy.ready':
        this.#ready = event.at;
        break;
      case 'output':
        this.output(event);
        break;
      case 'turn.started':
      case 'turn.ended':
      case 'session.state':
      case 'message':
      case 'tool.changed':
      case 'tool.output':
      case 'plan.changed':
      case 'background.changed':
      case 'child.changed':
      case 'child.message':
      case 'context.changed':
        this.harnessEvent(event);
        break;
      case PROVISION_FAILED:
        this.failedToProvision(event);
        break;
      case RUN_PAUSED:
        this.#pausedAt.push(event.at);
        break;
      case TOOL_REFUSED:
        this.refused(event);
        break;
      case EGRESS_CHECKED:
        this.checked(event);
        break;
      case AGENT_STOPPED:
        this.#agentStopped = event.at;
        break;
      case HARNESS_CONNECTED:
        this.connected(event);
        break;
      case AGENT_REMINDED:
        this.reminded(event);
        break;
      case BACKGROUND_WAITING:
        this.waited(event);
        break;
      case BACKGROUND_SETTLED:
        this.settled(event);
        break;
      case BACKGROUND_LOST:
        this.lost(event);
        break;
      default:
        break;
    }

    this.#seen = event.at;
  }

  private output(event: Journalled): void {
    if (event.message) {
      this.ranHook(event);
    }
  }

  private connected(event: Journalled): void {
    const connected = harnessConnectedOf(event);
    this.#reading = connected !== null;
    this.#root = connected?.session ?? '';
  }

  private harnessEvent(event: Journalled): void {
    const read = this.#reading ? harnessEventOf(event) : null;
    if (read) {
      this.happened(read, event.at);
    }
  }

  private happened(event: HarnessEvent, at: Date): void {
    if (NOTIFIED.has(event.type)) {
      this.#first = this.#first ?? at;
      this.#last = at;
      this.#notifiedAt.push(at);
    }

    if (event.type === 'child.message') {
      this.messaged(event.data);
    }

    const session = event.data.session;
    const subagent = session ? this.subagentOwning(session) : undefined;
    if (subagent) {
      subagent.journal.happened(event, at);
      const step = this.#steps[subagent.at];
      if (step) {
        step.endedAt = at;
      }
      return;
    }

    switch (event.type) {
      case 'child.changed':
        this.subagent(event.data, at);
        break;
      case 'message':
        this.said(event.data, at);
        break;
      case 'tool.changed':
        this.tool(event.data, at);
        break;
      case 'tool.output':
        this.toolOutput(event.data);
        break;
      case 'plan.changed':
        this.means(event.data.entries, at);
        break;
      case 'context.changed':
        this.cost(event.data, session || this.#root);
        break;
      case 'turn.ended':
        this.used(event.data.usage);
        break;
      case 'turn.started':
        this.turned(event.data, at);
        break;
      case 'session.state':
        this.#status = event.data.state;
        break;
      case 'background.changed':
        this.#background = event.data.items;
        break;
      case 'child.message':
        break;
    }
  }

  private turned(started: TurnStarted, at: Date): void {
    if (started.origin !== 'self') {
      return;
    }

    this.flushText();
    this.#steps.push(bare('turn', started.cause ?? '', at));
  }

  private used(usage: TurnUsage | undefined): void {
    if (!usage) {
      return;
    }

    this.#tokens = this.#tokens.plus(
      Tokens.of({
        input: countOf(usage.input),
        output: countOf(usage.output),
        cacheRead: countOf(usage.cacheRead),
        cacheWrite: countOf(usage.cacheWrite),
      }),
    );
  }

  private refused(event: Journalled): void {
    let refused: RefusedCall;
    try {
      refused = JSON.parse(decoded(event.data ?? '')) as RefusedCall;
    } catch {
      return;
    }

    if (typeof refused?.toolCallId === 'string' && refused.toolCallId) {
      this.#refused.add(refused.toolCallId);
    }
  }

  private checked(event: Journalled): void {
    this.#egressEnforcement =
      enforcementOf(event.data) ?? this.#egressEnforcement;
  }

  private ranHook(event: Journalled): void {
    this.flushText();

    const step = bare(
      'hook',
      event.message ?? 'a hook',
      this.#seen ?? event.at,
    );
    step.endedAt = event.at;
    step.detail = event.data
      ? decoded(event.data).slice(0, DETAIL_LIMIT)
      : null;

    this.#steps.push(step);
  }

  private hookCalled(event: Journalled): void {
    if (!this.#closed || event.at > this.#closed) {
      this.#closed = event.at;
    }

    let called: HookCalled;
    try {
      called = JSON.parse(decoded(event.data ?? '')) as HookCalled;
    } catch {
      return;
    }

    this.#hooks.push({
      kind: 'hook',
      text: journalEntryText(event) ?? '',
      status: called.failed ? 'failed' : 'ok',
      tool: called.target ?? null,
      detail: null,
      ms: typeof called.ms === 'number' ? called.ms : 0,
      startedAt: startedAt(called, event.at),
      locations: [],
      input: written(called.request),
      output: written(called.response),
      change: null,
    });
  }

  private failedToProvision(event: Journalled): void {
    this.flushText();

    const facts = controlPlaneFactsOf(event);
    const step = bare(
      'hook',
      journalEntryText(event) ?? 'Provisioning failed',
      event.at,
    );
    step.status = 'failed';
    step.detail =
      facts.type === 'provision.failed'
        ? facts.detail.slice(0, DETAIL_LIMIT)
        : null;

    this.#steps.push(step);
  }

  steps(): JournalStep[] {
    this.flushText();

    return this.#hooks.reduce(
      inPlace,
      this.#steps.map(
        ({
          startedAt,
          endedAt,
          id,
          named: _named,
          workingAt: _workingAt,
          ...step
        }) => ({
          ...step,
          detail:
            step.kind === 'subagent' && id !== null
              ? transcriptOf(this.#subagents.get(id)?.journal.steps() ?? [])
              : step.detail,
          ms: endedAt.getTime() - startedAt.getTime(),
          startedAt,
        }),
      ),
    );
  }

  calls(): CalledStep[] {
    this.flushText();

    const turns = this.turns();

    return [
      ...this.#steps.flatMap((step) =>
        step.kind === 'tool' ? [this.calledOf(step, turns)] : [],
      ),
      ...[...this.#subagents.values()].flatMap(({ journal }) =>
        journal.calls(),
      ),
    ];
  }

  private calledOf(step: Building, turns: AgentTurns | null): CalledStep {
    const tool = harnessToolOf(step.named, step.text, step.tool);
    const ending = callEndingOf(
      step.status,
      step.id !== null && this.#refused.has(step.id),
    );

    return {
      server: tool.server,
      tool: tool.tool,
      requestedSkill: requestedSkillOf(tool, step.input),
      paths: readingPaths(tool, step.tool, [
        ...step.locations.map((each) => each.path),
        step.input,
      ]),
      ms:
        ending === 'unfinished'
          ? null
          : (turns?.workingWithin({
              from: (step.workingAt ?? step.startedAt).getTime(),
              to: step.endedAt.getTime(),
            }) ?? 0),
      ending,
    };
  }

  ms(): number | null {
    return this.turns()?.ms ?? null;
  }

  private turns(): AgentTurns | null {
    return AgentTurns.of(this.#notifiedAt, this.#pausedAt);
  }

  marks(): RunMarks {
    return {
      startedAt: this.#opened,
      readyAt: this.#ready,
      firstAgentUpdateAt: this.#first,
      lastAgentUpdateAt: this.#last,
      agentStoppedAt: this.#agentStopped,
      endedAt: this.#closed,
    };
  }

  spent(): SpentReading | null {
    return this.#spent;
  }

  egressEnforcement(): EgressEnforcement | null {
    return this.#egressEnforcement;
  }

  sessionStatus(): SessionStateName | null {
    return this.#status;
  }

  background(): readonly BackgroundItem[] {
    return this.#background;
  }

  spentBySession(): ReadonlyMap<string, SpentReading> {
    return new Map([
      ...this.#spentBySession,
      ...[...this.#subagents.values()].flatMap(({ journal }) => [
        ...journal.spentBySession(),
      ]),
    ]);
  }

  tokens(): Tokens {
    return this.#tokens;
  }

  private cost(changed: ContextChanged, session: string): void {
    this.#spent = {
      used: changed.used,
      size: changed.size,
      cost: priced(changed.cost),
    };
    this.#spentBySession.set(session, this.#spent);
  }

  private means(entries: readonly PlanEntry[], at: Date): void {
    if (entries.length === 0) {
      return;
    }

    this.flushText();

    const step = bare(
      'planned',
      `Planned ${entries.length} ${entries.length === 1 ? 'step' : 'steps'}`,
      at,
    );
    step.detail = planned(entries);

    this.#steps.push(step);
  }

  private said(message: AgentMessage, at: Date): void {
    if (!message.text || message.role === 'user') {
      return;
    }

    const kind = message.role === 'thought' ? 'thought' : 'message';

    if (this.#textStep?.kind === kind && this.#textId === message.id) {
      this.#textStep.text = message.replace
        ? message.text
        : this.#textStep.text + message.text;
      this.#textStep.endedAt = at;
      return;
    }

    this.flushText();
    this.#textStep = bare(kind, message.text, at);
    this.#textId = message.id;
  }

  private tool(call: ToolChanged, at: Date): void {
    const found = this.#tools.get(call.id);
    const step = found === undefined ? undefined : this.#steps[found];

    if (found === undefined || !step) {
      this.flushText();

      const started = bare('tool', call.title, at);
      started.id = call.id;
      started.status = call.status ?? null;
      started.tool = call.kind ?? null;
      started.named = call.name?.trim() || null;
      started.workingAt = call.status === WORKING ? at : null;
      started.locations = locationsOf(call.locations);
      started.input = written(call.input);
      started.output = written(call.output);
      started.change = changedOnce(call);

      this.#steps.push(started);
      this.#tools.set(call.id, this.#steps.length - 1);
      return;
    }

    const locations = locationsOf(call.locations);

    this.#steps[found] = {
      ...step,
      text: call.title,
      status: call.status ?? step.status,
      tool: call.kind ?? step.tool,
      named: call.name?.trim() || step.named,
      locations: locations.length > 0 ? locations : step.locations,
      input: written(call.input) ?? step.input,
      output: written(call.output) ?? step.output,
      change: changedOnce(call) ?? step.change,
      workingAt: step.workingAt ?? (call.status === WORKING ? at : null),
      endedAt:
        step.status !== null && ENDED_STATUSES.has(step.status)
          ? step.endedAt
          : at,
    };
  }

  private toolOutput(output: ToolOutput): void {
    const found = this.#tools.get(output.id);
    const step = found === undefined ? undefined : this.#steps[found];
    if (!step || !output.text) {
      return;
    }

    const printed = output.replace
      ? output.text
      : `${this.#printed.get(output.id) ?? ''}${output.text}`;
    this.#printed.set(output.id, printed);
    step.detail = unfenced(printed).slice(0, DETAIL_LIMIT);
  }

  private owns(sessionId: string): boolean {
    return this.subagentOwning(sessionId) !== undefined;
  }

  private subagentOwning(
    sessionId: string,
  ): { at: number; journal: JournalBuilder } | undefined {
    return (
      this.#subagents.get(sessionId) ??
      [...this.#subagents.values()].find(({ journal }) =>
        journal.owns(sessionId),
      )
    );
  }

  private subagent(changed: ChildChanged, at: Date): void {
    const id = changed.child;

    this.flushText();

    const known = this.#subagents.get(id);
    const step = known ? this.#steps[known.at] : undefined;
    if (step) {
      step.text = changed.title || changed.description || step.text;
      step.status = subagentStatusOf(changed) ?? step.status;
      step.endedAt = at;
      return;
    }

    const started = bare(
      'subagent',
      changed.title || changed.description || 'a subagent',
      at,
    );
    started.id = id;
    started.status = subagentStatusOf(changed) ?? 'running';
    this.#steps.push(started);
    this.#subagents.set(id, {
      at: this.#steps.length - 1,
      journal: new JournalBuilder(at),
    });
  }

  private messaged(message: ChildMessage): void {
    const text = message.text.trim();
    if (!text) {
      return;
    }

    const to = message.to ? this.#subagents.get(message.to) : undefined;
    const from = message.from ? this.#subagents.get(message.from) : undefined;
    const toStep = to ? this.#steps[to.at] : undefined;
    const fromStep = from ? this.#steps[from.at] : undefined;

    if (toStep && toStep.input === null) {
      toStep.input = text.slice(0, DETAIL_LIMIT);
    }
    if (fromStep && !to) {
      fromStep.output = text.slice(0, DETAIL_LIMIT);
    }
  }

  private reminded(event: Journalled): void {
    this.flushText();

    const step = bare('reminded', 'the agent to hand over', event.at);
    step.detail = event.message;
    this.#steps.push(step);
  }

  private waited(event: Journalled): void {
    const tasks = tasksIn(event.data);
    if (tasks.length === 0) {
      return;
    }

    this.flushText();

    const step = bare('waited', tasks.join('; '), event.at);
    step.status = 'running';
    this.#steps.push(step);
    this.#waiting = step;
  }

  private settled(event: Journalled): void {
    const step = this.#waiting;
    if (!step) {
      return;
    }

    const { ended } = backgroundWorkIn(event.data);
    const ending = ended ? WAIT_ENDS[ended] : null;
    step.status = ending?.status ?? 'completed';
    step.endedAt = event.at;
    step.detail = ending?.detail(tasksIn(event.data).join('; ')) ?? null;
    this.#waiting = null;
  }

  private lost(event: Journalled): void {
    const tasks = tasksIn(event.data);
    if (tasks.length === 0) {
      return;
    }

    this.flushText();

    const step = bare('lost', `${tasks.join('; ')} with the sandbox`, event.at);
    step.status = 'failed';
    this.#steps.push(step);
  }

  private flushText(): void {
    if (this.#textStep) {
      this.#steps.push({ ...this.#textStep, text: this.#textStep.text.trim() });
      this.#textStep = null;
      this.#textId = null;
    }
  }
}
