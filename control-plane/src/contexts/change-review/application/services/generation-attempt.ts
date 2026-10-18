import { GenerationError } from '@change-review/application/errors/generation.error';
import type {
  ChangeStackGenerationRequest,
  ChangeStackGeneratorPort,
  GeneratedChangeStack,
} from '@change-review/application/ports/change-stack-generator.port';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export type GenerationAttempt =
  | { readonly generated: true; readonly answer: GeneratedChangeStack }
  | {
      readonly generated: false;
      readonly usage: ModelCall | null;
      readonly error: unknown;
    };

export const attemptGeneration = async (
  generator: ChangeStackGeneratorPort,
  request: ChangeStackGenerationRequest,
): Promise<GenerationAttempt> => {
  try {
    return { generated: true, answer: await generator.generate(request) };
  } catch (error) {
    return {
      generated: false,
      usage: error instanceof GenerationError ? error.usage : null,
      error,
    };
  }
};
