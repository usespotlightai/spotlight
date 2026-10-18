import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
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
    throw new InvalidOutcomeError('must name each server called');
  }
  if (!whole(each.calls) || each.calls === 0) {
    throw new InvalidOutcomeError('must call each named server at least once');
  }
  if (!whole(each.failed) || each.failed > each.calls) {
    throw new InvalidOutcomeError('failed calls cannot exceed calls made');
  }
  if (each.latency.timed > each.calls) {
    throw new InvalidOutcomeError('timed calls cannot exceed calls made');
  }
  if (each.calls - each.latency.timed > each.failed) {
    throw new InvalidOutcomeError('must count every unfinished call as failed');
  }
  if (each.lastCallFailed && each.failed === 0) {
    throw new InvalidOutcomeError(
      'can end on a failed server call only when one failed',
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
      throw new InvalidOutcomeError('must count each server once');
    }
    if (input.skillsRead.some(blank)) {
      throw new InvalidOutcomeError('must name each skill read');
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
