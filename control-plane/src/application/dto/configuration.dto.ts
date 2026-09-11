import type { OpenedPullRequestDto } from '@application/dto/pull-request.dto';
import type { ConfigurationMove } from '@domain/services/configuration-move';

/** What is wrong with one file, as whoever has to fix it would read it. */
export interface ConfigProblemDto {
  readonly path: string;
  readonly at: string;
  readonly reason: string;
}

/** One host a workspace has told Spotlight to listen to. */
export interface ConfiguredIntegrationDto {
  readonly source: string;
  readonly name: string;
  readonly deliverTo: string;
  /** Every secret this host reads, and whether the team has set each. */
  readonly secrets: readonly { name: string; set: boolean }[];
  readonly happenings: readonly { happening: string; label: string }[];
  /** Whether this host is linked by authorizing a connection (OAuth2). */
  readonly connectable: boolean;
  /** The living link, where the team has one; null where it has not linked. */
  readonly connection: { readonly handle: string | null } | null;
}

export interface ConfigurationDto {
  /** The repository last read from. Null where nothing has been read yet. */
  readonly repository: string | null;
  /**
   * Where the team reads its configuration from: where it keeps it, or else
   * where the fallback rule last found it. Null where neither.
   */
  readonly readsFrom: string | null;
  readonly movingTo: string | null;
  readonly sha: string | null;
  readonly readAt: string | null;
  readonly integrations: readonly ConfiguredIntegrationDto[];
  readonly problems: readonly ConfigProblemDto[];
}

export const CONFIGURATION_MOVE_KINDS = [
  'carried',
  'adopted',
  'repointed',
] as const satisfies readonly ConfigurationMove['kind'][];

export type ConfigurationMoveDto =
  | { readonly kind: 'carried'; readonly pullRequest: OpenedPullRequestDto }
  | { readonly kind: Exclude<ConfigurationMove['kind'], 'carried'> };
