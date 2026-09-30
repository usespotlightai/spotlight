import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import {
  OUTCOMES_CONTROLLERS,
  OUTCOMES_PROVIDERS,
} from '@outcomes/outcomes.wiring';
import { RUN_OUTCOMES } from '@work/application/ports/run-outcomes.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, WorkModule],
  controllers: [...OUTCOMES_CONTROLLERS],
  providers: [...OUTCOMES_PROVIDERS],
  exports: [RUN_OUTCOMES],
})
export class OutcomesModule {}
