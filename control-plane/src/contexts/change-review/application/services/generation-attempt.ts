import { GenerationError } from '@change-review/application/errors/generation.error';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export type GenerationAttempt<T> =
  | { readonly generated: true; readonly answer: T }
  | {
      readonly generated: false;
      readonly usage: ModelCall | null;
      readonly truncated: boolean;
      readonly error: unknown;
    };

export const attempted = async <T>(
  call: () => Promise<T>,
): Promise<GenerationAttempt<T>> => {
  try {
    return { generated: true, answer: await call() };
  } catch (error) {
    const failed = error instanceof GenerationError ? error : null;

    return {
      generated: false,
      usage: failed?.usage ?? null,
      truncated: failed?.truncated ?? false,
      error,
    };
  }
};
