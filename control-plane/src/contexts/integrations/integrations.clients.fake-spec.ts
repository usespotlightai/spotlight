import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';

export const clientsFrom = (json = '{}'): OAuth2ClientsPort => {
  const configured = OAuth2Clients.from(json);

  return {
    clientFor: async (_teamId, source) => configured.of(source.value),
    existingFor: async (_teamId, source) => configured.of(source.value),
  };
};
