import { HARNESS_CONNECTED } from '@runs/domain/value-objects/journal-entry-type';
import {
  type AgentMessage,
  type ChildChanged,
  type FileChange,
  HARNESS_EVENTS_VERSION,
  HARNESS_FRAME,
  type HarnessConnected,
  type HarnessEvent,
  type PlanEntry,
  type ToolChanged,
  type ToolLocation,
  type TurnUsage,
} from '@runs/infrastructure/journal/harness-events';
import {
  decoded,
  type Journalled,
} from '@runs/infrastructure/journal/journalled';

export interface JournalRow extends Journalled {
  readonly seq: number;
}

const ACP_1 = 'acp/1';

const ACP_1_REPORTS: HarnessConnected['reports'] = {
  background: false,
  selfStartedTurns: false,
  turnUsage: true,
  commandOutput: false,
};

const BRIDGE_SERVER = 'mcp__acp__';

const BRIDGE_TOOLS = new Set([
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'Bash',
  'BashOutput',
  'KillShell',
]);

type Data = Record<string, unknown>;

const isObject = (value: unknown): value is Data =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringIn = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const integerIn = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;

const present = (value: unknown): boolean =>
  value !== undefined && value !== null;

const json = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

const encoded = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64');

const isOldFrame = (row: Journalled): boolean =>
  row.type === 'output' && row.message === null && row.data !== null;

export const isAcp1Journal = (rows: readonly Journalled[]): boolean =>
  rows.some(
    (row) =>
      isOldFrame(row) ||
      row.type === 'usage' ||
      (row.type === HARNESS_CONNECTED && row.data === null),
  );

const nameOf = (named: unknown): string => {
  const name = stringIn(named).trim();
  const tool = name.startsWith(BRIDGE_SERVER)
    ? name.slice(BRIDGE_SERVER.length)
    : null;

  return tool !== null && BRIDGE_TOOLS.has(tool) ? tool : name;
};

const stopOf = (reason: string): NonNullable<ChildChanged['stop']> => {
  switch (reason) {
    case 'end_turn':
      return 'ended';
    case 'max_tokens':
    case 'max_turn_requests':
      return 'cut-short';
    case 'refusal':
      return 'refused';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'failed';
  }
};

const childStateOf = (state: Data): Pick<ChildChanged, 'state' | 'stop'> => {
  switch (state.state) {
    case 'running':
      return { state: 'running' };
    case 'requires_action':
      return { state: 'needs-action' };
    case 'idle':
      return typeof state.stopReason === 'string'
        ? { state: 'idle', stop: stopOf(state.stopReason) }
        : { state: 'idle' };
    default:
      return {};
  }
};

const blocksOf = (content: unknown): Data[] => {
  if (Array.isArray(content)) {
    return content.filter(isObject);
  }
  if (isObject(content) && stringIn(content.text)) {
    return [{ type: 'content', content: { text: content.text } }];
  }
  return [];
};

const filesIn = (blocks: readonly Data[]): FileChange[] =>
  blocks.flatMap((block) => {
    const path = stringIn(block.path);
    if (block.type !== 'diff' || !path) {
      return [];
    }

    const before = typeof block.oldText === 'string' ? block.oldText : null;
    const after = typeof block.newText === 'string' ? block.newText : null;

    return [
      {
        path,
        operation: before === null ? 'create' : 'update',
        ...(before === null ? {} : { before }),
        ...(after === null ? {} : { after }),
      },
    ];
  });

const joined = (texts: readonly string[]): string =>
  texts.filter(Boolean).join('\n').trim();

const toolTextIn = (blocks: readonly Data[]): string =>
  joined(
    blocks.map((block) =>
      isObject(block.content) ? stringIn(block.content.text) : '',
    ),
  );

const textIn = (content: unknown): string =>
  Array.isArray(content)
    ? joined(
        content.map((block) => (isObject(block) ? stringIn(block.text) : '')),
      )
    : '';

const locationsOf = (locations: readonly unknown[]): ToolLocation[] =>
  locations.flatMap((each) => {
    if (!isObject(each) || !stringIn(each.path)) {
      return [];
    }
    const line = integerIn(each.line);
    return [
      line === undefined
        ? { path: each.path as string }
        : { path: each.path as string, line },
    ];
  });

const planOf = (entries: unknown): PlanEntry[] =>
  (Array.isArray(entries) ? entries : []).filter(isObject).map((each) => ({
    content: stringIn(each.content),
    ...(stringIn(each.status) ? { status: stringIn(each.status) } : {}),
    ...(stringIn(each.priority) ? { priority: stringIn(each.priority) } : {}),
  }));

