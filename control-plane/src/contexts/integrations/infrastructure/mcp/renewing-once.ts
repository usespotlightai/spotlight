import type { ActiveConnection } from '@integrations/application/ports/integration-runtime.port';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { McpUnauthorizedError } from '@integrations/infrastructure/mcp/mcp-failures';

export const renewingOnce = async <T>(
  asking: (token: AccessToken | null) => Promise<T>,
  connection: ActiveConnection | null,
): Promise<T> => {
  try {
    return await asking(connection?.token ?? null);
  } catch (error) {
    const renewed =
      error instanceof McpUnauthorizedError && connection
        ? await connection.unauthorized(connection.token)
        : null;

    if (!renewed) {
      throw error;
    }

    return asking(renewed);
  }
};
