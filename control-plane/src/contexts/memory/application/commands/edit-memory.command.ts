import type { MemoryWriting } from '@memory/application/commands/write-memory.command';

export class EditMemoryCommand {
  constructor(
    readonly teamId: string,
    readonly memoryId: string,
    readonly viewerId: string,
    readonly writing: MemoryWriting,
  ) {}
}
