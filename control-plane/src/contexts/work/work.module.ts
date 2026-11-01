import { CatalogModule } from '@catalog/catalog.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RunnersModule } from '@runners/runners.module';
import { SecretsModule } from '@secrets/secrets.module';
import { BUILT_IN_SKILL_KEYS } from '@work/application/ports/built-in-skills.port';
import { CHECK_ENDINGS } from '@work/application/ports/check-endings.port';
import { ENABLED_AT_STATIONS } from '@work/application/ports/enabled-at-stations.port';
import { HAPPENING_REACTIONS } from '@work/application/ports/happening-reactions.port';
import { HARNESS_PROFILE_REVIEW } from '@work/application/ports/harness-profile-review.port';
import { HOOK_TRACES } from '@work/application/ports/hook-traces.port';
import { INBOX_REQUESTS } from '@work/application/ports/inbox-requests.port';
import { LINE_RESOURCES } from '@work/application/ports/line-resources.port';
import { NETWORK_CALLS } from '@work/application/ports/network-calls.port';
import { NOTICES } from '@work/application/ports/notices.port';
import { REPLAY_CANDIDATES } from '@work/application/ports/replay-candidates.port';
import { REPLAY_DISPATCH } from '@work/application/ports/replay-dispatch.port';
import { REPLAYABLE_RUNS } from '@work/application/ports/replayable-runs.port';
import { RUN_EVIDENCE } from '@work/application/ports/run-evidence.port';
import { SEARCH_DISPATCH } from '@work/application/ports/search-dispatch.port';
import { SEARCH_RUNS } from '@work/application/ports/search-runs.port';
import { STARTING_POINT_HOLDS } from '@work/application/ports/starting-point-holds.port';
import { STATION_RUNS } from '@work/application/ports/station-runs.port';
import { TASK_NOTES_FROM_HOOKS } from '@work/application/ports/task-notes-from-hooks.port';
import { TASK_VIEWS } from '@work/application/ports/task-views.port';
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
    BUILT_IN_SKILL_KEYS,
    HAPPENING_REACTIONS,
    ENABLED_AT_STATIONS,
    HARNESS_PROFILE_REVIEW,
    LINE_RESOURCES,
    CHECK_ENDINGS,
    TASK_VIEWS,
    HOOK_TRACES,
    NETWORK_CALLS,
    TASK_NOTES_FROM_HOOKS,
    INBOX_REQUESTS,
    NOTICES,
    STATION_RUNS,
    RUN_EVIDENCE,
    REPLAYABLE_RUNS,
    REPLAY_CANDIDATES,
    REPLAY_DISPATCH,
    SEARCH_DISPATCH,
    SEARCH_RUNS,
    STARTING_POINT_HOLDS,
  ],
})
export class WorkModule {}
