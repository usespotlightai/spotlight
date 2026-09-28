import type {
  LinkedHost,
  LinkedHostsPort,
} from '@integrations/application/ports/linked-hosts.port';
import { hostConnection } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleLinkedHosts implements LinkedHostsPort {
  constructor(private readonly context: DrizzleContext) {}

  async ofTeam(teamId: TeamId): Promise<readonly LinkedHost[]> {
    return this.context.db
      .select({ source: hostConnection.source, handle: hostConnection.handle })
      .from(hostConnection)
      .where(eq(hostConnection.teamId, teamId.value))
      .orderBy(asc(hostConnection.source));
  }
}
