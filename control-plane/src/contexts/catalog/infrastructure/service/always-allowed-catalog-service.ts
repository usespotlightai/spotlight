import type { CatalogInputValues } from '@catalog/application/contracts/catalog.contract';
import type {
  CatalogCallFor,
  CatalogServicePort,
} from '@catalog/application/ports/catalog-service.port';
import type { CatalogTool } from '@catalog/domain/entities/catalog-item.entity';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';

type Fetch = typeof globalThis.fetch;

const TIMEOUT_MS = 30_000;

export class AlwaysAllowedCatalogService implements CatalogServicePort {
  private readonly spotlightsCatalog: URL;

  constructor(
    spotlightsCatalog: string,
    private readonly token: string | undefined,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {
    this.spotlightsCatalog = new URL(
      spotlightsCatalog.endsWith('/')
        ? spotlightsCatalog
        : `${spotlightsCatalog}/`,
    );
  }

  async call(
    tool: CatalogTool,
    inputs: CatalogInputValues,
    on: CatalogCallFor,
  ): Promise<unknown> {
    const asking = `calling ${tool.id.value}`;
    const address = new URL(
      `tools/${tool.listing.name.value}/${tool.listing.version.value}`,
      this.spotlightsCatalog,
    );

    let reply: Response;

    try {
      reply = await this.fetch(address, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'spotlight-workspace': on.workspaceId.value,
          'spotlight-run': on.runId.value,
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({ inputs }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new UpstreamError(
        asking,
        error instanceof Error ? error.message : String(error),
      );
    }

    const answered = (await reply.json().catch(() => null)) as {
      output?: unknown;
    } | null;

    if (!reply.ok || !answered || !('output' in answered)) {
      throw new UpstreamError(asking, `the catalog answered ${reply.status}`);
    }

    return answered.output;
  }
}
