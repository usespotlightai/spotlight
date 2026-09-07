import type {
  OAuth2Authorized,
  OAuth2LinkingPort,
} from '@application/ports/oauth2-linking.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import type { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { OAuth2Clients } from '@infrastructure/integrations/oauth2-clients';
import { oauth2Of } from '@infrastructure/integrations/oauth2-config';
import type { OAuth2Exchange } from '@infrastructure/integrations/oauth2-exchange';
import type { OAuth2State } from '@infrastructure/integrations/oauth2-state';

/** Where the callback route sits, the same URL the shared app is registered with. */
const CALLBACK_PATH = '/integrations/oauth/callback';

/**
 * The OAuth2 protocol made of the generic pieces: the file says which endpoints
 * a host links through, the deployment's app says who Spotlight is to it, and
 * the signed state carries who is linking which host across the round trip.
 * Nothing here names a host, decides who may link, or writes a connection down.
 */
export class OAuth2Linking implements OAuth2LinkingPort {
  constructor(
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: IntegrationReader,
    private readonly clients: OAuth2Clients,
    private readonly exchange: OAuth2Exchange,
    private readonly factories: FactoryRepository,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly state: OAuth2State,
    private readonly base: string,
  ) {}

  async begin(
    teamId: string,
    source: string,
    by: string,
  ): Promise<string | null> {
    const oauth2 = await oauth2Of(
      this.configurations,
      this.reader,
      TeamId.of(teamId),
      source,
    );
    const client = this.clients.of(source);

    if (!oauth2 || !client) {
      return null;
    }

    const authorize = new URL(oauth2.authorize);
    authorize.searchParams.set('client_id', client.id);
    authorize.searchParams.set('redirect_uri', this.callback());
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('scope', oauth2.scopes.join(' '));
    authorize.searchParams.set(
      'state',
      this.state.sign({ teamId, source, by }),
    );

    return authorize.toString();
  }

  async authorized(
    state: string,
    code: string,
  ): Promise<OAuth2Authorized | null> {
    const intent = this.state.open(state);

    if (!intent) {
      return null;
    }

    const oauth2 = await oauth2Of(
      this.configurations,
      this.reader,
      TeamId.of(intent.teamId),
      intent.source,
    );
    const client = this.clients.of(intent.source);

    if (!oauth2 || !client) {
      return null;
    }

    const grant = await this.exchange.exchange(
      oauth2,
      client,
      code,
      this.callback(),
    );

    if (!grant) {
      return null;
    }

    return {
      teamId: intent.teamId,
      source: intent.source,
      by: intent.by,
      grant,
    };
  }

  async landingFor(teamId: string, source: string): Promise<string> {
    const factory = await this.factories.ofTeam(TeamId.of(teamId));
    const slug = factory
      ? await this.workspaces.slugOf(factory.workspaceId.value)
      : null;

    // Back to where a person began, if we can name it; the app's front door if
    // not. Either way with the host named, so the page can say it worked.
    const where = slug
      ? `${this.base}/w/${slug}/team/${teamId}/integrations`
      : `${this.base}`;

    return `${where}?connected=${encodeURIComponent(source)}`;
  }

  private callback(): string {
    return `${this.base}${CALLBACK_PATH}`;
  }
}
