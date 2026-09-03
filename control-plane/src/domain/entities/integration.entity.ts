import type { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import { InvalidIntegrationError } from '@domain/exceptions/invalid-integration.error';
import type { Signing } from '@domain/value-objects/signing.vo';
import type { SourceKey } from '@domain/value-objects/source-key.vo';

/**
 * A host a workspace told Spotlight to listen to, as against one Spotlight
 * was written for. It holds the vocabulary — which words this host can raise,
 * what each is called, and how each reads in a note — and how the host proves
 * a delivery is its own.
 *
 * An entity of the workspace's configuration rather than a thing in its own
 * right: it is identified by its source within that configuration, has no
 * repository, and is read out of the files each time they are. Nothing here
 * outlives the reading it came from.
 *
 * It does not hold the reading of a delivery. Which word a given delivery is,
 * and what it says the task is, are rules written beside it in a language the
 * domain has no opinion about. What the domain insists on is that the words
 * are this source's, that each is said once, and that every one of them could
 * reach a task at all.
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

  /** Whether this host says a given word at all. */
  raises(happening: { readonly value: string }): boolean {
    return this.declares.some(
      (each) => each.happening.value === happening.value,
    );
  }

  equals(other: Integration): boolean {
    return this.source.equals(other.source);
  }
}
