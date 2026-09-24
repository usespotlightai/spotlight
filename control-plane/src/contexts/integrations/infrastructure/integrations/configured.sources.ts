import type {
  ConfiguredSourcesPort,
  OfTeam,
} from '@integrations/application/ports/configured-sources.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { WebhookSourcePort } from '@integrations/application/ports/webhook-source.port';
import { SpotlightCredentials } from '@integrations/application/services/spotlight-credentials';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { JwksResolver } from '@integrations/infrastructure/integrations/jwks';
import { WebhookRuntime } from '@integrations/infrastructure/integrations/webhook.runtime';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';

export class ConfiguredSources implements ConfiguredSourcesPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly reader: IntegrationReader,
    private readonly jwks: JwksResolver,
    private readonly outbound: HttpOutbound,
    private readonly injection: SecretInjectionPort,
  ) {}

  async find(team: OfTeam, key: string): Promise<WebhookSourcePort | null> {
    const declared = await this.all(team);

    return declared.find((each) => each.key === key) ?? null;
  }

  async all(team: OfTeam): Promise<readonly WebhookSourcePort[]> {
    const definitions = await this.defined.ofTeam(team.teamId);
    const built: WebhookSourcePort[] = [];
    const credentials = new SpotlightCredentials(
      this.injection,
      async () => team.workspaceId.value,
    );

    for (const readable of this.reader.readable(definitions).integrations) {
      built.push(
        new WebhookRuntime(
          readable,
          team.workspaceId,
          new Map(),
          undefined,
          this.jwks,
          this.outbound,
          credentials,
        ),
      );
    }

    return built;
  }
}
