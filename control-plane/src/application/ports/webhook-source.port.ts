import type { OpensWith } from '@domain/services/reaction-for';
import type { Concerns } from '@domain/value-objects/concerns.vo';
import type { Happening, Word } from '@domain/value-objects/happening.vo';
import type { Said } from '@domain/value-objects/said.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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
  readonly happening: Happening;
  readonly label: string;
  readonly told: string;
  readonly spoken: boolean;
}

export interface ConfigurationTouched {
  readonly kind: 'configuration-touched';
  readonly repository: string;
}

export interface ConnectionEnded {
  readonly kind: 'connection-ended';
  readonly source: string;
  readonly externalId: string;
}

export type Noticed = ConfigurationTouched | ConnectionEnded;

export interface Arriving {
  readonly name: string;
  readonly contentType: string | null;
  readonly size: number | null;
  fetch(): Promise<Uint8Array>;
}

export interface Happened extends Word {
  readonly concerns: Concerns;
  readonly said: Said | null;
  readonly ourOwn: boolean;
  readonly opens: OpensWith | null;
  readonly attachments?: readonly Arriving[];
}

// Throw UpstreamRefusedError for a recognised delivery that cannot be placed yet, so the host resends it.
export interface WebhookSourcePort {
  readonly key: string;

  readonly happenings: readonly HappeningDeclaration[];

  verifies(delivered: Delivered): Promise<boolean>;

  delivery(delivered: Delivered): string;

  routes(delivered: Delivered): Promise<WorkspaceId | null>;

  read(delivered: Delivered): Promise<readonly Happened[]>;

  noticed?(delivered: Delivered): readonly Noticed[];

  answer?(delivered: Delivered): string | null;
}
