import { randomUUID } from 'node:crypto';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import { IntegrationConnectionVersionConflictError } from '@integrations/domain/exceptions/integration-connection-version-conflict.error';
import { OAuth2ClientRegistrationVersionConflictError } from '@integrations/domain/exceptions/oauth2-client-registration-version-conflict.error';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { DrizzleConnectedIntegrations } from '@integrations/infrastructure/persistence/drizzle/readers/connected-integrations.reader';
import { DrizzleIntegrationConnectionRoster } from '@integrations/infrastructure/persistence/drizzle/readers/integration-connection-roster.reader';
import { DrizzleIntegrationConnections } from '@integrations/infrastructure/persistence/drizzle/repositories/integration-connections.repository';
import { DrizzleOAuth2ClientRegistrations } from '@integrations/infrastructure/persistence/drizzle/repositories/oauth2-client-registrations.repository';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Credential } from '@secrets/application/contracts/credential.contract';
import type { CredentialEncryptionPort } from '@secrets/application/ports/credential-encryption.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const NOW = new Date('2026-10-05T10:00:00.000Z');
const LINEAR = IntegrationKey.of('linear');

const labelled: CredentialEncryptionPort = {
  encrypt: async (_workspaceId, label, credential) =>
    Buffer.from(`${label}\n${credential.revealed()}`).toString('base64'),
  decrypt: async (_workspaceId, label, ciphertext) => {
    const [encryptedFor, plain] = Buffer.from(ciphertext, 'base64')
      .toString('utf8')
      .split('\n');

    if (encryptedFor !== label) {
      throw new Error(`encrypted for ${encryptedFor}, decrypted as ${label}`);
    }

    return Credential.of(plain ?? '');
  },
};

let database: TestDatabase;
let db: DrizzleDatabase;
let connections: DrizzleIntegrationConnections;
let registrations: DrizzleOAuth2ClientRegistrations;
let tasks: DrizzleTaskRepository;

beforeAll(async () => {
  database = await openDatabase('integration_connections');
  db = database.db;
  const context = new DrizzleContext(db);
  connections = new DrizzleIntegrationConnections(
    context,
    { dispatch: async () => {} },
    labelled,
  );
  registrations = new DrizzleOAuth2ClientRegistrations(context, labelled);
  tasks = new DrizzleTaskRepository(context, { dispatch: async () => {} });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const connection = (
  teamId: TeamId,
  owner: ConnectionOwner,
  accessToken: string,
) =>
  IntegrationConnection.connectFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId,
    integration: LINEAR,
    owner,
    tokens: OAuthTokens.of({
      accessToken,
      refreshToken: `${accessToken}-refresh`,
      expiresAt: new Date('2026-10-05T11:00:00.000Z'),
      linkedAccount: `@${accessToken}`,
    }),
  });

describe('integration connections stored per owner', () => {
  it('keeps the team’s and each person’s connection to one integration apart', async () => {
    const teamId = TeamId.of(randomUUID());
    const alice = ConnectionOwner.person(UserId.of('user_alice'));

    await connections.save(connection(teamId, ConnectionOwner.team(), 'team'));
    await connections.save(connection(teamId, alice, 'alice'));

    expect(
      (await connections.of(teamId, LINEAR, ConnectionOwner.team()))
        ?.accessToken.value,
    ).toBe('team');
    expect(
      (await connections.of(teamId, LINEAR, alice))?.accessToken.value,
    ).toBe('alice');
    expect(
      await connections.of(
        teamId,
        LINEAR,
        ConnectionOwner.person(UserId.of('user_bob')),
      ),
    ).toBeNull();
    expect(
      await new DrizzleConnectedIntegrations(new DrizzleContext(db)).ofTeam(
        teamId,
      ),
    ).toEqual([{ integration: 'linear', linkedAccount: '@team' }]);
    expect(
      (
        await new DrizzleIntegrationConnectionRoster(
          new DrizzleContext(db),
        ).ofTeam(teamId)
      ).map((each) => [each.personId, each.linkedAccount]),
    ).toEqual([['user_alice', '@alice']]);
  });

  it('cannot decrypt the encrypted token of one person as the token of another', async () => {
    const teamId = TeamId.of(randomUUID());
    const alice = ConnectionOwner.person(UserId.of('user_alice'));
    const bob = ConnectionOwner.person(UserId.of('user_bob'));

    await connections.save(connection(teamId, alice, 'alice'));
    await connections.save(connection(teamId, bob, 'bob'));

    const [alices] = await db
      .select()
      .from(schema.integrationConnection)
      .where(
        and(
          eq(schema.integrationConnection.teamId, teamId.value),
          eq(schema.integrationConnection.owner, alice.key),
        ),
      );
    await db
      .update(schema.integrationConnection)
      .set({ accessToken: alices?.accessToken ?? '' })
      .where(
        and(
          eq(schema.integrationConnection.teamId, teamId.value),
          eq(schema.integrationConnection.owner, bob.key),
        ),
      );

    await expect(connections.of(teamId, LINEAR, bob)).rejects.toThrow(
      /decrypted as/,
    );
  });

  it('lets one caller claim a refresh, and rejects a second claim made from the same reading', async () => {
    const teamId = TeamId.of(randomUUID());
    const alice = ConnectionOwner.person(UserId.of('user_alice'));
    await connections.save(connection(teamId, alice, 'alice'));

    const one = await connections.of(teamId, LINEAR, alice);
    const other = await connections.of(teamId, LINEAR, alice);

    await connections.save(
      one?.claimRefresh(NOW, 30_000) as IntegrationConnection,
    );
    await expect(
      connections.save(
        other?.claimRefresh(NOW, 30_000) as IntegrationConnection,
      ),
    ).rejects.toBeInstanceOf(IntegrationConnectionVersionConflictError);

    const claimed = await connections.of(teamId, LINEAR, alice);
    expect(claimed?.isClaimedAt(NOW)).toBe(true);
    expect(claimed?.refreshClaim?.until).toEqual(
      new Date(NOW.getTime() + 30_000),
    );

    await connections.save(
      claimed?.refreshedWith(
        OAuthTokens.of({ accessToken: 'alice-2', refreshToken: 'alice-r-2' }),
      ) as IntegrationConnection,
    );

    const refreshed = await connections.of(teamId, LINEAR, alice);
    expect(refreshed?.accessToken.value).toBe('alice-2');
    expect(refreshed?.refreshToken?.value).toBe('alice-r-2');
    expect(refreshed?.refreshClaim).toBeNull();
    expect(refreshed?.hasToken(AccessToken.of('alice'))).toBe(false);
  });

  it('replaces a person’s connection when they connect again, and deletes it when they disconnect', async () => {
    const teamId = TeamId.of(randomUUID());
    const alice = ConnectionOwner.person(UserId.of('user_alice'));

    await connections.save(connection(teamId, alice, 'alice'));
    await connections.save(connection(teamId, alice, 'alice-again'));

    const again = await connections.of(teamId, LINEAR, alice);
    expect(again?.accessToken.value).toBe('alice-again');

    await connections.remove((again as IntegrationConnection).disconnect());
    expect(await connections.of(teamId, LINEAR, alice)).toBeNull();
  });
});

