import type { CatalogCallResult } from '@catalog/application/contracts/catalog.contract';
import { CatalogEntitledMapper } from '@catalog/application/mappers/catalog-entitled.mapper';
import type { CatalogCallLedgerPort } from '@catalog/application/ports/catalog-call-ledger.port';
import type { CatalogServicePort } from '@catalog/application/ports/catalog-service.port';
import type {
  CatalogCallRequest,
  CatalogCallsPort,
} from '@catalog/application/ports/catalog.port';
import type { WorkspacePlansPort } from '@catalog/application/ports/workspace-plans.port';
import type { CatalogItems } from '@catalog/domain/repositories/catalog-items.repository';
import { resolveEntitled } from '@catalog/domain/services/entitlement-resolution';
import { CatalogCall } from '@catalog/domain/value-objects/catalog-call.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

export class CatalogCalls implements CatalogCallsPort {
  constructor(
    private readonly catalog: CatalogItems,
    private readonly plans: WorkspacePlansPort,
    private readonly ledger: CatalogCallLedgerPort,
    private readonly service: CatalogServicePort,
    private readonly clock: ClockPort,
  ) {}

  async call(request: CatalogCallRequest): Promise<CatalogCallResult> {
    const result = resolveEntitled(
      request.id,
      'tool',
      this.catalog,
      await this.plans.of(request.workspaceId),
      this.clock.now(),
    );

    if (!result.entitled) {
      return {
        kind: 'denied',
        denial: CatalogEntitledMapper.toDenial(result.denial),
      };
    }

    const tool = result.item;
    const started = this.clock.now();
    let succeeded = false;

    try {
      const output = await this.service.call(tool, request.inputs, {
        workspaceId: request.workspaceId,
        runId: request.runId,
      });

      succeeded = true;

      return { kind: 'answered', output };
    } finally {
      await this.ledger.record(
        CatalogCall.of({
          workspaceId: request.workspaceId,
          runId: request.runId,
          item: tool.id,
          at: started,
          ms: this.clock.now().getTime() - started.getTime(),
          succeeded,
        }),
      );
    }
  }
}
