import { MEMBER_READER } from '@identity/application/ports/member-reader.port';
import { PERSON_READER } from '@identity/application/ports/person-reader.port';
import { TEAM_DIRECTORY } from '@identity/application/ports/team-directory.port';
import { TEAM_HOLDINGS } from '@identity/application/ports/team-holdings.port';
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
    MEMBER_READER,
    WORKSPACE_TOKEN_IDENTITY,
    AuthenticationModule,
  ],
})
export class IdentityModule {}
