import { IdentityModule } from '@identity/identity.module';
import { SEEDING_HARNESS } from '@lines/application/ports/seeding-harness.port';
import { LinesModule } from '@lines/lines.module';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import { RunnersModule } from '@runners/runners.module';
import { ARCHIVE_HOLDERS } from '@runs/application/ports/archive-holders.port';
import { HARNESS_LAUNCH } from '@runs/application/ports/harness-launch.port';
import { HARNESS_PROFILE_REVIEW } from '@runs/application/ports/harness-profile-review.port';
import { HARNESS_TOOL_NAMES } from '@runs/application/ports/harness-tool-names.port';
import { HOOK_TRACES } from '@runs/application/ports/hook-traces.port';
import { NETWORK_CALLS } from '@runs/application/ports/network-calls.port';
import { RUN_CONNECTIONS } from '@runs/application/ports/run-connections.port';
import { RUN_FACTS } from '@runs/application/ports/run-facts.port';
import { RUN_JOURNAL } from '@runs/application/ports/run-journal.port';
import { RUN_JOURNALS } from '@runs/application/ports/run-journals.port';
import { RUN_LEASES } from '@runs/application/ports/run-leases.port';
import { RUN_PROGRESS } from '@runs/application/ports/run-progress.port';
import { RUN_REQUESTER_LABELS } from '@runs/application/ports/run-requester-labels.port';
import { RUN_START_GATES } from '@runs/application/ports/run-start-gates.port';
import { RUN_TURNS } from '@runs/application/ports/run-turns.port';
import { RUN_USAGES } from '@runs/application/ports/run-usage-reader.port';
import { RUNS } from '@runs/application/ports/runs.port';
import { STARTING_POINT_HOLDS } from '@runs/application/ports/starting-point-holds.port';
import { RUNS_CONTROLLERS, RUNS_PROVIDERS } from '@runs/runs.wiring';
import { SecretsModule } from '@secrets/secrets.module';

const BINDINGS = contextBindings([SEEDING_HARNESS]);

@Module({
  imports: [IdentityModule, SecretsModule, RunnersModule, LinesModule],
  controllers: [...RUNS_CONTROLLERS],
  providers: [...RUNS_PROVIDERS, ...BINDINGS.exposed],
  exports: [
    RUNS,
    RUN_FACTS,
    RUN_LEASES,
    RUN_PROGRESS,
    RUN_TURNS,
    RUN_USAGES,
    RUN_CONNECTIONS,
    RUN_JOURNAL,
    RUN_JOURNALS,
    RUN_START_GATES,
    ARCHIVE_HOLDERS,
    RUN_REQUESTER_LABELS,
    HARNESS_LAUNCH,
    HARNESS_TOOL_NAMES,
    HARNESS_PROFILE_REVIEW,
    HOOK_TRACES,
    NETWORK_CALLS,
    STARTING_POINT_HOLDS,
    ...BINDINGS.exposedTokens,
  ],
})
export class RunsModule {}

@Module({
  imports: [RunsModule],
  providers: [...BINDINGS.bound],
  exports: [...BINDINGS.tokens],
})
export class RunsBindingsModule {}
