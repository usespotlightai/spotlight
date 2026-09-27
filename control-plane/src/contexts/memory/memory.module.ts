import { MEMORY_PROVIDERS } from '@memory/memory.wiring';
import { Module } from '@nestjs/common';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [WorkModule],
  providers: [...MEMORY_PROVIDERS],
})
export class MemoryModule {}
