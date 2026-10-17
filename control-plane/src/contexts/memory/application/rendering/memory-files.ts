import type { MemoryFileDto } from '@memory/application/dto/memory-file.dto';
import type { TeamLine } from '@memory/application/ports/work.port';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { filesOf } from '@memory/domain/services/memory-folder';
import type { MemorySource } from '@memory/domain/value-objects/memory-source';

export interface MemoryFileContext {
  readonly lines: readonly TeamLine[];
  readonly replaced: ReadonlyMap<string, Memory>;
  readonly names: ReadonlyMap<string, string | null>;
}

const SOURCED: Record<MemorySource, string> = {
  run: 'a run',
  person: 'notes by a person',
  outside: 'a run on input from outside the team',
};

const day = (at: Date): string => at.toISOString().slice(0, 10);

const whereOf = (memory: Memory, lines: readonly TeamLine[]): string => {
  const { lineId, stationId, repository, paths } = memory.scope;
  const line = lines.find((each) => each.id === lineId);
  const station = line?.stations.find((each) => each.id === stationId);
  const at = station
    ? `${line?.name} › ${station.name}`
    : line
      ? line.name
      : 'the whole team';

  if (!repository) {
    return at;
  }

  return paths.length > 0
    ? `${at} · ${repository.value}: ${paths.map((each) => each.value).join(', ')}`
    : `${at} · ${repository.value}`;
};

const keptOf = (memory: Memory, context: MemoryFileContext): string => {
  const by = context.names.get(memory.approval.by.value) ?? 'someone';
  const on = day(memory.approval.at);

  return memory.grounds
    ? `from ${SOURCED[memory.source]} on task ${memory.grounds.taskId.value}, approved by ${by} on ${on}`
    : `written by ${by} on ${on}`;
};

const bodyOf = (memory: Memory, context: MemoryFileContext): string => {
  const replaced = memory.supersedes
    ? context.replaced.get(memory.supersedes.value)
    : undefined;

  return [
    `# ${memory.handle.value} · ${memory.kind.replaceAll('-', ' ')}`,
    '',
    memory.body.value,
    '',
    `- Applies to: ${whereOf(memory, context.lines)}`,
    `- Kept: ${keptOf(memory, context)}`,
    ...(replaced
      ? [
          `- Replaced ${replaced.handle.value}, which said: ${replaced.body.value.replace(/\s+/g, ' ').trim()}`,
        ]
      : []),
    ...(memory.grounds
      ? [
          `- Read the task it came from with: spotlight trace --task ${memory.grounds.taskId.value}`,
        ]
      : []),
    '',
  ].join('\n');
};

export const memoryFilesOf = (
  memories: readonly Memory[],
  context: MemoryFileContext,
): MemoryFileDto[] =>
  memories.flatMap((memory) => {
    const body = bodyOf(memory, context);
    return filesOf(memory).map((path) => ({ path, body }));
  });
