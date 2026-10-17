import { SecretCreated } from '@secrets/domain/events/secret-created.event';
import { SecretDeleted } from '@secrets/domain/events/secret-deleted.event';
import { SecretUpdated } from '@secrets/domain/events/secret-updated.event';
import { Recipient } from '@secrets/domain/value-objects/recipient.vo';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import { SecretBinding } from '@secrets/domain/value-objects/secret-binding.vo';
import { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { SecretChangeDetail } from '@secrets/domain/value-objects/secret-change-detail.vo';
import { SecretFetcher } from '@secrets/domain/value-objects/secret-fetcher.vo';
import { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import { SecretTarget } from '@secrets/domain/value-objects/secret-target.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';

export const SECRETS_PAYLOAD_TYPES = [
  SecretFetcher,
  Recipient,
  RunLease,
  SecretBinding,
  SecretBindings,
  SecretTarget,
  SecretChangeDetail,
  SecretGrant,
  SecretId,
  SecretSource,
  SecretUses,
  SecretDeleted,
  SecretUpdated,
  SecretCreated,
] as const;
