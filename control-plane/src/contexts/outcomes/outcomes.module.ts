import { IdentityModule } from '@identity/identity.module';
import { MemoryModule } from '@memory/memory.module';
import { Module } from '@nestjs/common';
import { CHANGE_JUDGING } from '@outcomes/application/ports/change-judging.port';
import { JUDGE_STANDING } from '@outcomes/application/ports/judge-standing.port';
import { PAIR_JUDGING } from '@outcomes/application/ports/pair-judging.port';
import { RUN_ACCEPTANCE } from '@outcomes/application/ports/run-acceptance.port';
import {
  OUTCOMES_CONTROLLERS,
  OUTCOMES_PROVIDERS,
} from '@outcomes/outcomes.wiring';
import { RUN_OUTCOMES } from '@work/application/ports/run-outcomes.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, WorkModule, MemoryModule],
  controllers: [...OUTCOMES_CONTROLLERS],
  providers: [...OUTCOMES_PROVIDERS],
  exports: [
    RUN_OUTCOMES,
    JUDGE_STANDING,
    CHANGE_JUDGING,
    PAIR_JUDGING,
    RUN_ACCEPTANCE,
  ],
})
export class OutcomesModule {}
