import type { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { InvalidToolUseError } from '@work/domain/exceptions/invalid-tool-use.error';

export interface ServerCalls {
  readonly server: string;
  readonly calls: number;
  readonly failed: number;
  readonly latency: LatencyHistogram;
  readonly lastCallFailed: boolean;
}

const whole = (count: number): boolean =>
  Number.isSafeInteger(count) && count >= 0;

const checked = (each: ServerCalls): ServerCalls => {
  if (each.server.trim().length === 0) {
    throw new InvalidToolUseError('names each server it called');
  }
  if (!whole(each.calls) || each.calls === 0) {
    throw new InvalidToolUseError('counts at least one call to each server');
  }
  if (!whole(each.failed) || each.failed > each.calls) {
    throw new InvalidToolUseError('fails no more calls than it made');
  }
  if (each.latency.timed > each.calls) {
    throw new InvalidToolUseError('times no more calls than it made');
  }
  if (each.calls - each.latency.timed > each.failed) {
    throw new InvalidToolUseError(
      'counts every call that never finished as failed',
    );
  }
  if (each.lastCallFailed && each.failed === 0) {
    throw new InvalidToolUseError('breaks on a server only by a failed call');
  }

  return { ...each };
};

const byName = (one: string, other: string): number =>
  one < other ? -1 : one > other ? 1 : 0;

export class ToolUse {
  private constructor(
    readonly servers: readonly ServerCalls[],
    readonly skills: readonly string[],
  ) {}

  static readonly NONE = new ToolUse([], []);

  static of(input: {
    servers: readonly ServerCalls[];
    skills: readonly string[];
  }): ToolUse {
    const servers = input.servers.map(checked);

    if (new Set(servers.map((each) => each.server)).size !== servers.length) {
      throw new InvalidToolUseError('counts each server once');
    }
    if (input.skills.some((each) => each.trim().length === 0)) {
      throw new InvalidToolUseError('names each skill it read');
    }

    return new ToolUse(
      [...servers].sort((one, other) => byName(one.server, other.server)),
      [...new Set(input.skills)].sort(byName),
    );
  }
}
