import { OAuth2Discovery } from '@integrations/infrastructure/integrations/oauth2-discovery';
import { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

export const discoveringNothing = (): OAuth2Discovery =>
  new OAuth2Discovery(new OutboundPolicy([]), {
    now: () => new Date(),
  } as ClockPort);

export const callingNoServer = (): McpSessions =>
  new McpSessions(new OutboundPolicy([]));
