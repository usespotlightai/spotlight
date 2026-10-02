import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const CAUSE_KINDS = ['event', 'hook', 'delivery', 'callback'] as const;

type CauseKind = (typeof CAUSE_KINDS)[number];

export interface CauseLink {
  readonly kind: CauseKind;
  readonly key: string;
  readonly saying: string;
}

const MOST_KEPT = 32;

const MOST_KEY = 500;

const isKind = (kind: unknown): kind is CauseKind =>
  CAUSE_KINDS.some((each) => each === kind);

export class CausalChain {
  private constructor(
    readonly links: readonly CauseLink[],
    readonly depth: number,
  ) {}

  static none(): CausalChain {
    return new CausalChain([], 0);
  }

  static rehydrate(input: {
    links: readonly CauseLink[];
    depth: number;
  }): CausalChain {
    if (!Number.isInteger(input.depth) || input.depth < input.links.length) {
      throw new InconsistentStateError(
        'causal chain',
        `is ${input.depth} deep yet holds ${input.links.length} links`,
      );
    }

    return new CausalChain(input.links.map(CausalChain.linkOf), input.depth);
  }

  static read(stored: unknown): CausalChain {
    if (stored === null) {
      return CausalChain.none();
    }

    const { links, depth } = (stored ?? {}) as {
      links?: unknown;
      depth?: unknown;
    };

    if (!Array.isArray(links) || typeof depth !== 'number') {
      throw new InconsistentStateError(
        'causal chain',
        'is not a list of links with a depth',
      );
    }

    return CausalChain.rehydrate({ links, depth });
  }

  private static linkOf(link: CauseLink): CauseLink {
    if (!isKind(link?.kind) || !link.key || typeof link.saying !== 'string') {
      throw new InconsistentStateError(
        'causal chain',
        'holds a link that says nothing of what it was',
      );
    }

    return {
      kind: link.kind,
      key: link.key.slice(0, MOST_KEY),
      saying: link.saying,
    };
  }

  get started(): boolean {
    return this.depth > 0;
  }

  followedBy(link: CauseLink): CausalChain {
    return new CausalChain(
      [...this.links, CausalChain.linkOf(link)].slice(-MOST_KEPT),
      this.depth + 1,
    );
  }

  holds(key: string): boolean {
    return this.links.some((each) => each.key === key.slice(0, MOST_KEY));
  }

  get saying(): string {
    const said = this.links.map((each) => each.saying).join(' → ');

    return this.depth > this.links.length ? `… → ${said}` : said;
  }

  get stored(): { links: readonly CauseLink[]; depth: number } {
    return { links: this.links, depth: this.depth };
  }

  equals(other: CausalChain): boolean {
    return (
      this.depth === other.depth &&
      this.links.length === other.links.length &&
      this.links.every((each, at) => each.key === other.links[at]?.key)
    );
  }
}
