import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

const AGAIN = Retry.backoff({ most: 4, firstMs: 30_000, longestMs: 600_000 });

export const MEMORY_DRAFTING_FAILURES = {
  'no-evidence': Retry.never(),
  refused: AGAIN,
  unreadable: Retry.backoff({ most: 3, firstMs: 30_000, longestMs: 300_000 }),
  errored: AGAIN,
  interrupted: Retry.never(),
} as const satisfies Record<string, Retry>;

export type MemoryDraftingFailureCode = keyof typeof MEMORY_DRAFTING_FAILURES;

const isCode = (code: string): code is MemoryDraftingFailureCode =>
  Object.keys(MEMORY_DRAFTING_FAILURES).includes(code);

export class MemoryDraftingFailure {
  private constructor(
    readonly code: MemoryDraftingFailureCode,
    readonly at: Date,
  ) {}

  static of(code: string, at: Date): MemoryDraftingFailure {
    if (!isCode(code)) {
      throw InvalidMemoryError.ofDraft(
        `failed in a way nobody knows (${code})`,
      );
    }

    return new MemoryDraftingFailure(code, at);
  }

  get retry(): Retry {
    return MEMORY_DRAFTING_FAILURES[this.code];
  }

  equals(other: MemoryDraftingFailure): boolean {
    return this.code === other.code && this.at.getTime() === other.at.getTime();
  }
}
