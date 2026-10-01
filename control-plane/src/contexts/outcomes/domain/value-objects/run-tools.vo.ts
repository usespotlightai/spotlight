import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import type { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';

export interface ServerCalls {
  readonly server: string;
  readonly calls: number;
  readonly failed: number;
  readonly latency: LatencyHistogram;
  readonly lastCallFailed: boolean;
}

const whole = (count: number): boolean =>
  Number.isSafeInteger(count) && count >= 0;

const blank = (text: string): boolean => text.trim().length === 0;

const checked = (each: ServerCalls): ServerCalls => {
  if (blank(each.server)) {
    throw new InvalidOutcomeError('names each server it called');
  }
  if (!whole(each.calls) || each.calls === 0) {
    throw new InvalidOutcomeError('called each server it names at least once');
  }
  if (!whole(each.failed) || each.failed > each.calls) {
    throw new InvalidOutcomeError('failed no more calls than it made');
  }
  if (each.latency.timed > each.calls) {
    throw new InvalidOutcomeError('timed no more calls than it made');
  }
  if (each.calls - each.latency.timed > each.failed) {
    throw new InvalidOutcomeError(
      'counted every call that never finished as failed',
    );
  }
  if (each.lastCallFailed && each.failed === 0) {
    throw new InvalidOutcomeError(
      'ended on a failed call to a server only where one failed',
    );
  }

  return { ...each };
};

export class RunTools {
  private constructor(
    readonly servers: readonly ServerCalls[],
    readonly skillsRead: readonly string[],
  ) {}

  static readonly NONE = new RunTools([], []);

  static of(input: {
    servers: readonly ServerCalls[];
    skillsRead: readonly string[];
  }): RunTools {
    const servers = input.servers.map(checked);

    if (new Set(servers.map((each) => each.server)).size !== servers.length) {
      throw new InvalidOutcomeError('counts each server it called once');
    }
    if (input.skillsRead.some(blank)) {
      throw new InvalidOutcomeError('names each skill it read');
    }

    return new RunTools(servers, [...new Set(input.skillsRead)]);
  }

  callsTo(server: string): ServerCalls | null {
    return this.servers.find((each) => each.server === server) ?? null;
  }

  read(skill: string): boolean {
    return this.skillsRead.includes(skill);
  }
}
