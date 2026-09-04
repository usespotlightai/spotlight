import type {
  JournalStep,
  RunMarks,
  RunSpent,
  StepChange,
  StepLocation,
} from '@domain/read-models/journal';
import { Money } from '@domain/value-objects/money.vo';
import type { StepKind } from '@domain/value-objects/step-kind';
import { decoded, type Journalled } from '@infrastructure/journal/journalled';

/** A chunk carries one of these; a tool answers with a list of them. */
type Content =
  | { text?: string }
  | {
      type?: string;
      path?: string;
      oldText?: string;
      newText?: string;
      content?: { text?: string };
    }[];

/** How much of a tool's answer is worth carrying to a reader. */
const DETAIL_LIMIT = 4_000;

/**
 * One update as the agent sent it, of the parts worth reading. Nothing outside
 * this file knows the protocol's shape: what leaves it is steps.
 */
interface Spoken {
  update?: {
    sessionUpdate?: string;
    toolCallId?: string;
    title?: string;
    status?: string;
    kind?: string;
    used?: number;
    size?: number;
    cost?: { amount?: number; currency?: string };
    locations?: { path?: string; line?: number }[];
    // Unread here: what the agent asked of the tool, and what it got back.
    rawInput?: unknown;
    rawOutput?: unknown;
    entries?: { content?: string; priority?: string; status?: string }[];
    content?: Content;
  };
}

/**
 * A tool answers in markdown, fenced as a code block. The fence is for a
 * renderer, and what is wanted here is what it holds.
 */
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

/** The text of a chunk, or of everything a tool answered with. */
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

/** The first file a tool rewrote, of everything it answered with. */
const changed = (content: Content | undefined): StepChange | null => {
  if (!Array.isArray(content)) {
    return null;
  }

  for (const each of content) {
    if (each?.type === 'diff') {
      return {
        path: each.path ?? null,
        before: (each.oldText ?? '').slice(0, DETAIL_LIMIT),
        after: (each.newText ?? '').slice(0, DETAIL_LIMIT),
      };
    }
  }

  return null;
};

const reached = (
  locations: { path?: string; line?: number }[] | undefined,
): StepLocation[] =>
  (locations ?? []).flatMap((each) =>
    each?.path ? [{ path: each.path, line: each.line ?? null }] : [],
  );

/** What the tool was handed, or handed back, as text a person can read. */
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

/** A plan reads as its steps, each with where it had got to. */
const planned = (entries: NonNullable<Spoken['update']>['entries']): string =>
  (entries ?? [])
    .map((each) => {
      const status = each?.status ? `[${each.status}] ` : '';
      return `${status}${each?.content ?? ''}`.trim();
    })
    .filter(Boolean)
    .join('\n');

/** A step as it is being built, before it knows how long it took. */
interface Building {
  kind: StepKind;
  text: string;
  status: string | null;
  tool: string | null;
  detail: string | null;
  locations: StepLocation[];
  given: string | null;
  returned: string | null;
  change: StepChange | null;
  startedAt: Date;
  endedAt: Date;
}

const bare = (kind: StepKind, text: string, at: Date): Building => ({
  kind,
  text,
  status: null,
  tool: null,
  detail: null,
  locations: [],
  given: null,
  returned: null,
  change: null,
  startedAt: at,
  endedAt: at,
});

/**
 * Reads one run's journal into steps, merging the chunks an agent speaks in
 * back into whole things said, and keeping how long each took: an agent that
 * thought for a minute did something different from one that thought for a
 * second.
 */
export class Told {
  readable = true;

  #steps: Building[] = [];
  #tools = new Map<string, number>();
  #saying: Building | null = null;
  #spent: RunSpent | null = null;
  #first: Date | null = null;
  #last: Date | null = null;
  #opened: Date | null = null;
  #ready: Date | null = null;
  #closed: Date | null = null;
  #seen: Date | null = null;

  /**
   * `began` is when the run was picked up, which the journal cannot say: its
   * first entry is written once there is something to write down. Without it a
   * prepare hook appears to have taken no time at all.
   */
  constructor(began: Date | null = null) {
    this.#opened = began;
    this.#seen = began;
  }

  take(event: Journalled): void {
    this.#opened = this.#opened ?? event.at;
    this.#closed = event.at;

    switch (event.type) {
      case 'workspace.ready':
        this.#ready = event.at;
        break;
      case 'output':
        this.output(event);
        break;
      default:
        break;
    }

    this.#seen = event.at;
  }

  private output(event: Journalled): void {
    // A hook's output is the deployment's own, and is not a protocol at all.
    // It is named, which is the only thing that tells the two apart.
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
      // Terminal bytes from before the protocol: nothing to read here.
      this.readable = false;
      return;
    }

    const update = sent.update;
    if (!update?.sessionUpdate) {
      return;
    }

    this.#first = this.#first ?? at;
    this.#last = at;

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
        this.cost(update);
        break;
      default:
        break;
    }
  }

  /**
   * A hook is journalled once it has finished, so what it says is when it
   * ended. It began whenever the last thing did, which is the closest the
   * journal comes to saying.
   */
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

  steps(): JournalStep[] {
    this.settle();

    return this.#steps.map(({ startedAt, endedAt, ...step }) => ({
      ...step,
      ms: endedAt.getTime() - startedAt.getTime(),
      startedAt,
    }));
  }

  /** How long the whole run spoke for. */
  ms(): number | null {
    if (!this.#first || !this.#last) {
      return null;
    }
    return this.#last.getTime() - this.#first.getTime();
  }

  /** Where the run turned from being prepared, to worked, to finished. */
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

  private cost(update: NonNullable<Spoken['update']>): void {
    if (update.used === undefined || update.size === undefined) {
      return;
    }

    this.#spent = {
      used: update.used,
      size: update.size,
      cost: Money.maybe(update.cost?.amount, update.cost?.currency),
    };
  }

  /**
   * The plan replaces whatever the agent last said it meant to do. Kept as its
   * own step each time rather than overwritten: a plan that keeps changing is
   * worth seeing change.
   */
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
    this.settle();

    const step = bare('tool', update.title ?? 'a tool', at);
    step.status = update.status ?? null;
    step.tool = update.kind ?? null;
    step.locations = reached(update.locations);
    step.given = written(update.rawInput);

    this.#steps.push(step);

    if (update.toolCallId) {
      this.#tools.set(update.toolCallId, this.#steps.length - 1);
    }
  }

  /**
   * A tool the agent came back to. The answer says more than the asking did:
   * a command's title becomes the command, and what came back arrives here.
   */
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
      detail: came ? unfenced(came).slice(0, DETAIL_LIMIT) : step.detail,
      locations: locations.length > 0 ? locations : step.locations,
      given: written(update.rawInput) ?? step.given,
      returned: written(update.rawOutput) ?? step.returned,
      change: changed(update.content) ?? step.change,
      endedAt: at,
    };
  }

  private settle(): void {
    if (this.#saying) {
      this.#steps.push({ ...this.#saying, text: this.#saying.text.trim() });
      this.#saying = null;
    }
  }
}
