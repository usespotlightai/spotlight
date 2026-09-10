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

/**
 * What a delivery says about the workspace itself rather than about a task.
 * A host telling us its repository moved is not news about anybody's work; it
 * is news about what Spotlight should be reading.
 */
/** A repository Spotlight reads configuration from has moved. */
export interface ConfigurationTouched {
  readonly kind: 'configuration-touched';
  /** Which repository moved, named the way a workspace names one. */
  readonly repository: string;
}

/**
 * The host let go of Spotlight rather than the other way about: somebody
 * removed the installation where it lives. What a workspace holds for it is
 * a key to a door that is no longer there.
 */
export interface ConnectionEnded {
  readonly kind: 'connection-ended';
  readonly source: string;
  /** The host's own name for what ended, which is what a workspace holds. */
  readonly externalId: string;
}

export type Noticed = ConfigurationTouched | ConnectionEnded;

export interface Happened extends Word {
  readonly concerns: Concerns;
  /** What was said, where anything was: the note the station works from. */
  readonly said: Said | null;
  readonly ourOwn: boolean;
  readonly opens: OpensWith | null;
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

  /**
   * Nothing arriving is acted on until this says the host really sent it.
   * Async because proving it may need a key fetched from the host (a JWKS).
   */
  verifies(delivered: Delivered): Promise<boolean>;

  /** Named so that the same delivery twice is acted on once. */
  delivery(delivered: Delivered): string;

  /** Whose word this is. Null where it belongs to no workspace here. */
  routes(delivered: Delivered): Promise<WorkspaceId | null>;

  /**
   * One delivery may carry several words, or none Spotlight acts on. Async
   * because a word may need something the delivery only named fetched first.
   */
  read(delivered: Delivered): Promise<readonly Happened[]>;

  /**
   * What the delivery says about the workspace rather than about a task.
   * Most hosts say nothing of the sort, so most sources answer nothing, and
   * a source that does not answer at all is read as saying nothing.
   */
  noticed?(delivered: Delivered): readonly Noticed[];

  /**
   * A handshake some hosts make before they will send: they post a challenge
   * and expect it echoed synchronously. Returns the body to echo, or null when
   * the delivery is not a handshake (which is almost always).
   */
  answer?(delivered: Delivered): string | null;
}
