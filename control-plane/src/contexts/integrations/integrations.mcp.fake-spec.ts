import { OAuth2Discovery } from '@integrations/infrastructure/integrations/oauth2-discovery';
import { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import { allowingOutbound } from '@integrations/infrastructure/outbound/outbound-policy.fake-spec';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

export const discoveringNothing = (): OAuth2Discovery =>
  new OAuth2Discovery(
    allowingOutbound([]),
    { now: () => new Date() } as ClockPort,
    { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  );

export const callingNoServer = (): McpSessions =>
  new McpSessions(allowingOutbound([]));
