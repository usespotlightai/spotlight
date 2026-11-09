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
  TURN_USAGE,
} from '@runs/domain/value-objects/journal-entry-type';
import { Money } from '@runs/domain/value-objects/money.vo';
import type { SpentReading } from '@runs/domain/value-objects/run-usage.vo';
import type { StepKind } from '@runs/domain/value-objects/step-kind';
import { Tokens } from '@runs/domain/value-objects/tokens.vo';
import { type Content, diffIn } from '@runs/infrastructure/acp/content';
import {
  type FrameReader,
  frameReaderFor,
  type HarnessNotification,
} from '@runs/infrastructure/acp/frame-reader';
import {
  callEndingOf,
  harnessToolOf,
  readingPaths,
  requestedSkillOf,
} from '@runs/infrastructure/acp/harness-tools';
import {
  controlPlaneFactsOf,
  journalEntryText,
} from '@runs/infrastructure/journal/control-plane-facts';
import { enforcementOf } from '@runs/infrastructure/journal/egress-enforcement';
import {
  decoded,
  type Journalled,
} from '@runs/infrastructure/journal/journalled';

const countOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;

const DETAIL_LIMIT = 4_000;

const priced = (
  cost: { amount?: number; currency?: string } | undefined,
): Money | null =>
  cost?.currency && Money.isCurrency(cost.currency)
    ? Money.maybe(cost.amount, cost.currency)
    : null;

type AcpNotification = HarnessNotification;

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

