import type { CallAuth } from '@integrations/application/ports/integration-runtime.port';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';

export const SOURCE_READER = Symbol('SOURCE_READER');

export type SourceRead =
  | {
      readonly kind: 'read';
      readonly hash: ContentHash;
      readonly operations: readonly DescribedOperation[];
      readonly passedOver: readonly string[];
    }
  | { readonly kind: 'unread'; readonly problem: string };

export interface SourceReaderPort {
  read(source: DescribedSource, callAuth: CallAuth): Promise<SourceRead>;
}
