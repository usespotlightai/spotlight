import type {
  HostConnectionRosterPort,
  PersonConnection,
} from '@integrations/application/ports/host-connection-roster.port';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { hostConnection } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, asc, eq, ne } from 'drizzle-orm';

@Injectable()
export class DrizzleHostConnectionRoster implements HostConnectionRosterPort {
  constructor(private readonly context: DrizzleContext) {}

  async ofTeam(teamId: TeamId): Promise<readonly PersonConnection[]> {
    const rows = await this.context.db
      .select({
        source: hostConnection.source,
        holder: hostConnection.holder,
        handle: hostConnection.handle,
        connectedAt: hostConnection.connectedAt,
      })
      .from(hostConnection)
      .where(
        and(
          eq(hostConnection.teamId, teamId.value),
          ne(hostConnection.holder, ConnectionHolder.team().key),
        ),
      )
      .orderBy(asc(hostConnection.source), asc(hostConnection.connectedAt));

    return rows.flatMap((row) => {
      const personId = ConnectionHolder.fromKey(row.holder).personId;

      return personId
        ? [
            {
              source: row.source,
              personId: personId.value,
              handle: row.handle,
              connectedAt: row.connectedAt,
            },
          ]
        : [];
    });
  }
}
