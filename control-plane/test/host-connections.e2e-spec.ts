import { randomUUID } from 'node:crypto';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import { HostConnectionVersionConflictError } from '@integrations/domain/exceptions/host-connection-version-conflict.error';
import { OAuth2ClientRegistrationVersionConflictError } from '@integrations/domain/exceptions/oauth2-client-registration-version-conflict.error';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { DrizzleHostConnectionRoster } from '@integrations/infrastructure/persistence/drizzle/readers/host-connection-roster.reader';
import { DrizzleLinkedHosts } from '@integrations/infrastructure/persistence/drizzle/readers/linked-hosts.reader';
import { DrizzleHostConnections } from '@integrations/infrastructure/persistence/drizzle/repositories/host-connections.repository';
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
import { openTeam } from './support/team';

const NOW = new Date('2026-10-05T10:00:00.000Z');
const LINEAR = SourceKey.of('linear');

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
let connections: DrizzleHostConnections;
let registrations: DrizzleOAuth2ClientRegistrations;
let tasks: DrizzleTaskRepository;

beforeAll(async () => {
  database = await openDatabase('host_connections');
  db = database.db;
  const context = new DrizzleContext(db);
  connections = new DrizzleHostConnections(
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

const linked = (
  teamId: TeamId,
  holder: ConnectionHolder,
  accessToken: string,
) =>
  HostConnection.linkFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId,
    source: LINEAR,
    holder,
    grant: HostGrant.of({
      accessToken,
      refreshToken: `${accessToken}-refresh`,
      expiresAt: new Date('2026-10-05T11:00:00.000Z'),
      handle: `@${accessToken}`,
    }),
  });

describe('host connections kept per holder', () => {
  it('keeps the team’s and each person’s connection to one host apart', async () => {
    const teamId = TeamId.of(randomUUID());
    const alice = ConnectionHolder.person(UserId.of('user_alice'));

    await connections.save(linked(teamId, ConnectionHolder.team(), 'team'));
    await connections.save(linked(teamId, alice, 'alice'));

    expect(
      (await connections.of(teamId, LINEAR, ConnectionHolder.team()))
        ?.accessToken.value,
    ).toBe('team');
    expect(
      (await connections.of(teamId, LINEAR, alice))?.accessToken.value,
    ).toBe('alice');
    expect(
      await connections.of(
        teamId,
        LINEAR,
        ConnectionHolder.person(UserId.of('user_bob')),
      ),
    ).toBeNull();
    expect(
      await new DrizzleLinkedHosts(new DrizzleContext(db)).ofTeam(teamId),
    ).toEqual([{ source: 'linear', handle: '@team' }]);
    expect(
      (
        await new DrizzleHostConnectionRoster(new DrizzleContext(db)).ofTeam(
          teamId,
        )
      ).map((each) => [each.personId, each.handle]),
    ).toEqual([['user_alice', '@alice']]);
  });

  it('cannot decrypt the encrypted token of one person as the token of another', async () => {
    const teamId = TeamId.of(randomUUID());
    const alice = ConnectionHolder.person(UserId.of('user_alice'));
    const bob = ConnectionHolder.person(UserId.of('user_bob'));

    await connections.save(linked(teamId, alice, 'alice'));
    await connections.save(linked(teamId, bob, 'bob'));

    const [alices] = await db
      .select()
      .from(schema.hostConnection)
      .where(
        and(
          eq(schema.hostConnection.teamId, teamId.value),
          eq(schema.hostConnection.holder, alice.key),
        ),
      );
    await db
      .update(schema.hostConnection)
      .set({ accessToken: alices?.accessToken ?? '' })
      .where(
        and(
          eq(schema.hostConnection.teamId, teamId.value),
          eq(schema.hostConnection.holder, bob.key),
        ),
      );

    await expect(connections.of(teamId, LINEAR, bob)).rejects.toThrow(
      /decrypted as/,
    );
  });

  it('lets one caller claim a renewal, and refuses a second claim made from the same reading', async () => {
    const teamId = TeamId.of(randomUUID());
    const alice = ConnectionHolder.person(UserId.of('user_alice'));
    await connections.save(linked(teamId, alice, 'alice'));

    const one = await connections.of(teamId, LINEAR, alice);
    const other = await connections.of(teamId, LINEAR, alice);

    await connections.save(one?.claimRenewal(NOW, 30_000) as HostConnection);
    await expect(
      connections.save(other?.claimRenewal(NOW, 30_000) as HostConnection),
    ).rejects.toBeInstanceOf(HostConnectionVersionConflictError);

    const claimed = await connections.of(teamId, LINEAR, alice);
    expect(claimed?.isClaimedAt(NOW)).toBe(true);
    expect(claimed?.renewalClaim?.until).toEqual(
      new Date(NOW.getTime() + 30_000),
    );

    await connections.save(
      claimed?.renewedWith(
        HostGrant.of({ accessToken: 'alice-2', refreshToken: 'alice-r-2' }),
      ) as HostConnection,
    );

    const renewed = await connections.of(teamId, LINEAR, alice);
    expect(renewed?.accessToken.value).toBe('alice-2');
    expect(renewed?.refreshToken?.value).toBe('alice-r-2');
    expect(renewed?.renewalClaim).toBeNull();
    expect(renewed?.refusedToken(AccessToken.of('alice'))).toBe(false);
  });

  it('replaces a person’s connection when they connect again, and forgets it when they disconnect', async () => {
    const teamId = TeamId.of(randomUUID());
    const alice = ConnectionHolder.person(UserId.of('user_alice'));

    await connections.save(linked(teamId, alice, 'alice'));
    await connections.save(linked(teamId, alice, 'alice-again'));

    const again = await connections.of(teamId, LINEAR, alice);
    expect(again?.accessToken.value).toBe('alice-again');

    await connections.remove((again as HostConnection).disconnect());
    expect(await connections.of(teamId, LINEAR, alice)).toBeNull();
  });
});

describe('OAuth client registrations', () => {
  const registered = (teamId: TeamId, clientId: string) =>
    OAuth2ClientRegistration.register({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId,
      source: LINEAR,
      registrationEndpoint: 'https://linear.app/oauth/register',
      redirectUri: 'https://app.example/api/integrations/oauth/callback',
      server: null,
      clientId,
      clientSecret: AccessToken.of(`${clientId}-secret`),
      secretExpiresAt: null,
    });

  it('keeps the first registration, encrypted, and refuses a second made at the same time', async () => {
    const teamId = TeamId.of(randomUUID());

    await registrations.save(registered(teamId, 'client-1'));
    await expect(
      registrations.save(registered(teamId, 'client-2')),
    ).rejects.toBeInstanceOf(OAuth2ClientRegistrationVersionConflictError);

    const kept = await registrations.of(teamId, LINEAR);
    expect(kept?.clientId).toBe('client-1');
    expect(kept?.clientSecret?.value).toBe('client-1-secret');

    await registrations.save(
      (kept as OAuth2ClientRegistration).replaceWith(
        registered(teamId, 'client-3'),
      ),
    );
    expect((await registrations.of(teamId, LINEAR))?.clientId).toBe('client-3');
  });
});

describe('tasks waiting on a connection', () => {
  it('are found by the team, person and integration asked about, until the ask is met', async () => {
    const { list, owner, teamId } = await openTeam(
      db,
      tasks,
      `connections-${randomUUID()}`,
    );
    const runId = RunId.of(randomUUID());
    const saying = {
      station: StationName.of('Backlog'),
      body: TaskNoteBody.of('Set up.'),
      at: NOW,
      voice: Voice.station(),
    };

    await tasks.save(list.settled(saying));
    const settled = (await tasks.find(list.id)) as Task;
    await tasks.save(
      Task.rehydrate({ ...settled, currentRunId: runId }).askToConnect(
        runId,
        { ...saying, body: TaskNoteBody.of('Connect Linear.') },
        ConnectionAsk.of({
          teamId,
          source: 'linear',
          integration: 'Linear',
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
      ...saying,
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
