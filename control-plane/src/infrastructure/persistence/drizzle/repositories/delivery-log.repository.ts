import type { DeliveryLogPort } from '@application/ports/delivery-log.port';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { handledDelivery } from '@infrastructure/persistence/drizzle/schemas/delivery.schema';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DrizzleDeliveryLog implements DeliveryLogPort {
  constructor(private readonly context: DrizzleContext) {}

  async claim(delivery: string): Promise<boolean> {
    // The insert is the check: only one writer wins the row.
    const written = await this.context.db
      .insert(handledDelivery)
      .values({ id: delivery })
      .onConflictDoNothing()
      .returning({ id: handledDelivery.id });

    return written.length > 0;
  }
}
