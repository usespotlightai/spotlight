import { SecretAbandoned } from '@secrets/domain/events/secret-abandoned.event';
import { SecretDeleted } from '@secrets/domain/events/secret-deleted.event';
import { SecretRedefined } from '@secrets/domain/events/secret-redefined.event';
import { SecretSet } from '@secrets/domain/events/secret-set.event';
import { Redeemer } from '@secrets/domain/value-objects/redeemer.vo';
import { RedemptionRecipient } from '@secrets/domain/value-objects/redemption-recipient.vo';
import { RunHold } from '@secrets/domain/value-objects/run-hold.vo';
import { SecretBinding } from '@secrets/domain/value-objects/secret-binding.vo';
import { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { SecretCarrier } from '@secrets/domain/value-objects/secret-carrier.vo';
import { SecretChangeDetail } from '@secrets/domain/value-objects/secret-change-detail.vo';
import { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';

export const SECRETS_PAYLOAD_TYPES = [
  Redeemer,
  RedemptionRecipient,
  RunHold,
  SecretBinding,
  SecretBindings,
  SecretCarrier,
  SecretChangeDetail,
  SecretGrant,
  SecretId,
  SecretSource,
  SecretUses,
  SecretAbandoned,
  SecretDeleted,
  SecretRedefined,
  SecretSet,
] as const;
