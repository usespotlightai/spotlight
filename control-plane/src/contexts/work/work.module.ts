import { CatalogModule } from '@catalog/catalog.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { SEEDING_HARNESS } from '@lines/application/ports/seeding-harness.port';
import { STATION_DELETION_GUARD } from '@lines/application/ports/station-deletion-guard.port';
import { LinesModule } from '@lines/lines.module';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import { RunnersModule } from '@runners/runners.module';
import { SecretsModule } from '@secrets/secrets.module';
import { BUILT_IN_SKILL_KEYS } from '@work/application/ports/built-in-skills.port';
import { CHAT_TOOL_EXTENSIONS } from '@work/application/ports/chat-tool-extensions.port';
import { CONNECTION_ASKS } from '@work/application/ports/connection-asks.port';
import { HAPPENING_REACTIONS } from '@work/application/ports/happening-reactions.port';
import { HARNESS_COMMANDS } from '@work/application/ports/harness-commands.port';
import { HARNESS_PROFILE_REVIEW } from '@work/application/ports/harness-profile-review.port';
import { HOOK_TRACES } from '@work/application/ports/hook-traces.port';
import { INBOX_REQUESTS } from '@work/application/ports/inbox-requests.port';
import { NETWORK_CALLS } from '@work/application/ports/network-calls.port';
import { NOTE_FILES } from '@work/application/ports/note-files.port';
import { NOTICES } from '@work/application/ports/notices.port';
import { RUN_EVIDENCE } from '@work/application/ports/run-evidence.port';
import { RUN_FACTS } from '@work/application/ports/run-facts.port';
import { RUN_LEASES } from '@work/application/ports/run-leases.port';
import { RUNS } from '@work/application/ports/runs.port';
import { STARTING_POINT_HOLDS } from '@work/application/ports/starting-point-holds.port';
import { STATION_CONFIG_CANDIDATES } from '@work/application/ports/station-config-candidates.port';
import { STATION_HISTORY } from '@work/application/ports/station-history.port';
import { STATION_RUNS } from '@work/application/ports/station-runs.port';
import { STATION_TRIALS } from '@work/application/ports/station-trials.port';
import { TASK_NOTES_FROM_HOOKS } from '@work/application/ports/task-notes-from-hooks.port';
import { TASK_VIEWS } from '@work/application/ports/task-views.port';
import { TRACE_SCOPES } from '@work/application/ports/trace-scopes.port';
import { TRIALABLE_RUNS } from '@work/application/ports/trialable-runs.port';
import { WORK_RUN_LOOKUP } from '@work/application/ports/work-run-lookup.port';
import { WORK_TASK_LOOKUP } from '@work/application/ports/work-task-lookup.port';
import { WORK_STARTUP } from '@work/work.startup';
import { WORK_CONTROLLERS, WORK_PROVIDERS } from '@work/work.wiring';

const BINDINGS = contextBindings([STATION_DELETION_GUARD, SEEDING_HARNESS]);

@Module({
  imports: [
    IdentityModule,
    SecretsModule,
    CatalogModule,
    GitHubModule,
    RunnersModule,
    LinesModule,
  ],
  controllers: [...WORK_CONTROLLERS],
  providers: [...WORK_PROVIDERS, WORK_STARTUP, ...BINDINGS.exposed],
  exports: [
    WORK_RUN_LOOKUP,
    WORK_TASK_LOOKUP,
    BUILT_IN_SKILL_KEYS,
    HAPPENING_REACTIONS,
    HARNESS_PROFILE_REVIEW,
    TASK_VIEWS,
    HOOK_TRACES,
    NETWORK_CALLS,
    TASK_NOTES_FROM_HOOKS,
    INBOX_REQUESTS,
    NOTICES,
    STATION_RUNS,
    RUN_EVIDENCE,
    TRIALABLE_RUNS,
    STATION_CONFIG_CANDIDATES,
    STATION_TRIALS,
    STATION_HISTORY,
    TRACE_SCOPES,
    CHAT_TOOL_EXTENSIONS,
    HARNESS_COMMANDS,
    RUNS,
    RUN_FACTS,
    RUN_LEASES,
    STARTING_POINT_HOLDS,
    NOTE_FILES,
    CONNECTION_ASKS,
    ...BINDINGS.exposedTokens,
  ],
})
export class WorkModule {}

@Module({
  imports: [WorkModule],
  providers: [...BINDINGS.bound],
  exports: [...BINDINGS.tokens],
})
export class WorkBindingsModule {}
