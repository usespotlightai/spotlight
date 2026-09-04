import type { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import { InvalidIntegrationError } from '@domain/exceptions/invalid-integration.error';
import type { Signing } from '@domain/value-objects/signing.vo';
import type { SourceKey } from '@domain/value-objects/source-key.vo';

/**
 * An entity of a team's configuration: identified by its source within it,
 * with no repository, read out of the files each time they are.
 *
 * It holds the vocabulary and how the host signs, not the reading of a
 * delivery. Those rules are written beside it in a language the domain has no
 * opinion about.
 */
export class Integration {
  private constructor(
    readonly source: SourceKey,
    readonly name: string,
    readonly signing: Signing,
    readonly declares: readonly DeclaredHappening[],
  ) {}

  static of(input: {
    source: SourceKey;
    name?: string;
    signing: Signing;
    declares: readonly DeclaredHappening[];
  }): Integration {
    // A host that raises nothing is one nobody could wait on.
    if (input.declares.length === 0) {
      throw new InvalidIntegrationError(
        input.source.value,
        'raises no words, so nothing here could ever wait for it',
      );
    }

    for (const declared of input.declares) {
      // A file raising another host's words would have stations waiting on
      // something this source never says.
      if (!input.source.raises(declared.happening)) {
        throw new InvalidIntegrationError(
          input.source.value,
          `raises ${declared.happening.value}, which is another source's word`,
        );
      }
    }

    const words = input.declares.map((each) => each.happening.value);

    // Two rules for one word would have the second never reached, quietly.
    if (new Set(words).size !== words.length) {
      throw new InvalidIntegrationError(
        input.source.value,
        'says one of its words twice',
      );
    }

    return new Integration(
      input.source,
      (input.name ?? input.source.value).trim() || input.source.value,
      input.signing,
      input.declares,
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