const textOf = (content: Content | undefined): string => {
  if (!content) {
    return '';
  }
  if (Array.isArray(content)) {
    return content
      .map((each) => each?.content?.text ?? '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return content.text ?? '';
};

const changed = (content: Content | undefined): StepChange | null => {
  const diff = diffIn(content);

  return diff
    ? {
        path: diff.path ?? null,
        before: (diff.oldText ?? '').slice(0, DETAIL_LIMIT),
        after: (diff.newText ?? '').slice(0, DETAIL_LIMIT),
      }
    : null;
};

const locationsOf = (
  locations: { path?: string; line?: number }[] | undefined,
): StepLocation[] =>
  (locations ?? []).flatMap((each) =>
    each?.path ? [{ path: each.path, line: each.line ?? null }] : [],
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

const toolNameOf = (
  update: NonNullable<AcpNotification['update']>,
): string | null => {
  const named = update._meta?.claudeCode?.toolName;

  return typeof named === 'string' && named.trim().length > 0 ? named : null;
};

interface TurnUsage {
  readonly inputTokens?: unknown;
  readonly outputTokens?: unknown;
  readonly cachedReadTokens?: unknown;
  readonly cachedWriteTokens?: unknown;
}

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

const planned = (
  entries: NonNullable<AcpNotification['update']>['entries'],
): string =>
  (entries ?? [])
    .map((each) => {
      const status = each?.status ? `[${each.status}] ` : '';
      return `${status}${each?.content ?? ''}`.trim();
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

interface BackgroundTask {
  readonly kind?: unknown;
  readonly description?: unknown;
}

const WAIT_ENDINGS: Readonly<
  Record<string, { status: string; detail: (still: string) => string | null }>
> = {
  limit: {
    status: 'completed',
    detail: (still) => `Still running at the wait limit: ${still}`,
  },
  message: { status: 'completed', detail: () => 'A person sent a message.' },
  stopped: { status: 'completed', detail: () => 'The run stopped waiting.' },
  gone: { status: 'failed', detail: () => 'The agent stopped.' },
};

const endingIn = (data: string | null): string | null => {
  try {
    const parsed = JSON.parse(decoded(data ?? '')) as { ended?: unknown };
    return typeof parsed?.ended === 'string' ? parsed.ended : null;
  } catch {
    return null;
  }
};

const tasksIn = (data: string | null): string[] => {
  try {
    const parsed = JSON.parse(decoded(data ?? '')) as {
      tasks?: BackgroundTask[];
    };
    return (parsed?.tasks ?? []).flatMap((task) => {
      const named =
        typeof task?.description === 'string' && task.description.trim()
          ? task.description.trim()
          : typeof task?.kind === 'string'
            ? task.kind
            : '';
      return named ? [named] : [];
    });
  } catch {
    return [];
  }
};

const SUBAGENT_STATUSES: Readonly<Record<string, string>> = {
  running: 'running',
  requires_action: 'running',
};

const subagentStatusOf = (
  state: NonNullable<AcpNotification['update']>['state'],
): string | null => {
  if (!state?.state) {
    return null;
  }
  if (state.state !== 'idle') {
    return SUBAGENT_STATUSES[state.state] ?? null;
  }
  return state.stopReason === 'error' || state.stopReason === 'cancelled'
    ? 'failed'
    : 'completed';
};

const blocksOf = (content: Content | undefined): string =>
  Array.isArray(content)
    ? content
        .map((block) =>
          typeof (block as { text?: unknown })?.text === 'string'
            ? (block as { text: string }).text
            : '',
        )
        .filter(Boolean)
        .join('\n')
        .trim()
    : '';

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
  #refused = new Set<string>();
  #textStep: Building | null = null;
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
  #reader: FrameReader | null = frameReaderFor(null);
  #subagents = new Map<string, { at: number; journal: JournalBuilder }>();
  #waiting: Building | null = null;

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
      case PROVISION_FAILED:
        this.failedToProvision(event);
        break;
      case RUN_PAUSED:
        this.#pausedAt.push(event.at);
        break;
      case TURN_USAGE:
        this.used(event);
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
        this.#reader = frameReaderFor(event.message);
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
      return;
    }
    if (!event.data) {
      return;
    }

    this.onNotification(event.data, event.at);
  }

  private onNotification(data: string, at: Date): void {
    const notification = this.#reader?.read(data);
    if (notification) {
      this.notified(notification, at);
    }
  }

  private notified(notification: AcpNotification, at: Date): void {
    const update = notification.update;
    if (!update?.sessionUpdate) {
      return;
    }

    this.#first = this.#first ?? at;
    this.#last = at;
    this.#notifiedAt.push(at);

    if (update.sessionUpdate === 'session_message') {
      this.messaged(update);
    }

    const subagent = notification.sessionId
      ? this.subagentOwning(notification.sessionId)
      : undefined;
    if (subagent) {
      subagent.journal.notified(notification, at);
      const step = this.#steps[subagent.at];
      if (step) {
        step.endedAt = at;
      }
      return;
    }

    switch (update.sessionUpdate) {
      case 'subagent_update':
        this.subagent(update, at);
        break;
      case 'agent_message_chunk':
        this.addText('message', textOf(update.content), at);
        break;
      case 'agent_thought_chunk':
        this.addText('thought', textOf(update.content), at);
        break;
      case 'tool_call':
        this.startTool(update, at);
        break;
      case 'tool_call_update':
        this.went(update, at);
        break;
      case 'plan':
        this.means(update, at);
        break;
      case 'usage_update':
        this.cost(update, notification.sessionId ?? '');
        break;
      default:
        break;
    }
  }

  private used(event: Journalled): void {
    let usage: TurnUsage;
    try {
      usage = JSON.parse(decoded(event.data ?? '')) as TurnUsage;
    } catch {
      return;
    }
    if (typeof usage !== 'object' || usage === null) {
      return;
    }

    this.#tokens = this.#tokens.plus(
      Tokens.of({
        input: countOf(usage.inputTokens),
        output: countOf(usage.outputTokens),
        cacheRead: countOf(usage.cachedReadTokens),
        cacheWrite: countOf(usage.cachedWriteTokens),
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

  private cost(
    update: NonNullable<AcpNotification['update']>,
    session: string,
  ): void {
    if (update.used === undefined || update.size === undefined) {
      return;
    }

    this.#spent = {
      used: update.used,
      size: update.size,
      cost: priced(update.cost),
    };
    this.#spentBySession.set(session, this.#spent);
  }

  private means(
    update: NonNullable<AcpNotification['update']>,
    at: Date,
  ): void {
    const entries = update.entries ?? [];
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

  private addText(kind: 'message' | 'thought', text: string, at: Date): void {
    if (!text) {
      return;
    }

    if (this.#textStep?.kind === kind) {
      this.#textStep.text += text;
      this.#textStep.endedAt = at;
      return;
    }

    this.flushText();
    this.#textStep = bare(kind, text, at);
  }

  private startTool(
    update: NonNullable<AcpNotification['update']>,
    at: Date,
  ): void {
    if (update.toolCallId && this.#tools.has(update.toolCallId)) {
      this.went(update, at);
      return;
    }

    this.flushText();

    const step = bare('tool', update.title ?? 'a tool', at);
    step.id = update.toolCallId ?? null;
    step.status = update.status ?? null;
    step.tool = update.kind ?? null;
    step.named = toolNameOf(update);
    step.workingAt = update.status === WORKING ? at : null;
    step.locations = locationsOf(update.locations);
    step.input = written(update.rawInput);

    this.#steps.push(step);

    if (update.toolCallId) {
      this.#tools.set(update.toolCallId, this.#steps.length - 1);
    }
  }

  private went(update: NonNullable<AcpNotification['update']>, at: Date): void {
    const id = update.toolCallId;
    const found = id === undefined ? undefined : this.#tools.get(id);
    const step = found === undefined ? undefined : this.#steps[found];

    if (found === undefined || !step) {
      return;
    }

    const came = textOf(update.content);
    const locations = locationsOf(update.locations);

    this.#steps[found] = {
      ...step,
      text: update.title ?? step.text,
      status: update.status ?? step.status,
      tool: update.kind ?? step.tool,
      named: toolNameOf(update) ?? step.named,
      detail: came ? unfenced(came).slice(0, DETAIL_LIMIT) : step.detail,
      locations: locations.length > 0 ? locations : step.locations,
      input: written(update.rawInput) ?? step.input,
      output: written(update.rawOutput) ?? step.output,
      change: changed(update.content) ?? step.change,
      workingAt: step.workingAt ?? (update.status === WORKING ? at : null),
      endedAt:
        step.status !== null && ENDED_STATUSES.has(step.status)
          ? step.endedAt
          : at,
    };
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

  private subagent(
    update: NonNullable<AcpNotification['update']>,
    at: Date,
  ): void {
    const id = update.sessionId;
    if (!id) {
      return;
    }

    this.flushText();

    const known = this.#subagents.get(id);
    const step = known ? this.#steps[known.at] : undefined;
    if (step) {
      step.text = update.title ?? update.description ?? step.text;
      step.status = subagentStatusOf(update.state) ?? step.status;
      step.endedAt = at;
      return;
    }

    const started = bare(
      'subagent',
      update.title ?? update.description ?? 'a subagent',
      at,
    );
    started.id = id;
    started.status = subagentStatusOf(update.state) ?? 'running';
    this.#steps.push(started);
    this.#subagents.set(id, {
      at: this.#steps.length - 1,
      journal: new JournalBuilder(at),
    });
  }

  private messaged(update: NonNullable<AcpNotification['update']>): void {
    const text = blocksOf(update.content);
    if (!text) {
      return;
    }

    const to = update.recipientSessionId
      ? this.#subagents.get(update.recipientSessionId)
      : undefined;
    const from = update.senderSessionId
      ? this.#subagents.get(update.senderSessionId)
      : undefined;
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

    const ending = WAIT_ENDINGS[endingIn(event.data) ?? ''];
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
    }
  }
}
