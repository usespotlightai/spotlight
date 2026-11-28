import { ASSIST_SESSION_LABELS } from '@assist/application/ports/assist-session-labels.port';
import { ASSIST_SESSIONS } from '@assist/application/ports/assist-sessions.port';
import { ASSIST_CONTROLLERS, ASSIST_PROVIDERS } from '@assist/assist.wiring';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import { RunsModule } from '@runs/runs.module';
import { WorkModule } from '@work/work.module';

const BINDINGS = contextBindings([ASSIST_SESSIONS, ASSIST_SESSION_LABELS]);

@Module({
  imports: [RunsModule, WorkModule],
  controllers: [...ASSIST_CONTROLLERS],
  providers: [...ASSIST_PROVIDERS, ...BINDINGS.exposed],
  exports: [...BINDINGS.exposedTokens],
})
class AssistModule {}

/** Lets insights, change review and memory order assist sessions, and name them. */
@Module({
  imports: [AssistModule],
  providers: [...BINDINGS.bound],
  exports: [...BINDINGS.tokens],
})
export class AssistBindingsModule {}