const inSession = (session: string): { session?: string } =>
  session ? { session } : {};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface Speech {
  readonly role: AgentMessage['role'];
  readonly id: string;
}

class Acp1Translator {
  readonly #tools = new Map<string, Mutable<ToolChanged>>();
  readonly #speaking = new Map<string, Speech>();
  #messages = 0;

  constructor(private readonly root: string) {}

  turned(): void {
    this.#speaking.clear();
  }

  translate(params: unknown): HarnessEvent[] {
    if (!isObject(params) || !isObject(params.update)) {
      return [];
    }

    const session = this.sessionOf(params.sessionId);
    const update = params.update;

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        return this.said(session, 'agent', update.content);
      case 'agent_thought_chunk':
        return this.said(session, 'thought', update.content);
      case 'user_message_chunk':
        return this.said(session, 'user', update.content);
      case 'tool_call':
      case 'tool_call_update':
        return this.called(session, update);
      case 'plan':
        this.#speaking.delete(session);
        return [
          {
            type: 'plan.changed',
            data: { ...inSession(session), entries: planOf(update.entries) },
          },
        ];
      case 'usage_update':
        return this.contextChanged(session, update);
      case 'subagent_update':
        return this.childChanged(session, update);
      case 'session_message':
        return this.childMessage(session, update);
      default:
        return [];
    }
  }

  private sessionOf(id: unknown): string {
    const session = stringIn(id);
    return session === this.root ? '' : session;
  }

  private said(
    session: string,
    role: AgentMessage['role'],
    content: unknown,
  ): HarnessEvent[] {
    const text = isObject(content) ? stringIn(content.text) : '';
    if (!text) {
      return [];
    }

    let current = this.#speaking.get(session);
    if (current?.role !== role) {
      this.#messages++;
      current = { role, id: `m${this.#messages}` };
      this.#speaking.set(session, current);
    }

    return [
      {
        type: 'message',
        data: { ...inSession(session), id: current.id, role, text },
      },
    ];
  }

  private called(session: string, update: Data): HarnessEvent[] {
    const id = stringIn(update.toolCallId);
    if (!id) {
      return [];
    }

    const key = `${session}\u0000${id}`;
    let call = this.#tools.get(key);
    if (!call && update.sessionUpdate === 'tool_call_update') {
      return [];
    }
    if (!call) {
      this.#speaking.delete(session);
      call = { ...inSession(session), id, title: 'a tool' };
      this.#tools.set(key, call);
    }

    const meta = isObject(update._meta) ? update._meta : {};
    const claudeCode = isObject(meta.claudeCode) ? meta.claudeCode : {};
    const name = nameOf(claudeCode.toolName);
    if (name) {
      call.name = name;
    }
    if (typeof update.title === 'string') {
      call.title = update.title;
    }
    if (typeof update.kind === 'string') {
      call.kind = update.kind;
    }
    if (typeof update.status === 'string') {
      call.status = update.status;
    }
    if (present(update.rawInput)) {
      call.input = update.rawInput;
    }
    if (present(update.rawOutput)) {
      call.output = update.rawOutput;
    }
    if (Array.isArray(update.locations)) {
      const locations = locationsOf(update.locations);
      if (locations.length > 0) {
        call.locations = locations;
      } else {
        delete call.locations;
      }
    }

    const blocks = blocksOf(update.content);
    const files = filesIn(blocks);
    if (files.length > 0) {
      call.files = files;
    }

    const events: HarnessEvent[] = [
      { type: 'tool.changed', data: { ...call } },
    ];
    const text = toolTextIn(blocks);
    if (text) {
      events.push({
        type: 'tool.output',
        data: { ...inSession(session), id, text, replace: true },
      });
    }

    return events;
  }

  private contextChanged(session: string, update: Data): HarnessEvent[] {
    const used = integerIn(update.used);
    const size = integerIn(update.size);
    if (used === undefined || size === undefined) {
      return [];
    }

    const cost = isObject(update.cost)
      ? {
          cost: {
            amount:
              typeof update.cost.amount === 'number' ? update.cost.amount : 0,
            currency: stringIn(update.cost.currency),
          },
        }
      : {};

    return [
      {
        type: 'context.changed',
        data: { ...inSession(session), used, size, ...cost },
      },
    ];
  }

  private childChanged(session: string, update: Data): HarnessEvent[] {
    const child = stringIn(update.sessionId);
    if (!child) {
      return [];
    }

    this.#speaking.delete(session);
    const title = stringIn(update.title);
    const description = stringIn(update.description);

    return [
      {
        type: 'child.changed',
        data: {
          ...inSession(session),
          child,
          ...(title ? { title } : {}),
          ...(description ? { description } : {}),
          ...(isObject(update.state) ? childStateOf(update.state) : {}),
        },
      },
    ];
  }

  private childMessage(session: string, update: Data): HarnessEvent[] {
    const text = textIn(update.content);
    if (!text) {
      return [];
    }

    const from = this.sessionOf(update.senderSessionId);
    const to = this.sessionOf(update.recipientSessionId);

    return [
      {
        type: 'child.message',
        data: {
          ...inSession(session),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          text,
        },
      },
    ];
  }
}

