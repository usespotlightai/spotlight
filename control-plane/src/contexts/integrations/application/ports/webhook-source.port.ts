import type { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';

export const WEBHOOK_SOURCES = Symbol('WEBHOOK_SOURCES');

export type WebhookHeaders = Readonly<
  Record<string, string | string[] | undefined>
>;

export interface Delivered {
  readonly headers: WebhookHeaders;
  readonly body: unknown;
  // Exact bytes as received: signatures are computed over these.
  readonly raw: Uint8Array | null;
}

export interface HappeningDeclaration {
  readonly happening: HappeningName;
  readonly label: string;
  readonly told: string;
  readonly spoken: boolean;
}

// Throw UpstreamRefusedError for a recognised delivery that cannot be placed yet, so the host resends it.
export interface WebhookSourcePort {
  readonly key: string;

  readonly happenings: readonly HappeningDeclaration[];

  verifies(delivered: Delivered): Promise<boolean>;

  delivery(delivered: Delivered): string;

  routes(delivered: Delivered): Promise<WorkspaceId | null>;

  read(delivered: Delivered): Promise<readonly Happened[]>;

  answer?(delivered: Delivered): string | null;
}
