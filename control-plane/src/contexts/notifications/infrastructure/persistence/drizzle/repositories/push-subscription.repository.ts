import { Injectable } from '@nestjs/common';
import { PushSubscription } from '@notifications/domain/aggregates/push-subscription.aggregate';
import { PushSubscriptionVersionConflictError } from '@notifications/domain/exceptions/push-subscription-version-conflict.error';
import type { PushSubscriptionRepository } from '@notifications/domain/repositories/push-subscription.repository';
import { PushEndpoint } from '@notifications/domain/value-objects/push-endpoint.vo';
import { PushKeys } from '@notifications/domain/value-objects/push-keys.vo';
import { pushSubscription } from '@notifications/infrastructure/persistence/drizzle/schemas/push-subscription.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, eq } from 'drizzle-orm';

type Row = typeof pushSubscription.$inferSelect;

const toSubscription = (row: Row): PushSubscription =>
  PushSubscription.rehydrate({
    endpoint: PushEndpoint.rehydrate(row.endpoint),
    person: UserId.of(row.personId),
    keys: PushKeys.of({ p256dh: row.p256dh, auth: row.auth }),
    createdAt: row.createdAt,
    renewedAt: row.renewedAt,
    version: row.version,
  });

@Injectable()
export class DrizzlePushSubscriptionRepository
  implements PushSubscriptionRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async find(endpoint: PushEndpoint): Promise<PushSubscription | null> {
    const [row] = await this.context.db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.endpoint, endpoint.url))
      .limit(1);

    return row ? toSubscription(row) : null;
  }

  async ofPerson(person: UserId): Promise<PushSubscription[]> {
    const rows = await this.context.db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.personId, person.value));

    return rows.map(toSubscription);
  }

  async add(added: PushSubscription): Promise<void> {
    const written = await this.context.db
      .insert(pushSubscription)
      .values({
        endpoint: added.endpoint.url,
        personId: added.person.value,
        p256dh: added.keys.p256dh,
        auth: added.keys.auth,
        createdAt: added.createdAt,
        renewedAt: added.renewedAt,
        version: added.version,
      })
      .onConflictDoNothing({ target: pushSubscription.endpoint })
      .returning({ endpoint: pushSubscription.endpoint });

    if (written.length === 0) {
      throw new PushSubscriptionVersionConflictError();
    }
  }

  async save(saved: PushSubscription): Promise<void> {
    const written = await this.context.db
      .update(pushSubscription)
      .set({
        personId: saved.person.value,
        p256dh: saved.keys.p256dh,
        auth: saved.keys.auth,
        createdAt: saved.createdAt,
        renewedAt: saved.renewedAt,
        version: saved.version + 1,
      })
      .where(
        and(
          eq(pushSubscription.endpoint, saved.endpoint.url),
          eq(pushSubscription.version, saved.version),
        ),
      )
      .returning({ endpoint: pushSubscription.endpoint });

    if (written.length === 0) {
      throw new PushSubscriptionVersionConflictError();
    }
  }

  async remove(removed: PushSubscription): Promise<void> {
    const gone = await this.context.db
      .delete(pushSubscription)
      .where(
        and(
          eq(pushSubscription.endpoint, removed.endpoint.url),
          eq(pushSubscription.version, removed.version),
        ),
      )
      .returning({ endpoint: pushSubscription.endpoint });

    if (gone.length === 0) {
      throw new PushSubscriptionVersionConflictError();
    }
  }
}
