import {
  EGRESS_CHECKED,
  type EgressEnforcement,
  enforcementTold,
  HOOK_CALLED,
  type JournalStep,
  PROVISION_FAILED,
  RUN_PAUSED,
  type RunMarks,
  type RunSpent,
  type StepChange,
  type StepLocation,
  TOOL_REFUSED,
  TURN_USAGE,
} from '@work/application/contracts/run-journal.contract';
import type { CalledStep } from '@work/domain/services/tool-attribution';
import { Money } from '@work/domain/value-objects/money.vo';
import type { StepKind } from '@work/domain/value-objects/step-kind';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { type Content, diffIn } from '@work/infrastructure/acp/content';
import {
  callEndingOf,
  harnessToolOf,
  readingPaths,
  skillAskedFor,
} from '@work/infrastructure/acp/harness-tools';
import {
  decoded,
  type Journalled,
} from '@work/infrastructure/journal/journalled';

const countOf = (said: unknown): number | null =>
  typeof said === 'number' && Number.isSafeInteger(said) && said >= 0
    ? said
    : null;

const DETAIL_LIMIT = 4_000;

interface Spoken {
  sessionId?: string;
  update?: {
    _meta?: { claudeCode?: { toolName?: unknown } };
    sessionUpdate?: string;
    toolCallId?: string;
    title?: string;
    status?: string;
    kind?: string;
    used?: number;
    size?: number;
    cost?: { amount?: number; currency?: string };
    locations?: { path?: string; line?: number }[];
    rawInput?: unknown;
    rawOutput?: unknown;
    entries?: { content?: string; priority?: string; status?: string }[];
    content?: Content;
  };
}

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

