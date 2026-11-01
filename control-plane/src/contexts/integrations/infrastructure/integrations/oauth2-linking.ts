import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import type {
  OAuth2Authorized,
  OAuth2LinkInput,
  OAuth2LinkingPort,
  OAuth2Returned,
  OAuth2Start,
} from '@integrations/application/ports/oauth2-linking.port';
import type { OAuth2NoncesPort } from '@integrations/application/ports/oauth2-nonces.port';
import { returnPathOf } from '@integrations/application/services/return-to';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { oauth2Of } from '@integrations/infrastructure/integrations/oauth2-config';
import {
  authorizationServerOf,
  type OAuth2Discovery,
} from '@integrations/infrastructure/integrations/oauth2-discovery';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import {
  OAuth2State,
  type OpenedOAuth2Intent,
} from '@integrations/infrastructure/integrations/oauth2-state';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { WorkspaceOutboundScopePort } from '@shared-kernel/application/ports/workspace-outbound-scope.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const NONCE_BYTES = 32;

const sameNonce = (one: string, other: string): boolean => {
  const a = Buffer.from(one);
  const b = Buffer.from(other);

  return a.length === b.length && timingSafeEqual(a, b);
};

export class OAuth2Linking implements OAuth2LinkingPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly reader: IntegrationReader,
    private readonly discovery: OAuth2Discovery,
    private readonly clients: OAuth2ClientsPort,
    private readonly exchange: OAuth2Exchange,
    private readonly teams: TeamDirectoryPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly state: OAuth2State,
    private readonly nonces: OAuth2NoncesPort,
    private readonly clock: ClockPort,
    private readonly base: string,
    private readonly callback: string,
    private readonly scope: WorkspaceOutboundScopePort,
  ) {}

  begin(input: OAuth2LinkInput): Promise<OAuth2Start | null> {
    const teamId = TeamId.of(input.teamId);

    return this.onBehalfOf(teamId, () => this.begun(teamId, input));
  }

  private async begun(
    teamId: TeamId,
    input: OAuth2LinkInput,
  ): Promise<OAuth2Start | null> {
    const oauth2 = await oauth2Of(
      this.defined,
      this.reader,
      this.discovery,
      teamId,
      input.integration,
    );
    const client = oauth2
      ? await this.clients.clientFor(
          teamId,
          IntegrationKey.of(input.integration),
          oauth2.registration,
          authorizationServerOf(oauth2),
        )
      : null;

    if (!oauth2 || !client) {
      return null;
    }

    const nonce = randomBytes(NONCE_BYTES).toString('base64url');
    const signed = this.state.sign({
      teamId: input.teamId,
      integration: input.integration,
      by: input.by,
      owner: input.owner,
      returnTo: returnPathOf(input.returnTo),
      nonce,
    });

    const authorize = new URL(oauth2.authorize);
    authorize.searchParams.set('client_id', client.id);
    authorize.searchParams.set('redirect_uri', this.callback);
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('scope', oauth2.scopes.join(' '));
    authorize.searchParams.set('state', signed.token);
    authorize.searchParams.set(
      'code_challenge',
      OAuth2State.challengeOf(this.state.verifierFor(nonce)),
    );
    authorize.searchParams.set('code_challenge_method', 'S256');

    if (oauth2.resource) {
      authorize.searchParams.set('resource', oauth2.resource);
    }

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

    const teamId = TeamId.of(intent.teamId);

    return this.onBehalfOf(teamId, () =>
      this.exchanged(teamId, intent, returned),
    );
  }

  private async exchanged(
    teamId: TeamId,
    intent: OpenedOAuth2Intent,
    returned: OAuth2Returned,
  ): Promise<OAuth2Authorized | null> {
    const oauth2 = await oauth2Of(
      this.defined,
      this.reader,
      this.discovery,
      teamId,
      intent.integration,
    );
    const client = oauth2
      ? await this.clients.existingFor(
          teamId,
          IntegrationKey.of(intent.integration),
          authorizationServerOf(oauth2),
        )
      : null;

    if (!oauth2 || !client) {
      return null;
    }

    const tokens = await this.exchange.exchange(
      oauth2,
      client,
      returned.code,
      this.callback,
      this.state.verifierFor(intent.nonce),
    );

    if (!tokens) {
      return null;
    }

    return {
      teamId: intent.teamId,
      integration: intent.integration,
      by: intent.by,
      owner: intent.owner,
      returnTo: intent.returnTo,
      tokens,
    };
  }

  private async onBehalfOf<T>(
    teamId: TeamId,
    work: () => Promise<T | null>,
  ): Promise<T | null> {
    const team = await this.teams.find(teamId);

    return team ? this.scope.within(team.workspaceId.value, work) : null;
  }

  async landingFor(
    teamId: string,
    integration: string,
    returnTo: string | null,
  ): Promise<string> {
    const landing = returnPathOf(returnTo);

    if (landing) {
      return `${this.base}${landing}?connected=${encodeURIComponent(integration)}`;
    }

    const team = await this.teams.find(TeamId.of(teamId));
    const slug = team
      ? await this.workspaces.slugOf(team.workspaceId.value)
      : null;

    const where = slug
      ? `${this.base}/w/${slug}/settings/team/${teamId}/integrations`
      : `${this.base}`;

    return `${where}?connected=${encodeURIComponent(integration)}`;
  }
}