const usageOf = (raw: unknown): TurnUsage | null => {
  if (!isObject(raw)) {
    return null;
  }

  const usage: Mutable<TurnUsage> = {};
  const input = integerIn(raw.inputTokens);
  const output = integerIn(raw.outputTokens);
  const cacheRead = integerIn(raw.cachedReadTokens);
  const cacheWrite = integerIn(raw.cachedWriteTokens);
  if (input !== undefined) usage.input = input;
  if (output !== undefined) usage.output = output;
  if (cacheRead !== undefined) usage.cacheRead = cacheRead;
  if (cacheWrite !== undefined) usage.cacheWrite = cacheWrite;

  return usage;
};

const rootOf = (frames: readonly unknown[]): string => {
  const children = new Set<string>();
  for (const params of frames) {
    if (
      isObject(params) &&
      isObject(params.update) &&
      params.update.sessionUpdate === 'subagent_update'
    ) {
      children.add(stringIn(params.update.sessionId));
    }
  }

  for (const params of frames) {
    const session = isObject(params) ? stringIn(params.sessionId) : '';
    if (session && !children.has(session)) {
      return session;
    }
  }

  return '';
};

const frameOf = (protocol: string, params: string): string => {
  const line =
    json(params) === undefined
      ? JSON.stringify(params)
      : `{"jsonrpc":"2.0","method":"session/update","params":${params}}`;

  return Buffer.from(
    `{"protocol":${JSON.stringify(protocol)},"data":${line}}`,
  ).toString('base64');
};

type Unnumbered = Omit<JournalRow, 'seq'>;

export const rewrittenAcp1Journal = (
  rows: readonly JournalRow[],
): JournalRow[] => {
  const ordered = rows
    .filter((row) => row.seq >= 1)
    .sort((a, b) => a.seq - b.seq);
  const params = new Map(
    ordered
      .filter(isOldFrame)
      .map((row) => [row, decoded(row.data ?? '')] as const),
  );
  const root = rootOf([...params.values()].map((frame) => json(frame)));
  const connectedRow = ordered.find((row) => row.type === HARNESS_CONNECTED);
  const protocol = connectedRow?.message || ACP_1;
  const connected = (at: Date): Unnumbered => ({
    type: HARNESS_CONNECTED,
    at,
    message: null,
    data: encoded({
      protocol,
      events: HARNESS_EVENTS_VERSION,
      session: root,
      reports: ACP_1_REPORTS,
    } satisfies HarnessConnected),
  });

  const translator = new Acp1Translator(root);
  const rewritten: Unnumbered[] = [];
  let announced = false;
  let turns = 0;

  const announce = (at: Date): void => {
    if (!announced) {
      rewritten.push(connected(at));
      announced = true;
    }
  };

  const happened = (events: readonly HarnessEvent[], at: Date): void => {
    for (const event of events) {
      rewritten.push({
        type: event.type,
        at,
        message: null,
        data: encoded(event.data),
      });
    }
  };

  for (const row of ordered) {
    const frame = params.get(row);

    if (row.type === HARNESS_CONNECTED) {
      rewritten.push(connected(row.at));
      announced = true;
    } else if (frame !== undefined) {
      announce(row.at);
      rewritten.push({
        type: HARNESS_FRAME,
        at: row.at,
        message: null,
        data: frameOf(protocol, frame),
      });
      happened(translator.translate(json(frame)), row.at);
    } else if (row.type === 'usage') {
      announce(row.at);
      turns++;
      const usage = usageOf(json(decoded(row.data ?? '')));
      happened(
        [
          {
            type: 'turn.ended',
            data: { turn: turns, stop: 'ended', ...(usage ? { usage } : {}) },
          },
        ],
        row.at,
      );
      translator.turned();
    } else {
      rewritten.push({
        type: row.type,
        at: row.at,
        message: row.message,
        data: row.data,
      });
    }
  }

  return rewritten.map((row, at) => ({ ...row, seq: at + 1 }));
};
