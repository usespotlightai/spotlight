import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

const DESCRIBED_KINDS = ['openapi', 'graphql'] as const;

export type DescribedKind = (typeof DESCRIBED_KINDS)[number];

const DEEPEST_SELECTION = 5;

const DESCRIPTIONS: Readonly<Record<DescribedKind, string>> = {
  openapi: 'OpenAPI description',
  graphql: 'GraphQL schema',
};

const isWebAddress = (raw: string): boolean => {
  try {
    const url = new URL(raw);

    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

export class DescribedSource {
  private constructor(
    readonly kind: DescribedKind,
    readonly url: string | null,
    readonly document: string | null,
    readonly baseUrl: string | null,
    readonly depth: number | null,
    readonly wears: readonly SecretName[],
    readonly connected: boolean,
    readonly fingerprint: string,
  ) {}

  static of(input: {
    kind: DescribedKind;
    url?: string | null;
    document?: string | null;
    baseUrl?: string | null;
    depth?: number | null;
    wears?: readonly SecretName[];
    connected?: boolean;
    fingerprint: string;
  }): DescribedSource {
    const refuse = (because: string) =>
      new InvalidIntegrationPartError(input.kind, because);
    const url = input.url ?? null;
    const document = input.document ?? null;
    const baseUrl = input.baseUrl ?? null;
    const depth = input.depth ?? null;

    if (url === null && document === null) {
      throw refuse('is read from a url, or written out as its document');
    }

    if (url !== null && !isWebAddress(url)) {
      throw refuse('is read from a web address, as in https://…');
    }

    if (document !== null && document.trim() === '') {
      throw refuse('holds a document with nothing in it');
    }

    if (input.kind === 'graphql' && url === null) {
      throw refuse('is called at its url, which it does not name');
    }

    if (baseUrl !== null && !isWebAddress(baseUrl)) {
      throw refuse('calls a base URL that is not a web address');
    }

    if (
      depth !== null &&
      (!Number.isInteger(depth) || depth < 1 || depth > DEEPEST_SELECTION)
    ) {
      throw refuse(
        `selects fields 1 to ${DEEPEST_SELECTION} levels deep in what it answers`,
      );
    }

    if (input.fingerprint.trim() === '') {
      throw refuse('was compiled without a fingerprint');
    }

    return new DescribedSource(
      input.kind,
      url,
      document,
      baseUrl,
      depth,
      input.wears ?? [],
      input.connected ?? false,
      input.fingerprint,
    );
  }

  get described(): string {
    return DESCRIPTIONS[this.kind];
  }

  get readsUrl(): boolean {
    return this.document === null;
  }
}
