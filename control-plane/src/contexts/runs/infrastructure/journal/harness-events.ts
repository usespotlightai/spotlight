import type { BackgroundKind } from '@runs/application/contracts/run-journal.contract';
import {
  decoded,
  type Journalled,
} from '@runs/infrastructure/journal/journalled';

const HARNESS_EVENTS_VERSION = 1;

interface HarnessReports {
  readonly background: boolean;
  readonly selfStartedTurns: boolean;
  readonly turnUsage: boolean;
  readonly commandOutput: boolean;
}

export interface HarnessConnected {
  readonly protocol: string;
  readonly events: number;
  readonly session: string;
  readonly reports: HarnessReports;
}

interface InSession {
  readonly session?: string;
}

export interface TurnStarted extends InSession {
  readonly turn: number;
  readonly origin: 'prompt' | 'self';
  readonly cause?: string;
}

export interface TurnUsage {
  readonly input?: number;
  readonly output?: number;
  readonly cacheRead?: number;
  readonly cacheWrite?: number;
}

type TurnStop = 'ended' | 'cut-short' | 'refused' | 'cancelled' | 'failed';

interface TurnEnded extends InSession {
  readonly turn: number;
  readonly stop: TurnStop;
  readonly reason?: string;
  readonly error?: string;
  readonly usage?: TurnUsage;
}

export type SessionStateName = 'running' | 'needs-action' | 'idle';

interface SessionState extends InSession {
  readonly state: SessionStateName;
}

export interface AgentMessage extends InSession {
  readonly id: string;
  readonly role: 'agent' | 'user' | 'thought';
  readonly text: string;
  readonly replace?: boolean;
}

export interface ToolLocation {
  readonly path: string;
  readonly line?: number;
}

export interface FileChange {
  readonly path: string;
  readonly oldPath?: string;
  readonly operation: 'create' | 'update' | 'delete' | 'move' | 'unstated';
  readonly before?: string;
  readonly after?: string;
}

export interface ToolChanged extends InSession {
  readonly id: string;
  readonly name?: string;
  readonly kind?: string;
  readonly title: string;
  readonly status?: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly locations?: readonly ToolLocation[];
  readonly files?: readonly FileChange[];
  readonly patch?: string;
}

export interface ToolOutput extends InSession {
  readonly id: string;
  readonly text: string;
  readonly replace?: boolean;
}

export interface PlanEntry {
  readonly content: string;
  readonly status?: string;
  readonly priority?: string;
}

interface PlanChanged extends InSession {
  readonly entries: readonly PlanEntry[];
}

export interface BackgroundItem {
  readonly id: string;
  readonly kind: BackgroundKind;
  readonly description: string;
}

interface BackgroundChanged extends InSession {
  readonly items: readonly BackgroundItem[];
}

export interface ChildChanged extends InSession {
  readonly child: string;
  readonly title?: string;
  readonly description?: string;
  readonly state?: SessionStateName;
  readonly stop?: TurnStop;
}

export interface ChildMessage extends InSession {
  readonly from?: string;
  readonly to?: string;
  readonly text: string;
}

export interface ContextChanged extends InSession {
  readonly used: number;
  readonly size: number;
  readonly cost?: { readonly amount: number; readonly currency: string };
}

export type HarnessEvent =
  | { readonly type: 'turn.started'; readonly data: TurnStarted }
  | { readonly type: 'turn.ended'; readonly data: TurnEnded }
  | { readonly type: 'session.state'; readonly data: SessionState }
  | { readonly type: 'message'; readonly data: AgentMessage }
  | { readonly type: 'tool.changed'; readonly data: ToolChanged }
  | { readonly type: 'tool.output'; readonly data: ToolOutput }
  | { readonly type: 'plan.changed'; readonly data: PlanChanged }
  | { readonly type: 'background.changed'; readonly data: BackgroundChanged }
  | { readonly type: 'child.changed'; readonly data: ChildChanged }
  | { readonly type: 'child.message'; readonly data: ChildMessage }
  | { readonly type: 'context.changed'; readonly data: ContextChanged };

type HarnessEventType = HarnessEvent['type'];

export const HARNESS_EVENT_TYPES: ReadonlySet<string> =
  new Set<HarnessEventType>([
    'turn.started',
    'turn.ended',
    'session.state',
    'message',
    'tool.changed',
    'tool.output',
    'plan.changed',
    'background.changed',
    'child.changed',
    'child.message',
    'context.changed',
  ]);

export const HARNESS_FRAME = 'harness.frame';

const parsed = (data: string | null): Record<string, unknown> | null => {
  if (!data) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(decoded(data));
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const harnessConnectedOf = (
  event: Pick<Journalled, 'data'>,
): HarnessConnected | null => {
  const data = parsed(event.data);

  return data &&
    typeof data.protocol === 'string' &&
    data.events === HARNESS_EVENTS_VERSION
    ? (data as unknown as HarnessConnected)
    : null;
};

type Data = Record<string, unknown>;

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isObject = (value: unknown): value is Data =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const listOf =
  (each: (item: Data) => boolean) =>
  (value: unknown): boolean =>
    Array.isArray(value) && value.every((item) => isObject(item) && each(item));

const absentOr =
  (check: (value: unknown) => boolean) =>
  (value: unknown): boolean =>
    value === undefined || check(value);

const located = listOf((each) => isString(each.path));

const filed = listOf((each) => isString(each.path));

const READABLE: Readonly<Record<HarnessEventType, (data: Data) => boolean>> = {
  'turn.started': (data) => isNumber(data.turn),
  'turn.ended': (data) =>
    isNumber(data.turn) &&
    isString(data.stop) &&
    absentOr(isObject)(data.usage),
  'session.state': (data) => isString(data.state),
  message: (data) =>
    isString(data.id) && isString(data.role) && isString(data.text),
  'tool.changed': (data) =>
    isString(data.id) &&
    isString(data.title) &&
    absentOr(located)(data.locations) &&
    absentOr(filed)(data.files),
  'tool.output': (data) => isString(data.id) && isString(data.text),
  'plan.changed': (data) =>
    listOf((each) => isString(each.content))(data.entries),
  'background.changed': (data) => Array.isArray(data.items),
  'child.changed': (data) => isString(data.child),
  'child.message': (data) => isString(data.text),
  'context.changed': (data) =>
    isNumber(data.used) && isNumber(data.size) && absentOr(isObject)(data.cost),
};

const isHarnessEventType = (type: string): type is HarnessEventType =>
  HARNESS_EVENT_TYPES.has(type);

export const harnessEventOf = (
  event: Pick<Journalled, 'type' | 'data'>,
): HarnessEvent | null => {
  if (!isHarnessEventType(event.type)) {
    return null;
  }

  const data = parsed(event.data);

  return data && READABLE[event.type](data)
    ? ({ type: event.type, data } as unknown as HarnessEvent)
    : null;
};
