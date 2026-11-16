import type { RunSpecShape } from '@runs/application/contracts/run-spec.contract';
import type {
  ClaimedCheck,
  ClaimedPushDiff,
} from '@runs/application/ports/review-work.port';
import type { JsonObject } from '@shared-kernel/domain/json-value';

interface ClaimedRunDto {
  readonly id: string;
  readonly harness: string;
  readonly attempt: number;
  readonly spec: RunSpecShape;
  readonly extensions: JsonObject;
  readonly workingCopyKey: string | null;
}

export type ClaimedWorkDto =
  | { readonly kind: 'run'; readonly run: ClaimedRunDto }
  | { readonly kind: 'check'; readonly check: ClaimedCheck }
  | { readonly kind: 'diff'; readonly diff: ClaimedPushDiff };

export interface EnqueuedRunDto {
  readonly id: string;
  readonly harness: string;
  readonly state: string;
}
