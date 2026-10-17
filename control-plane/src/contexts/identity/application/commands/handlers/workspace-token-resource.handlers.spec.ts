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
import { TokenMint } from '@platform/tokens/token-mint.service';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { IdempotentClaim } from '@shared-kernel/application/ports/idempotent-creates.port';
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
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
    administers?: boolean;
    claim?: IdempotentClaim;
    throwing?: Error;
  } = {},
) => {
  const add = vi.fn(async (_: WorkspaceToken) => {
    if (over.throwing) {
      throw over.throwing;
    }
  });
  const mint = new TokenMint();
  const keys = creates();

  if (over.claim) {
    keys.claim.mockResolvedValue(over.claim as never);
  }

  const handler = new CreateWorkspaceTokenHandler(
    access(over.administers),
    new IdentityDefinitions(),
    { add } as unknown as WorkspaceTokenRepository,
    keys,
    { generate: () => 'token_new' },
    mint,
    { now: () => NOW, sleep: async () => {} },
    transaction,
  );

  return {
    add,
    mint,
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
  it('answers the token once, keeping only its hash', async () => {
    const { issue, add, mint } = issuing();
    const issued = await issue(CI);

    expect(issued?.created).toMatchObject({
      outcome: 'created',
      id: 'token_new',
    });
    expect(issued?.token).toMatch(/^[\w-]{43}$/);

    const [kept] = add.mock.calls[0] as [WorkspaceToken];

    expect(kept.hash.value).toBe(mint.hash(issued?.token ?? ''));
    expect(kept.issuedBy).toEqual(OWNER);
  });

  it('answers no token to a retry, since only the first answer carried it', async () => {
    const { issue, add } = issuing({
      claim: { kind: 'replay', createdId: 'token_first' },
    });

    expect(await issue(CI)).toEqual({
      created: { outcome: 'created', id: 'token_first', replayed: true },
      token: null,
    });
    expect(add).not.toHaveBeenCalled();
  });

  it('forbids someone who reads the workspace but does not administer it', async () => {
    const { issue, add } = issuing({ administers: false });

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

  it('says the name is taken rather than answering a token', async () => {
    const { issue } = issuing({
      throwing: new WorkspaceTokenAlreadyIssuedError('ci'),
    });

    expect(await issue(CI)).toEqual({
      created: { outcome: 'taken', address: 'ci' },
      token: null,
    });
  });
});
