import { integrationFilesIn } from '@application/contracts/configuration-layout.contract';
import type {
  ConfiguredSourcesPort,
  OfTeam,
} from '@application/ports/configured-sources.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { WebhookSourcePort } from '@application/ports/webhook-source.port';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { JwksResolver } from '@infrastructure/integrations/jwks';
import { WebhookRuntime } from '@infrastructure/integrations/webhook.runtime';
import type { HttpOutbound } from '@infrastructure/outbound/http-outbound';

export class ConfiguredSources implements ConfiguredSourcesPort {
  constructor(
    private readonly configurations: TeamConfigurationRepository,
    private readonly secrets: TeamSecretsPort,
    private readonly reader: IntegrationReader,
    private readonly jwks: JwksResolver,
    private readonly outbound: HttpOutbound,
  ) {}

  async find(team: OfTeam, key: string): Promise<WebhookSourcePort | null> {
    const declared = await this.all(team);

    return declared.find((each) => each.key === key) ?? null;
  }

  async all(team: OfTeam): Promise<readonly WebhookSourcePort[]> {
    const applied = await this.configurations.findFor(team.teamId);

    if (!applied) {
      return [];
    }

    const built: WebhookSourcePort[] = [];

    const mine = integrationFilesIn(applied.files);

    for (const readable of this.reader.readable(mine).integrations) {
      const secrets = new Map(
        Object.entries(
          await this.secrets.resolveAll(
            team.teamId,
            readable.integration.credentials,
          ),
        ),
      );

      built.push(
        new WebhookRuntime(
          readable,
          team.workspaceId,
          secrets,
          undefined,
          this.jwks,
          this.outbound,
        ),
      );
    }

    return built;
  }
}
