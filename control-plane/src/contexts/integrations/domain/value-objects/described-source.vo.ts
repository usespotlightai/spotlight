import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

const DESCRIBED_KINDS = ['openapi', 'graphql', 'mcp'] as const;

export type DescribedKind = (typeof DESCRIBED_KINDS)[number];

const DEEPEST_SELECTION = 5;

const DESCRIPTIONS: Readonly<Record<DescribedKind, string>> = {
  openapi: 'OpenAPI description',
  graphql: 'GraphQL schema',
  mcp: 'MCP server',
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
    readonly injectedSecrets: readonly SecretName[],
    readonly connected: boolean,
    readonly fingerprint: string,
  ) {}

  static of(input: {
    kind: DescribedKind;
    url?: string | null;
    document?: string | null;
    baseUrl?: string | null;
    depth?: number | null;
    injectedSecrets?: readonly SecretName[];
    connected?: boolean;
    fingerprint: string;
  }): DescribedSource {
    const invalid = (because: string) =>
      new InvalidIntegrationPartError(input.kind, because);
    const url = input.url ?? null;
    const document = input.document ?? null;
    const baseUrl = input.baseUrl ?? null;
    const depth = input.depth ?? null;

    if (url === null && document === null) {
      throw invalid('is read from a url, or written out as its document');
    }

    if (url !== null && !isWebAddress(url)) {
      throw invalid('is read from a web address, as in https://…');
    }

    if (document !== null && document.trim() === '') {
      throw invalid('has a document with nothing in it');
    }

    if (input.kind !== 'openapi' && url === null) {
      throw invalid('names no url to call');
    }

    if (input.kind === 'mcp' && document !== null) {
      throw invalid(
        'cannot be written out as a document. An MCP server lists its tools when requested',
      );
    }

    if (baseUrl !== null && !isWebAddress(baseUrl)) {
      throw invalid('calls a base URL that is not a web address');
    }

    if (
      depth !== null &&
      (!Number.isInteger(depth) || depth < 1 || depth > DEEPEST_SELECTION)
    ) {
      throw invalid(
        `selects fields 1 to ${DEEPEST_SELECTION} levels deep in what it answers`,
      );
    }

    if (input.fingerprint.trim() === '') {
      throw invalid('was compiled without a fingerprint');
    }

    return new DescribedSource(
      input.kind,
      url,
      document,
      baseUrl,
      depth,
      input.injectedSecrets ?? [],
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
