import type { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class MeteredCall {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly runId: RunId,
    readonly item: CatalogItemId,
    readonly at: Date,
    readonly ms: number,
    readonly succeeded: boolean,
  ) {}

  static of(input: {
    workspaceId: WorkspaceId;
    runId: RunId;
    item: CatalogItemId;
    at: Date;
    ms: number;
    succeeded: boolean;
  }): MeteredCall {
    return new MeteredCall(
      input.workspaceId,
      input.runId,
      input.item,
      input.at,
      Math.max(0, Math.round(input.ms)),
      input.succeeded,
    );
  }

  get billable(): boolean {
    return this.succeeded;
  }
}
