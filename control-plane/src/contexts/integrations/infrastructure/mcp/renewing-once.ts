import type { HeldConnection } from '@integrations/application/ports/integration-runtime.port';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { McpAuthorizationRefused } from '@integrations/infrastructure/mcp/mcp-failures';

export const renewingOnce = async <T>(
  asking: (token: AccessToken | null) => Promise<T>,
  held: HeldConnection | null,
): Promise<T> => {
  try {
    return await asking(held?.token ?? null);
  } catch (error) {
    const renewed =
      error instanceof McpAuthorizationRefused && held
        ? await held.refused(held.token)
        : null;

    if (!renewed) {
      throw error;
    }

    return asking(renewed);
  }
};
