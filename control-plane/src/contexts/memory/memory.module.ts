import { IdentityModule } from '@identity/identity.module';
import { TEAM_MEMORY_USE } from '@memory/application/ports/team-memory-use.port';
import { MEMORY_CONTROLLERS, MEMORY_PROVIDERS } from '@memory/memory.wiring';
import { Module } from '@nestjs/common';
import { MEMORIES_BRIEFED_BEFORE } from '@work/application/ports/memories-briefed-before.port';
import { TEAM_MEMORIES } from '@work/application/ports/team-memories.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, WorkModule],
  controllers: [...MEMORY_CONTROLLERS],
  providers: [...MEMORY_PROVIDERS],
  exports: [TEAM_MEMORIES, MEMORIES_BRIEFED_BEFORE, TEAM_MEMORY_USE],
})
export class MemoryModule {}
