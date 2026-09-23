import { GITHUB_APP } from '@github/application/ports/github-app.port';
import { GITHUB_WEBHOOKS } from '@github/application/ports/github-webhooks.port';
import { PULL_REQUESTS } from '@github/application/ports/pull-request.port';
import { PULL_REQUEST_COMMENTS } from '@github/application/ports/pull-request-comments.port';
import { PULL_REQUEST_REACTIONS } from '@github/application/ports/pull-request-reactions.port';
import { PULL_REQUEST_REVIEWS } from '@github/application/ports/pull-request-reviews.port';
import { REMARKS } from '@github/application/ports/remarks.port';
import { REPOSITORY_ACCESS } from '@github/application/ports/repository-access.port';
import { REPOSITORY_CATALOG } from '@github/application/ports/repository-catalog.port';
import { REPOSITORY_GIT } from '@github/application/ports/repository-git.port';

import { WORKSPACE_CONNECTIONS } from '@github/application/ports/workspace-connections.port';
import { GITHUB_CONTROLLERS, GITHUB_PROVIDERS } from '@github/github.wiring';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [IdentityModule],
  controllers: [...GITHUB_CONTROLLERS],
  providers: [...GITHUB_PROVIDERS],
  exports: [
    WORKSPACE_CONNECTIONS,
    REPOSITORY_ACCESS,
    REPOSITORY_CATALOG,
    REPOSITORY_GIT,
    PULL_REQUESTS,
    PULL_REQUEST_COMMENTS,
    PULL_REQUEST_REACTIONS,
    PULL_REQUEST_REVIEWS,
    REMARKS,
    GITHUB_APP,
    GITHUB_WEBHOOKS,
  ],
})
export class GitHubModule {}
