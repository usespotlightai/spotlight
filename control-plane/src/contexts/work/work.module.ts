import { CatalogModule } from '@catalog/catalog.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RunnersModule } from '@runners/runners.module';
import { SecretsModule } from '@secrets/secrets.module';
import { SHIPPED_SKILL_KEYS } from '@work/application/ports/built-in-skills.port';
import { CHECK_ENDINGS } from '@work/application/ports/check-endings.port';
import { GIVEN_AT_STATIONS } from '@work/application/ports/given-at-stations.port';
import { HAPPENING_REACTIONS } from '@work/application/ports/happening-reactions.port';
import { HARNESS_PROFILE_REVIEW } from '@work/application/ports/harness-profile-review.port';
import { HOOK_TRACES } from '@work/application/ports/hook-traces.port';
import { HOOKED_TASKS } from '@work/application/ports/hooked-tasks.port';
import { LINE_RESOURCES } from '@work/application/ports/line-resources.port';
import { NETWORK_CALLS } from '@work/application/ports/network-calls.port';
import { TASK_NOTES_FROM_HOOKS } from '@work/application/ports/task-notes-from-hooks.port';
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
    LINE_RESOURCES,
    CHECK_ENDINGS,
    HOOKED_TASKS,
    HOOK_TRACES,
    NETWORK_CALLS,
    TASK_NOTES_FROM_HOOKS,
  ],
})
export class WorkModule {}