const spoken = (content: Content | undefined): string => {
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

const reached = (
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

const toolNameOf = (update: NonNullable<Spoken['update']>): string | null => {
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

const planned = (entries: NonNullable<Spoken['update']>['entries']): string =>
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
  given: string | null;
  returned: string | null;
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
  given: null,
  returned: null,
  change: null,
  startedAt: at,
  workingAt: null,
  endedAt: at,
});

const WORKING = 'in_progress';

const SETTLED = new Set(['completed', 'failed']);

interface Span {
  readonly from: number;
  readonly to: number;
}

const overlapping = (spans: readonly Span[], within: Span): number =>
  spans.reduce(
    (sum, span) =>
      sum +
      Math.max(
        0,
        Math.min(span.to, within.to) - Math.max(span.from, within.from),
      ),
    0,
  );

interface RefusedCall {
  readonly toolCallId?: unknown;
}

export class Told {
  #steps: Building[] = [];
  #hooks: JournalStep[] = [];
  #tools = new Map<string, number>();
  #refused = new Set<string>();
  #saying: Building | null = null;
  #spent: RunSpent | null = null;
  #egressEnforcement: EgressEnforcement | null = null;
  #spentBySession = new Map<string, RunSpent>();
  #tokens = Tokens.UNREPORTED;
  #first: Date | null = null;
  #last: Date | null = null;
  #spokenAt: Date[] = [];
  #pausedAt: Date[] = [];
  #opened: Date | null = null;
  #ready: Date | null = null;
  #closed: Date | null = null;
  #seen: Date | null = null;

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
      case 'workspace.ready':
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

    this.spoke(event.data, event.at);
  }

  private spoke(data: string, at: Date): void {
    let sent: Spoken;
    try {
      sent = JSON.parse(decoded(data)) as Spoken;
    } catch {
      return;
    }

    const update = sent.update;
    if (!update?.sessionUpdate) {
      return;
    }

    this.#first = this.#first ?? at;
    this.#last = at;
    this.#spokenAt.push(at);

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        this.say('said', spoken(update.content), at);
        break;
      case 'agent_thought_chunk':
        this.say('thought', spoken(update.content), at);
        break;
      case 'tool_call':
        this.reachFor(update, at);
        break;
      case 'tool_call_update':
        this.went(update, at);
        break;
      case 'plan':
        this.means(update, at);
        break;
      case 'usage_update':
        this.cost(update, sent.sessionId ?? '');
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
      enforcementTold(event.data) ?? this.#egressEnforcement;
  }

  private ranHook(event: Journalled): void {
    this.settle();

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
      text: `Hook ${called.hook ?? 'a hook'} · ${called.step ?? 'a step'} → ${called.target ?? 'somewhere'}`,
      status: called.failed ? 'failed' : 'ok',
      tool: called.target ?? null,
      detail: null,
      ms: typeof called.ms === 'number' ? called.ms : 0,
      startedAt: startedAt(called, event.at),
      locations: [],
      given: written(called.request),
      returned: written(called.response),
      change: null,
    });
  }

  private failedToProvision(event: Journalled): void {
    this.settle();

    const step = bare('hook', event.message ?? 'Provisioning failed', event.at);
    step.status = 'failed';
    step.detail = event.data
      ? decoded(event.data).slice(0, DETAIL_LIMIT)
      : null;

    this.#steps.push(step);
  }

  steps(): JournalStep[] {
    this.settle();

    return this.#hooks.reduce(
      inPlace,
      this.#steps.map(
        ({
          startedAt,
          endedAt,
          id: _id,
          named: _named,
          workingAt: _workingAt,
          ...step
        }) => ({
          ...step,
          ms: endedAt.getTime() - startedAt.getTime(),
          startedAt,
        }),
      ),
    );
  }

  calls(): CalledStep[] {
    this.settle();

    const turns = this.turns();

    return this.#steps.flatMap((step) =>
      step.kind === 'tool' ? [this.calledOf(step, turns)] : [],
    );
  }

  private calledOf(step: Building, turns: readonly Span[]): CalledStep {
    const tool = harnessToolOf(step.named, step.text, step.tool);
    const ending = callEndingOf(
      step.status,
      step.id !== null && this.#refused.has(step.id),
    );

    return {
      server: tool.server,
      tool: tool.tool,
      skillAskedFor: skillAskedFor(tool, step.given),
      paths: readingPaths(tool, step.tool, [
        ...step.locations.map((each) => each.path),
        step.given,
      ]),
      ms:
        ending === 'unfinished'
          ? null
          : overlapping(turns, {
              from: (step.workingAt ?? step.startedAt).getTime(),
              to: step.endedAt.getTime(),
            }),
      ending,
    };
  }

  ms(): number | null {
    if (this.#spokenAt.length === 0) {
      return null;
    }

    return this.turns().reduce((sum, span) => sum + span.to - span.from, 0);
  }

  private turns(): Span[] {
    const pauses = this.#pausedAt
      .map((at) => at.getTime())
      .sort((a, b) => a - b);
    const turns = new Map<number, Span>();

    for (const at of this.#spokenAt.map((each) => each.getTime())) {
      const turn = pauses.filter((pause) => pause < at).length;
      const span = turns.get(turn);

      turns.set(turn, {
        from: Math.min(span?.from ?? at, at),
        to: Math.max(span?.to ?? at, at),
      });
    }

    return [...turns.values()];
  }

  marks(): RunMarks {
    return {
      startedAt: this.#opened,
      readyAt: this.#ready,
      spokeFrom: this.#first,
      spokeTo: this.#last,
      endedAt: this.#closed,
    };
  }

  spent(): RunSpent | null {
    return this.#spent;
  }

  egressEnforcement(): EgressEnforcement | null {
    return this.#egressEnforcement;
  }

  spentBySession(): ReadonlyMap<string, RunSpent> {
    return this.#spentBySession;
  }

  tokens(): Tokens {
    return this.#tokens;
  }

  private cost(update: NonNullable<Spoken['update']>, session: string): void {
    if (update.used === undefined || update.size === undefined) {
      return;
    }

    this.#spent = {
      used: update.used,
      size: update.size,
      cost: Money.maybe(update.cost?.amount, update.cost?.currency),
    };
    this.#spentBySession.set(session, this.#spent);
  }

  private means(update: NonNullable<Spoken['update']>, at: Date): void {
    const entries = update.entries ?? [];
    if (entries.length === 0) {
      return;
    }

    this.settle();

    const step = bare(
      'planned',
      `Planned ${entries.length} ${entries.length === 1 ? 'step' : 'steps'}`,
      at,
    );
    step.detail = planned(entries);

    this.#steps.push(step);
  }

  private say(kind: 'said' | 'thought', text: string, at: Date): void {
    if (!text) {
      return;
    }

    if (this.#saying?.kind === kind) {
      this.#saying.text += text;
      this.#saying.endedAt = at;
      return;
    }

    this.settle();
    this.#saying = bare(kind, text, at);
  }

  private reachFor(update: NonNullable<Spoken['update']>, at: Date): void {
    if (update.toolCallId && this.#tools.has(update.toolCallId)) {
      this.went(update, at);
      return;
    }

    this.settle();

    const step = bare('tool', update.title ?? 'a tool', at);
    step.id = update.toolCallId ?? null;
    step.status = update.status ?? null;
    step.tool = update.kind ?? null;
    step.named = toolNameOf(update);
    step.workingAt = update.status === WORKING ? at : null;
    step.locations = reached(update.locations);
    step.given = written(update.rawInput);

    this.#steps.push(step);

    if (update.toolCallId) {
      this.#tools.set(update.toolCallId, this.#steps.length - 1);
    }
  }

  private went(update: NonNullable<Spoken['update']>, at: Date): void {
    const id = update.toolCallId;
    const found = id === undefined ? undefined : this.#tools.get(id);
    const step = found === undefined ? undefined : this.#steps[found];

    if (found === undefined || !step) {
      return;
    }

    const came = spoken(update.content);
    const locations = reached(update.locations);

    this.#steps[found] = {
      ...step,
      text: update.title ?? step.text,
      status: update.status ?? step.status,
      tool: update.kind ?? step.tool,
      named: toolNameOf(update) ?? step.named,
      detail: came ? unfenced(came).slice(0, DETAIL_LIMIT) : step.detail,
      locations: locations.length > 0 ? locations : step.locations,
      given: written(update.rawInput) ?? step.given,
      returned: written(update.rawOutput) ?? step.returned,
      change: changed(update.content) ?? step.change,
      workingAt: step.workingAt ?? (update.status === WORKING ? at : null),
      endedAt:
        step.status !== null && SETTLED.has(step.status) ? step.endedAt : at,
    };
  }

  private settle(): void {
    if (this.#saying) {
      this.#steps.push({ ...this.#saying, text: this.#saying.text.trim() });
      this.#saying = null;
    }
  }
}
