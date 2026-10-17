import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const CAUSE_KINDS = ['event', 'hook', 'delivery', 'callback'] as const;

type CauseKind = (typeof CAUSE_KINDS)[number];

export interface CauseLink {
  readonly kind: CauseKind;
  readonly key: string;
  readonly description: string;
}

const MAX_LINKS = 32;

const MAX_KEY = 500;

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
        `is ${input.depth} deep but has ${input.links.length} links`,
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
    if (
      !isKind(link?.kind) ||
      !link.key ||
      typeof link.description !== 'string'
    ) {
      throw new InconsistentStateError(
        'causal chain',
        'has a link without a description',
      );
    }

    return {
      kind: link.kind,
      key: link.key.slice(0, MAX_KEY),
      description: link.description,
    };
  }

  get started(): boolean {
    return this.depth > 0;
  }

  followedBy(link: CauseLink): CausalChain {
    return new CausalChain(
      [...this.links, CausalChain.linkOf(link)].slice(-MAX_LINKS),
      this.depth + 1,
    );
  }

  contains(key: string): boolean {
    return this.links.some((each) => each.key === key.slice(0, MAX_KEY));
  }

  get description(): string {
    const described = this.links.map((each) => each.description).join(' → ');

    return this.depth > this.links.length ? `… → ${described}` : described;
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
