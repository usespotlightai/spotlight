import type { CallAuth } from '@integrations/application/ports/integration-runtime.port';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';

export const SPEC_READER = Symbol('SPEC_READER');

export type SpecRead =
  | {
      readonly kind: 'read';
      readonly hash: ContentHash;
      readonly operations: readonly SpecOperation[];
      readonly skipped: readonly string[];
    }
  | { readonly kind: 'unread'; readonly problem: string };

export interface SpecReaderPort {
  read(spec: ApiSpec, callAuth: CallAuth): Promise<SpecRead>;
}
