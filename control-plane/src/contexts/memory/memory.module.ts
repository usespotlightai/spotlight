import { IdentityModule } from '@identity/identity.module';
import { LinesModule } from '@lines/lines.module';
import { TEAM_MEMORY_USE } from '@memory/application/ports/team-memory-use.port';
import { MEMORY_CONTROLLERS, MEMORY_PROVIDERS } from '@memory/memory.wiring';
import { Module } from '@nestjs/common';
import { contextBindings } from '@platform/bindings/context-bindings';
import { MEMORIES_BRIEFED_BEFORE } from '@work/application/ports/memories-briefed-before.port';
import { TEAM_MEMORIES } from '@work/application/ports/team-memories.port';
import { WorkModule } from '@work/work.module';

const BINDINGS = contextBindings([TEAM_MEMORIES, MEMORIES_BRIEFED_BEFORE]);

@Module({
  imports: [IdentityModule, LinesModule, WorkModule],
  controllers: [...MEMORY_CONTROLLERS],
  providers: [...MEMORY_PROVIDERS, ...BINDINGS.exposed],
  exports: [TEAM_MEMORY_USE, ...BINDINGS.exposedTokens],
})
export class MemoryModule {}

@Module({
  imports: [MemoryModule],
  providers: [...BINDINGS.bound],
  exports: [...BINDINGS.tokens],
})
export class MemoryBindingsModule {}
