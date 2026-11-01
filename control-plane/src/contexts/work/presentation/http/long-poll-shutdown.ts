import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { LongPoll } from '@work/application/services/long-poll';

@Injectable()
export class LongPollShutdown implements OnModuleDestroy {
  constructor(private readonly polls: LongPoll) {}

  onModuleDestroy(): void {
    this.polls.stop();
  }
}
