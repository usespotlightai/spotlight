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
  /** As it arrived, byte for byte, which is what a signature is over. */
  readonly raw: Uint8Array | null;
}

/** One word a source can raise, as a person choosing between them sees it. */
export interface HappeningDeclaration {
  readonly happening: Happening;
  /** What it is called where somebody picks one. */
  readonly label: string;
  /** How it reads in a note when it comes. */
  readonly told: string;
  readonly spoken: boolean;
}

export interface Happened extends Word {
  readonly concerns: Concerns;
  /** What was said, where anything was: the note the station works from. */
  readonly said: Said | null;
  readonly ourOwn: boolean;
}

/**
 * One host Spotlight listens to. Everything particular to it lives here:
 * how it signs, how it names a delivery, whose workspace a delivery belongs
 * to, and how its words read as Spotlight's.
 *
 * A source that recognises a delivery it cannot place may throw
 * UpstreamRefusedError, which has the host send it again. One it simply has
 * no interest in reads as nothing at all.
 */
export interface WebhookSourcePort {
  /** How the world addresses it: `/api/webhooks/<key>`. */
  readonly key: string;

  /** Everything this source can raise, and so what a station may wait for. */
  readonly happenings: readonly HappeningDeclaration[];

  /** Nothing arriving is acted on until this says the host really sent it. */
  verifies(delivered: Delivered): boolean;

  /** Named so that the same delivery twice is acted on once. */
  delivery(delivered: Delivered): string;

  /** Whose word this is. Null where it belongs to no workspace here. */
  routes(delivered: Delivered): Promise<WorkspaceId | null>;

  /** One delivery may carry several words, or none Spotlight acts on. */
  read(delivered: Delivered): readonly Happened[];
}
