import type {
  ConfigurationAction,
  ConfiguredResource,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export type ChangedBy =
  | { readonly kind: 'person'; readonly userId: string }
  | {
      readonly kind: 'token';
      readonly tokenId: string;
      readonly userId: string;
      readonly trustId: string | null;
    }
  | { readonly kind: 'spotlight' };

export interface ConfigurationChangeDto {
  readonly seq: number;
  readonly resource: ConfiguredResource;
  readonly resourceId: string;
  readonly key: string;
  readonly action: ConfigurationAction;
  readonly by: ChangedBy;
  readonly client: string | null;
  readonly details: RecordedDetail;
  readonly at: Date;
}
