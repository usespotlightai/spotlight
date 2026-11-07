import { SecretCreated } from '@secrets/domain/events/secret-created.event';
import { SecretDeleted } from '@secrets/domain/events/secret-deleted.event';
import { SecretUpdated } from '@secrets/domain/events/secret-updated.event';
import { SecretChangeDetail } from '@secrets/domain/value-objects/secret-change-detail.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';

export const SECRETS_PAYLOAD_TYPES = [
  SecretChangeDetail,
  SecretId,
  SecretCreated,
  SecretUpdated,
  SecretDeleted,
] as const;
