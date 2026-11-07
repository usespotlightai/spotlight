import type {
  HistoryConfig,
  HistoryRun,
} from '@replays/application/ports/station-history.port';
import type { VisibleBlock } from '@replays/application/queries/search-visibilities';

export interface SearchViewRunDto extends HistoryRun {
  readonly original: string;
  readonly repeat: number;
  readonly succeeded: boolean | null;
  readonly reasons: readonly string[];
  readonly verdict: string | null;
  readonly guidance: string | null;
}

export interface SearchViewCandidateDto {
  readonly candidateName: string;
  readonly fingerprint: string;
  readonly hypothesis: string;
  readonly block: VisibleBlock;
  readonly runs: readonly SearchViewRunDto[];
}

export interface SearchViewDto {
  readonly configs: readonly HistoryConfig[];
  readonly candidates: readonly SearchViewCandidateDto[];
  readonly seedBlock: VisibleBlock | null;
}
