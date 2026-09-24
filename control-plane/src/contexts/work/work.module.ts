import { CatalogModule } from '@catalog/catalog.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RunnersModule } from '@runners/runners.module';
import { SecretsModule } from '@secrets/secrets.module';
import { SHIPPED_SKILL_KEYS } from '@work/application/ports/built-in-skills.port';
import { GIVEN_AT_STATIONS } from '@work/application/ports/given-at-stations.port';
import { HAPPENING_REACTIONS } from '@work/application/ports/happening-reactions.port';
import { HARNESS_PROFILE_REVIEW } from '@work/application/ports/harness-profile-review.port';
import { WORK_LOOKUP } from '@work/application/ports/work-lookup.port';
import { WORK_CONTROLLERS, WORK_PROVIDERS } from '@work/work.wiring';

@Module({
  imports: [
    DiscoveryModule,
    IdentityModule,
    SecretsModule,
    CatalogModule,
    GitHubModule,
    RunnersModule,
  ],
  controllers: [...WORK_CONTROLLERS],
  providers: [...WORK_PROVIDERS],
  exports: [
    WORK_LOOKUP,
    SHIPPED_SKILL_KEYS,
    HAPPENING_REACTIONS,
    GIVEN_AT_STATIONS,
    HARNESS_PROFILE_REVIEW,
  ],
})
export class WorkModule {}
