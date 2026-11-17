import { InvalidInferenceEndpointError } from '@inference/domain/exceptions/invalid-inference-endpoint.error';

const MOST = 200;

export class ModelName {
  private constructor(readonly value: string) {}

  static of(raw: string): ModelName {
    const named = raw.trim();

    if (named.length === 0 || named.length > MOST || /\s/.test(named)) {
      throw new InvalidInferenceEndpointError(
        'model',
        `must be one name of at most ${MOST} characters, such as openai/gpt-5-mini`,
      );
    }

    return new ModelName(named);
  }

  equals(other: ModelName): boolean {
    return this.value === other.value;
  }
}
