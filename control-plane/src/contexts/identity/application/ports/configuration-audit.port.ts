import type { ConfigurationChangeDto } from '@identity/application/dto/configuration-change.dto';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CONFIGURATION_AUDIT = Symbol('CONFIGURATION_AUDIT');

export interface AuditPage {
  readonly before: number | null;
  readonly limit: number;
}

export interface ConfigurationAuditPort {
  record(change: ConfigurationChange): Promise<void>;

  changesIn(
    workspaceId: WorkspaceId,
    page: AuditPage,
  ): Promise<readonly ConfigurationChangeDto[]>;
}
