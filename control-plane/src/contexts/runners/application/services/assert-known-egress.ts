import type { PlatformEgressSettings } from '@runners/application/ports/platform-egress-settings.port';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import { validateEgress } from '@runners/domain/services/egress-naming';
import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const assertKnownEgress = async (
  reference: EgressReference | null,
  workspaceId: WorkspaceId,
  egresses: EgressRepository,
  platform: PlatformEgressSettings | null,
): Promise<void> => {
  const id = reference?.egressId ?? null;

  validateEgress(reference, {
    workspaceId,
    named: id ? await egresses.findToName(id) : null,
    platformKept: platform !== null,
  });
};
