import type { OriginKind } from '@replays/domain/value-objects/candidate-kind';

export interface ConfigOriginDto {
  readonly stationId: string;
  readonly runId: string;
  readonly fingerprint: string;
  readonly changedAt: string;
  readonly candidateId: string;
  readonly name: string;
  readonly kind: OriginKind;
  readonly lineId: string;
  readonly searchId: string | null;
  readonly replayId: string | null;
  readonly createdAt: string;
  readonly withdrawn: boolean;
}

export interface ConfigOriginsDto {
  readonly origins: readonly ConfigOriginDto[];
}
