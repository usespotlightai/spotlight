import { CatalogModule } from '@catalog/catalog.module';
import { GitHubModule } from '@github/github.module';
import { IdentityModule } from '@identity/identity.module';
import { STATION_DELETION_GUARD } from '@lines/application/ports/station-deletion-guard.port';
import { LinesModule } from '@lines/lines.module';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import { RunnersModule } from '@runners/runners.module';
import { RUN_FILES } from '@runs/application/ports/run-files.port';
import { RUN_VIEWERS } from '@runs/application/ports/run-viewers.port';
import { RunsModule } from '@runs/runs.module';
import { SecretsModule } from '@secrets/secrets.module';
import { BUILT_IN_SKILL_KEYS } from '@work/application/ports/built-in-skills.port';
import { CHAT_TOOL_EXTENSIONS } from '@work/application/ports/chat-tool-extensions.port';
import { CONNECTION_ASKS } from '@work/application/ports/connection-asks.port';
import { HAPPENING_REACTIONS } from '@work/application/ports/happening-reactions.port';
import { HARNESS_COMMANDS } from '@work/application/ports/harness-commands.port';
import { INBOX_REQUESTS } from '@work/application/ports/inbox-requests.port';
import { NOTE_FILES } from '@work/application/ports/note-files.port';
import { NOTICES } from '@work/application/ports/notices.port';
import { RUN_EVIDENCE } from '@work/application/ports/run-evidence.port';
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

const BINDINGS = contextBindings([
  STATION_DELETION_GUARD,
  RUN_VIEWERS,
  RUN_FILES,
]);

@Module({
  imports: [
    IdentityModule,
    SecretsModule,
    CatalogModule,
    GitHubModule,
    RunnersModule,
    LinesModule,
    RunsModule,
  ],
  controllers: [...WORK_CONTROLLERS],
  providers: [...WORK_PROVIDERS, WORK_STARTUP, ...BINDINGS.exposed],
  exports: [
    WORK_RUN_LOOKUP,
    WORK_TASK_LOOKUP,
    BUILT_IN_SKILL_KEYS,
    HAPPENING_REACTIONS,
    TASK_VIEWS,
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
