import { MEMBER_DIRECTORY } from '@identity/application/ports/member-directory.port';
import { PERSON_READER } from '@identity/application/ports/person-reader.port';
import { RUN_TOKENS } from '@identity/application/ports/run-tokens.port';
import { TEAM_DIRECTORY } from '@identity/application/ports/team-directory.port';
import { TEAM_HOLDINGS } from '@identity/application/ports/team-holdings.port';
import { TOKEN_TRUST_CONFIGURATION } from '@identity/application/ports/token-trust-configuration.port';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import { WORKSPACE_HOLDINGS } from '@identity/application/ports/workspace-holdings.port';
import { WORKSPACE_READER } from '@identity/application/ports/workspace-reader.port';
import {
  IDENTITY_CONTROLLERS,
  IDENTITY_PROVIDERS,
} from '@identity/identity.wiring';

import { AuthenticationModule } from '@identity/infrastructure/auth/auth.module';
import { Module } from '@nestjs/common';
import { WORKSPACE_TOKEN_IDENTITY } from '@shared-kernel/application/ports/workspace-token-identity.port';

@Module({
  imports: [AuthenticationModule],
  controllers: [...IDENTITY_CONTROLLERS],
  providers: [...IDENTITY_PROVIDERS],
  exports: [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    TEAM_HOLDINGS,
    WORKSPACE_HOLDINGS,
    WORKSPACE_READER,
    PERSON_READER,
    MEMBER_DIRECTORY,
    WORKSPACE_TOKEN_IDENTITY,
    TOKEN_TRUST_CONFIGURATION,
    RUN_TOKENS,
    AuthenticationModule,
  ],
})
export class IdentityModule {}
