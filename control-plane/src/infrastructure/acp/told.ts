import type { JournalStep } from '@application/ports/run-journal-reader.port';

type Content = { text?: string } | { content?: { text?: string } }[];

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
    // A chunk carries one; a tool answers with a list of them.
    content?: Content;
  };
}

/** What a run cost, as the agent last reported it. */
export interface Spent {
  readonly used: number;
  readonly size: number;
  readonly cost: number | null;
  readonly currency: string | null;
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

/** A step as it is being built, before it knows how long it took. */
interface Building {
  kind: 'said' | 'thought' | 'tool';
  text: string;
  status: string | null;
  tool: string | null;
  detail: string | null;
  startedAt: Date;
  endedAt: Date;
}

/**
 * Reads one run's updates into steps, merging the chunks an agent speaks in
 * back into whole things said, and keeping how long each took: an agent that
 * thought for a minute did something different from one that thought for a
 * second.
 */
export class Told {
  readable = true;

  #steps: Building[] = [];
  #tools = new Map<string, number>();
  #saying: Building | null = null;
  #spent: Spent | null = null;
  #first: Date | null = null;
  #last: Date | null = null;

  take(data: string | null, at: Date): void {
    if (!data) {
      return;
    }

    let sent: Spoken;
    try {
      sent = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as Spoken;
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
      case 'usage_update':
        this.cost(update);
        break;
      default:
        break;
    }
  }

  steps(): JournalStep[] {
    this.settle();

    return this.#steps.map(({ startedAt, endedAt, ...step }) => ({
      ...step,
      ms: endedAt.getTime() - startedAt.getTime(),
    }));
  }

  /** How long the whole run spoke for. */
  ms(): number | null {
    if (!this.#first || !this.#last) {
      return null;
    }
    return this.#last.getTime() - this.#first.getTime();
  }

  spent(): Spent | null {
    return this.#spent;
  }

  private cost(update: NonNullable<Spoken['update']>): void {
    if (update.used === undefined || update.size === undefined) {
      return;
    }

    this.#spent = {
      used: update.used,
      size: update.size,
      cost: update.cost?.amount ?? null,
      currency: update.cost?.currency ?? null,
    };
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
    this.#saying = {
      kind,
      text,
      status: null,
      tool: null,
      detail: null,
      startedAt: at,
      endedAt: at,
    };
  }

  private reachFor(update: NonNullable<Spoken['update']>, at: Date): void {
    this.settle();

    this.#steps.push({
      kind: 'tool',
      text: update.title ?? 'a tool',
      status: update.status ?? null,
      tool: update.kind ?? null,
      detail: null,
      startedAt: at,
      endedAt: at,
    });

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

    this.#steps[found] = {
      ...step,
      text: update.title ?? step.text,
      status: update.status ?? step.status,
      tool: update.kind ?? step.tool,
      detail: came ? unfenced(came).slice(0, DETAIL_LIMIT) : step.detail,
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
