import { IdentityModule } from '@identity/identity.module';
import { MEMORY_CONTROLLERS, MEMORY_PROVIDERS } from '@memory/memory.wiring';
import { Module } from '@nestjs/common';
import { TEAM_MEMORIES } from '@work/application/ports/team-memories.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, WorkModule],
  controllers: [...MEMORY_CONTROLLERS],
  providers: [...MEMORY_PROVIDERS],
  exports: [TEAM_MEMORIES],
})
export class MemoryModule {}
