import { CreateWorkspaceTokenHandler } from '@identity/application/commands/handlers/create-workspace-token.handler';
import { CreateWorkspaceTokenCommand } from '@identity/application/commands/workspace-token.commands';
import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenAlreadyIssuedError } from '@identity/domain/exceptions/workspace-token-already-issued.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import {
  access,
  creates,
  OWNER,
  transaction,
} from '@identity/identity.resources.fake-spec';
import { IdentityDefinitions } from '@identity/infrastructure/definitions/identity-definitions';
import { RandomTokenIssuer } from '@platform/tokens/random-token-issuer.service';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { IdempotentReservation } from '@shared-kernel/application/ports/idempotent-creates.port';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T09:00:00.000Z');

const CI = {
  name: 'ci',
  scopes: ['plan'],
  expiresAt: '2026-12-31T00:00:00Z',
};

const issuing = (
  over: {
    isAdmin?: boolean;
    reservation?: IdempotentReservation;
    throwing?: Error;
  } = {},
) => {
  const add = vi.fn(async (_: WorkspaceToken) => {
    if (over.throwing) {
      throw over.throwing;
    }
  });
  const issuer = new RandomTokenIssuer();
  const keys = creates();

  if (over.reservation) {
    keys.reserve.mockResolvedValue(over.reservation as never);
  }

  const handler = new CreateWorkspaceTokenHandler(
    access(over.isAdmin),
    new IdentityDefinitions(),
    { add } as unknown as WorkspaceTokenRepository,
    keys,
    { generate: () => 'token_new' },
    issuer,
    { now: () => NOW, sleep: async () => {} },
    transaction,
  );

  return {
    add,
    issuer,
    issue: (definition: unknown) =>
      handler.execute(
        new CreateWorkspaceTokenCommand(
          'ws_1',
          actorFor(OWNER.value),
          'key-1',
          definition,
        ),
      ),
  };
};

describe('CreateWorkspaceTokenHandler', () => {
  it('returns the token once, storing only its hash', async () => {
    const { issue, add, issuer } = issuing();
    const issued = await issue(CI);

    expect(issued?.created).toMatchObject({
      outcome: 'created',
      id: 'token_new',
    });
    expect(issued?.token).toMatch(/^[\w-]{43}$/);

    const [stored] = add.mock.calls[0] as [WorkspaceToken];

    expect(stored.hash.value).toBe(issuer.hash(issued?.token ?? ''));
    expect(stored.issuedBy).toEqual(OWNER);
  });

  it('returns no token for a retry, since only the first response carried it', async () => {
    const { issue, add } = issuing({
      reservation: { kind: 'already-created', createdId: 'token_first' },
    });

    expect(await issue(CI)).toEqual({
      created: { outcome: 'created', id: 'token_first', replayed: true },
      token: null,
    });
    expect(add).not.toHaveBeenCalled();
  });

  it('forbids someone who reads the workspace but does not administer it', async () => {
    const { issue, add } = issuing({ isAdmin: false });

    expect(await issue(CI)).toEqual({
      created: forbiddenTo('administer'),
      token: null,
    });
    expect(add).not.toHaveBeenCalled();
  });

  it('rejects a token that has already expired, pointing at when', async () => {
    const { issue } = issuing();
    const issued = await issue({ ...CI, expiresAt: '2026-01-01T00:00:00Z' });

    expect(issued?.token).toBeNull();
    expect(
      issued?.created.outcome === 'invalid' &&
        issued.created.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['expiresAt']);
  });

  it('says the name is taken rather than returning a token', async () => {
    const { issue } = issuing({
      throwing: new WorkspaceTokenAlreadyIssuedError('ci'),
    });

    expect(await issue(CI)).toEqual({
      created: { outcome: 'already-exists', address: 'ci' },
      token: null,
    });
  });
});
