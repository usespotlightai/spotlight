import type {
  ConfiguredWebhookProvidersPort,
  OfTeam,
} from '@integrations/application/ports/configured-webhook-providers.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { OutboundLimitsPort } from '@integrations/application/ports/outbound-limits.port';
import type { WebhookProviderPort } from '@integrations/application/ports/webhook-provider.port';
import { SpotlightCredentials } from '@integrations/application/services/spotlight-credentials';
import { SpotlightSigningSecrets } from '@integrations/application/services/spotlight-signing-secrets';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { JwksResolver } from '@integrations/infrastructure/integrations/jwks';
import { WebhookRuntime } from '@integrations/infrastructure/integrations/webhook.runtime';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';

export class ConfiguredWebhookProviders
  implements ConfiguredWebhookProvidersPort
{
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly reader: IntegrationReader,
    private readonly jwks: JwksResolver,
    private readonly outbound: HttpOutbound,
    private readonly injection: SecretInjectionPort,
    private readonly limits: OutboundLimitsPort,
  ) {}

  async find(team: OfTeam, key: string): Promise<WebhookProviderPort | null> {
    const declared = await this.all(team);

    return declared.find((each) => each.key === key) ?? null;
  }

  async all(team: OfTeam): Promise<readonly WebhookProviderPort[]> {
    const definitions = await this.defined.ofTeam(team.teamId);
    const built: WebhookProviderPort[] = [];
    const credentials = new SpotlightCredentials(
      this.injection,
      async () => team.workspaceId.value,
    );
    const signing = new SpotlightSigningSecrets(
      this.injection,
      team.workspaceId,
    );

    for (const readable of this.reader.readable(definitions).integrations) {
      built.push(
        new WebhookRuntime(
          readable,
          team.workspaceId,
          signing,
          undefined,
          this.jwks,
          this.outbound,
          credentials,
          this.limits,
        ),
      );
    }

    return built;
  }
}
