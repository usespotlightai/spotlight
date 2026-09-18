import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type {
  OAuth2Authorized,
  OAuth2Begun,
  OAuth2LinkingPort,
  OAuth2Returned,
} from '@integrations/application/ports/oauth2-linking.port';
import type { OAuth2NoncesPort } from '@integrations/application/ports/oauth2-nonces.port';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import { oauth2Of } from '@integrations/infrastructure/integrations/oauth2-config';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type { OAuth2State } from '@integrations/infrastructure/integrations/oauth2-state';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const NONCE_BYTES = 32;

const sameNonce = (one: string, other: string): boolean => {
  const a = Buffer.from(one);
  const b = Buffer.from(other);

  return a.length === b.length && timingSafeEqual(a, b);
};

export class OAuth2Linking implements OAuth2LinkingPort {
  constructor(
    private readonly configurations: AppliedConfigurationPort,
    private readonly reader: IntegrationReader,
    private readonly clients: OAuth2Clients,
    private readonly exchange: OAuth2Exchange,
    private readonly teams: TeamDirectoryPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly state: OAuth2State,
    private readonly nonces: OAuth2NoncesPort,
    private readonly clock: ClockPort,
    private readonly base: string,
    private readonly callback: string,
  ) {}

  async begin(
    teamId: string,
    source: string,
    by: string,
  ): Promise<OAuth2Begun | null> {
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
    authorize.searchParams.set('redirect_uri', this.callback);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('scope', oauth2.scopes.join(' '));

    const nonce = randomBytes(NONCE_BYTES).toString('base64url');
    const signed = this.state.sign({ teamId, source, by, nonce });
    authorize.searchParams.set('state', signed.token);

    return { url: authorize.toString(), nonce, expiresAt: signed.expiresAt };
  }

  async authorized(returned: OAuth2Returned): Promise<OAuth2Authorized | null> {
    const intent = this.state.open(returned.state);

    if (
      !intent ||
      !returned.nonce ||
      !sameNonce(returned.nonce, intent.nonce) ||
      returned.viewerId !== intent.by
    ) {
      return null;
    }

    if (
      !(await this.nonces.spend(
        intent.nonce,
        intent.expiresAt,
        this.clock.now(),
      ))
    ) {
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
      returned.code,
      this.callback,
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
    const team = await this.teams.find(TeamId.of(teamId));
    const slug = team
      ? await this.workspaces.slugOf(team.workspaceId.value)
      : null;

    const where = slug
      ? `${this.base}/w/${slug}/team/${teamId}/settings/integrations`
      : `${this.base}`;

    return `${where}?connected=${encodeURIComponent(source)}`;
  }
}
