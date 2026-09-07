import type {
  ConfiguredSourcesPort,
  OfTeam,
} from '@application/ports/configured-sources.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { WebhookSourcePort } from '@application/ports/webhook-source.port';
import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { JwksResolver } from '@infrastructure/integrations/jwks';
import { WebhookRuntime } from '@infrastructure/integrations/webhook.runtime';

/**
 * The hosts a workspace declared, built from the configuration it last read.
 * Compiled on the way through rather than kept: expressions are closures, and
 * what is stored is the file a person wrote.
 *
 * A file that will not compile is not a source. Its problems were written
 * down when it was read, and are what the workspace is shown instead.
 */
export class ConfiguredSources implements ConfiguredSourcesPort {
  constructor(
    private readonly configurations: TeamConfigurationRepository,
    private readonly secrets: TeamSecretsPort,
    private readonly reader: IntegrationReader,
    private readonly jwks: JwksResolver,
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

    // Only this team's, and only what the reader says declares anything.
    // Which files are ignored is its to say: it is the same answer a person
    // is shown on the page.
    const mine = applied.under(INTEGRATIONS_UNDER);

    for (const readable of this.reader.readable(mine).integrations) {
      // The values of the secrets the file names. A secret the team has not
      // set is simply absent, which is how a source verifying by it refuses
      // every delivery until somebody sets it.
      const secrets = new Map<string, string>();

      for (const name of readable.integration.credentials) {
        const value = await this.secrets.resolve(team.teamId, name);

        if (value !== null) {
          secrets.set(name.value, value);
        }
      }

      built.push(
        new WebhookRuntime(
          readable,
          team.workspaceId,
          secrets,
          undefined,
          this.jwks,
        ),
      );
    }

    return built;
  }
}
