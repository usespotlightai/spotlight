import { Injectable } from '@nestjs/common';
import { context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';

export interface ReadinessCheck {
  readonly name: string;
  check(signal: AbortSignal): Promise<void>;
}

export type CheckOutcome =
  | { readonly name: string; readonly ok: true }
  | { readonly name: string; readonly ok: false; readonly error: unknown };

export const READINESS_TIMEOUT_MS = 1_500;

const REUSED_FOR_MS = 5_000;

const timedOut = (name: string, ms: number) =>
  new Error(`${name} did not answer in ${ms} ms`);

@Injectable()
export class ReadinessChecks {
  readonly #checks = new Map<string, ReadinessCheck>();
  #last: { at: number; outcomes: Promise<CheckOutcome[]> } | null = null;

  register(check: ReadinessCheck): void {
    if (this.#checks.has(check.name)) {
      throw new Error(`Two readiness checks are both called ${check.name}`);
    }

    this.#checks.set(check.name, check);
  }

  run(): Promise<CheckOutcome[]> {
    const now = Date.now();

    if (!this.#last || now - this.#last.at > REUSED_FOR_MS) {
      this.#last = { at: now, outcomes: this.checked(READINESS_TIMEOUT_MS) };
    }

    return this.#last.outcomes;
  }

  checked(timeoutMs: number): Promise<CheckOutcome[]> {
    return context.with(suppressTracing(context.active()), () =>
      this.all(timeoutMs),
    );
  }

  private all(timeoutMs: number): Promise<CheckOutcome[]> {
    return Promise.all(
      [...this.#checks.values()]
        .sort((one, other) => one.name.localeCompare(other.name))
        .map((each) => this.outcome(each, timeoutMs)),
    );
  }

  private async outcome(
    check: ReadinessCheck,
    timeoutMs: number,
  ): Promise<CheckOutcome> {
    const abort = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = timedOut(check.name, timeoutMs);
        abort.abort(error);
        reject(error);
      }, timeoutMs);
    });

    try {
      await Promise.race([check.check(abort.signal), deadline]);
      return { name: check.name, ok: true };
    } catch (error) {
      return { name: check.name, ok: false, error };
    } finally {
      clearTimeout(timer);
    }
  }
}
