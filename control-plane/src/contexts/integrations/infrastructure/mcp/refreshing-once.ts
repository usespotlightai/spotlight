import type { ActiveConnection } from '@integrations/application/ports/integration-runtime.port';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { McpUnauthorizedError } from '@integrations/infrastructure/mcp/mcp-failures';

export const refreshingOnce = async <T>(
  calling: (token: AccessToken | null) => Promise<T>,
  connection: ActiveConnection | null,
): Promise<T> => {
  try {
    return await calling(connection?.token ?? null);
  } catch (error) {
    const refreshed =
      error instanceof McpUnauthorizedError && connection
        ? await connection.unauthorized(connection.token)
        : null;

    if (!refreshed) {
      throw error;
    }

    return calling(refreshed);
  }
};
