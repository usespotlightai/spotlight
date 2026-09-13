import type { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import type { DeclaredTool } from '@domain/entities/declared-tool.entity';
import { InvalidIntegrationError } from '@domain/exceptions/invalid-integration.error';
import type { SecretName } from '@domain/value-objects/secret-name.vo';
import type { SourceKey } from '@domain/value-objects/source-key.vo';

export class Integration {
  private constructor(
    readonly source: SourceKey,
    readonly name: string,
    readonly declares: readonly DeclaredHappening[],
    readonly credentials: readonly SecretName[],
    readonly connects: boolean,
    readonly offers: readonly DeclaredTool[],
  ) {}

  static of(input: {
    source: SourceKey;
    name?: string;
    declares: readonly DeclaredHappening[];
    credentials?: readonly SecretName[];
    connects?: boolean;
    offers?: readonly DeclaredTool[];
  }): Integration {
    for (const declared of input.declares) {
      if (!input.source.raises(declared.happening)) {
        throw new InvalidIntegrationError(
          input.source.value,
          `raises ${declared.happening.value}, which is another source's word`,
        );
      }
    }

    const words = input.declares.map((each) => each.happening.value);

    if (new Set(words).size !== words.length) {
      throw new InvalidIntegrationError(
        input.source.value,
        'says one of its words twice',
      );
    }

    const offers = input.offers ?? [];

    for (const offered of offers) {
      if (!offered.tool.isOfferedBy(input.source)) {
        throw new InvalidIntegrationError(
          input.source.value,
          `offers ${offered.tool.value}, which is named for another integration`,
        );
      }
    }

    const tools = offers.map((each) => each.tool.value);

    if (new Set(tools).size !== tools.length) {
      throw new InvalidIntegrationError(
        input.source.value,
        'offers one of its tools twice',
      );
    }

    return new Integration(
      input.source,
      (input.name ?? input.source.value).trim() || input.source.value,
      input.declares,
      input.credentials ?? [],
      input.connects ?? false,
      offers,
    );
  }

  raises(happening: { readonly value: string }): boolean {
    return this.declares.some(
      (each) => each.happening.value === happening.value,
    );
  }

  equals(other: Integration): boolean {
    return this.source.equals(other.source);
  }
}
