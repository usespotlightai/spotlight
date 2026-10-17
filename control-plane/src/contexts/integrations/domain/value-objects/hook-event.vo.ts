import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export type HookTiming = 'before' | 'after';

interface Described {
  readonly timing: HookTiming;
  readonly inRun: boolean;
  readonly aboutTool: boolean;
  readonly aboutChanges: boolean;
}

const DESCRIBED = {
  'tool.using': {
    timing: 'before',
    inRun: true,
    aboutTool: true,
    aboutChanges: false,
  },
  'tool.used': {
    timing: 'after',
    inRun: true,
    aboutTool: true,
    aboutChanges: false,
  },
  'run.starting': {
    timing: 'before',
    inRun: true,
    aboutTool: false,
    aboutChanges: false,
  },
  'run.ended': {
    timing: 'after',
    inRun: true,
    aboutTool: false,
    aboutChanges: false,
  },
  'handover.submitting': {
    timing: 'before',
    inRun: true,
    aboutTool: false,
    aboutChanges: false,
  },
  'pull-request.opening': {
    timing: 'before',
    inRun: true,
    aboutTool: false,
    aboutChanges: true,
  },
  'pull-request.merged': {
    timing: 'after',
    inRun: false,
    aboutTool: false,
    aboutChanges: true,
  },
  'task.opened': {
    timing: 'after',
    inRun: false,
    aboutTool: false,
    aboutChanges: false,
  },
  'task.moved': {
    timing: 'after',
    inRun: false,
    aboutTool: false,
    aboutChanges: false,
  },
} as const satisfies Readonly<Record<string, Described>>;

export type HookEventName = keyof typeof DESCRIBED;

export const HOOK_EVENTS = Object.keys(DESCRIBED) as readonly HookEventName[];

const NAMES: ReadonlySet<string> = new Set(HOOK_EVENTS);

const isHookEvent = (name: string): name is HookEventName => NAMES.has(name);

export class HookEvent {
  private readonly kind = 'hook-event';

  private constructor(readonly name: HookEventName) {}

  static of(name: string): HookEvent {
    if (!isHookEvent(name)) {
      throw new InvalidIdentifierError(
        'hook event',
        `is one of ${HOOK_EVENTS.join(', ')}`,
      );
    }

    return new HookEvent(name);
  }

  get timing(): HookTiming {
    return DESCRIBED[this.name].timing;
  }

  get isBefore(): boolean {
    return this.timing === 'before';
  }

  get inRun(): boolean {
    return DESCRIBED[this.name].inRun;
  }

  get aboutTool(): boolean {
    return DESCRIBED[this.name].aboutTool;
  }

  get aboutChanges(): boolean {
    return DESCRIBED[this.name].aboutChanges;
  }

  equals(other: HookEvent): boolean {
    return this.kind === other.kind && this.name === other.name;
  }

  toString(): string {
    return this.name;
  }
}