describe('OAuth client registrations', () => {
  const registered = (teamId: TeamId, clientId: string) =>
    OAuth2ClientRegistration.register({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId,
      integration: LINEAR,
      registrationEndpoint: 'https://linear.app/oauth/register',
      redirectUri: 'https://app.example/api/integrations/oauth/callback',
      server: null,
      clientId,
      clientSecret: AccessToken.of(`${clientId}-secret`),
      secretExpiresAt: null,
    });

  it('stores the first registration, encrypted, and rejects a second made at the same time', async () => {
    const teamId = TeamId.of(randomUUID());

    await registrations.save(registered(teamId, 'client-1'));
    await expect(
      registrations.save(registered(teamId, 'client-2')),
    ).rejects.toBeInstanceOf(OAuth2ClientRegistrationVersionConflictError);

    const stored = await registrations.of(teamId, LINEAR);
    expect(stored?.clientId).toBe('client-1');
    expect(stored?.clientSecret?.value).toBe('client-1-secret');

    await registrations.save(
      (stored as OAuth2ClientRegistration).replaceWith(
        registered(teamId, 'client-3'),
      ),
    );
    expect((await registrations.of(teamId, LINEAR))?.clientId).toBe('client-3');
  });
});

describe('tasks waiting on a connection', () => {
  it('are found by the team, person and integration requested, until the ask is met', async () => {
    const { list, owner, teamId } = await createTeam(
      db,
      tasks,
      `connections-${randomUUID()}`,
    );
    const runId = RunId.of(randomUUID());
    const newNote = {
      station: StationName.of('Backlog'),
      body: TaskNoteBody.of('Set up.'),
      at: NOW,
      voice: Voice.station(),
    };

    await tasks.save(list.closeConversation(newNote));
    const closed = (await tasks.find(list.id)) as Task;
    await tasks.save(
      Task.rehydrate({ ...closed, currentRunId: runId }).askToConnect(
        runId,
        { ...newNote, body: TaskNoteBody.of('Connect Linear.') },
        ConnectionAsk.of({
          teamId,
          integration: 'linear',
          integrationName: 'Linear',
          personId: owner,
        }),
      ).task,
    );

    const waiting = await tasks.awaitingConnection(teamId, owner, 'linear');
    expect(waiting.map((each) => each.id.value)).toEqual([list.id.value]);
    expect(await tasks.awaitingConnection(teamId, owner, 'notion')).toEqual([]);
    expect(
      await tasks.awaitingConnection(TeamId.of(randomUUID()), owner, 'linear'),
    ).toEqual([]);

    const answered = waiting[0]?.connectionMade(teamId, 'linear', owner, {
      ...newNote,
      body: TaskNoteBody.of('Connected Linear.'),
      voice: Voice.person(owner),
    });
    await tasks.save(answered as Task);

    expect(await tasks.awaitingConnection(teamId, owner, 'linear')).toEqual([]);
    const read = (await tasks.find(list.id)) as Task;
    expect(read.notes.find((each) => each.connectionAsk)?.form).toBe(
      'connection',
    );
    expect(
      read.notes.find((each) => each.connectionAsk)?.connectionAsk?.met,
    ).toBe(true);
  });
});
