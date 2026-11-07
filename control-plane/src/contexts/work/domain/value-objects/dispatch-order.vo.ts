import type { JsonObject } from '@shared-kernel/domain/json-value';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { InvalidDispatchTransitionError } from '@work/domain/exceptions/invalid-dispatch-transition.error';
import type { DispatchKind } from '@work/domain/value-objects/dispatch-subject.vo';

export type DispatchOrderKind = 'run' | 'trial';

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))
        .map(([key, each]) => [key, canonical(each)]),
    );
  }

  return value;
};

export class DispatchOrder {
  private constructor(
    readonly kind: DispatchOrderKind,
    readonly runId: RunId,
    readonly snapshot: JsonObject,
  ) {}

  static of(input: {
    readonly kind: DispatchOrderKind;
    readonly runId: RunId;
    readonly snapshot: JsonObject;
  }): DispatchOrder {
    if (Object.keys(input.snapshot).length === 0) {
      throw new InvalidDispatchTransitionError(
        `The order of run ${input.runId.value} is empty.`,
      );
    }

    return new DispatchOrder(input.kind, input.runId, input.snapshot);
  }

  static kindFor(subject: DispatchKind): DispatchOrderKind {
    return subject === 'trial' ? 'trial' : 'run';
  }

  fits(subject: DispatchKind, runId: RunId): boolean {
    return (
      this.kind === DispatchOrder.kindFor(subject) && this.runId.equals(runId)
    );
  }

  equals(other: DispatchOrder): boolean {
    return (
      this.kind === other.kind &&
      this.runId.equals(other.runId) &&
      JSON.stringify(canonical(this.snapshot)) ===
        JSON.stringify(canonical(other.snapshot))
    );
  }
}
