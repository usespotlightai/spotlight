import type { OAuth2NoncesPort } from '@integrations/application/ports/oauth2-nonces.port';
import { oauth2SpentNonce } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { lt } from 'drizzle-orm';

@Injectable()
export class DrizzleOAuth2Nonces implements OAuth2NoncesPort {
  constructor(private readonly context: DrizzleContext) {}

  async spend(nonce: string, until: Date, now: Date): Promise<boolean> {
    await this.context.db
      .delete(oauth2SpentNonce)
      .where(lt(oauth2SpentNonce.until, now));

    const spent = await this.context.db
      .insert(oauth2SpentNonce)
      .values({ nonce, until })
      .onConflictDoNothing()
      .returning({ nonce: oauth2SpentNonce.nonce });

    return spent.length > 0;
  }
}
