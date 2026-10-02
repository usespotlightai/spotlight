import { ChangeReviewModule } from '@change-review/change-review.module';
import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { OutcomesModule } from '@outcomes/outcomes.module';
import {
  REPLAYS_CONTROLLERS,
  REPLAYS_PROVIDERS,
} from '@replays/replays.wiring';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, WorkModule, ChangeReviewModule, OutcomesModule],
  controllers: [...REPLAYS_CONTROLLERS],
  providers: [...REPLAYS_PROVIDERS],
})
export class ReplaysModule {}
