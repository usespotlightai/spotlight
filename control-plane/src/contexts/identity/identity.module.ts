import { GITHUB_ACTIONS_TRUSTS } from '@identity/application/ports/github-actions-trusts.port';
import { MEMBER_DIRECTORY } from '@identity/application/ports/member-directory.port';
import { OIDC_TRUST_CONFIGURATION } from '@identity/application/ports/oidc-trust-configuration.port';
import { PERSON_READER } from '@identity/application/ports/person-reader.port';
import { RUN_TOKENS } from '@identity/application/ports/run-tokens.port';
import { TEAM_DEPENDENTS } from '@identity/application/ports/team-dependents.port';
import { TEAM_DIRECTORY } from '@identity/application/ports/team-directory.port';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import { WORKSPACE_DEPENDENTS } from '@identity/application/ports/workspace-dependents.port';
import { WORKSPACE_OUTBOUND_HOSTS } from '@identity/application/ports/workspace-outbound-hosts.port';
import { WORKSPACE_READER } from '@identity/application/ports/workspace-reader.port';
import {
  IDENTITY_CONTROLLERS,
  IDENTITY_PROVIDERS,
} from '@identity/identity.wiring';

import { AuthenticationModule } from '@identity/infrastructure/auth/auth.module';
import { Module } from '@nestjs/common';
import { WORKSPACE_OUTBOUND_SCOPE } from '@shared-kernel/application/ports/workspace-outbound-scope.port';
import { WORKSPACE_TOKEN_IDENTITY } from '@shared-kernel/application/ports/workspace-token-identity.port';

@Module({
  imports: [AuthenticationModule],
  controllers: [...IDENTITY_CONTROLLERS],
  providers: [...IDENTITY_PROVIDERS],
  exports: [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    TEAM_DEPENDENTS,
    WORKSPACE_DEPENDENTS,
    WORKSPACE_READER,
    WORKSPACE_OUTBOUND_HOSTS,
    WORKSPACE_OUTBOUND_SCOPE,
    PERSON_READER,
    MEMBER_DIRECTORY,
    WORKSPACE_TOKEN_IDENTITY,
    OIDC_TRUST_CONFIGURATION,
    RUN_TOKENS,
    GITHUB_ACTIONS_TRUSTS,
    AuthenticationModule,
  ],
})
export class IdentityModule {}
