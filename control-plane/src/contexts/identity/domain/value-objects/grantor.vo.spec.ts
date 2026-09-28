import { Grantor } from '@identity/domain/value-objects/grantor.vo';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { describe, expect, it } from 'vitest';

const SECRETS = TokenScopes.named(['configure', 'secrets']);

describe('Grantor', () => {
  it('grants whatever a person grants, since only an admin gets this far', () => {
    expect(
      Grantor.of(PersonPrincipal.of(UserId.of('admin_1'))).covers(SECRETS),
    ).toBe(true);
  });

  it('grants through a token no more than the token holds', () => {
    const token = (scopes: string[]) =>
      Grantor.of(
        TokenPrincipal.of({
          tokenId: WorkspaceTokenId.of('token_1'),
          workspaceId: WorkspaceId.of('ws_1'),
          scopes: TokenScopes.named(scopes),
          issuedBy: UserId.of('admin_1'),
        }),
      );

    expect(token(['configure', 'trusts']).covers(SECRETS)).toBe(false);
    expect(token(['configure', 'secrets', 'trusts']).covers(SECRETS)).toBe(
      true,
    );
  });
});
