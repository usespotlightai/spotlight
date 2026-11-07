import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { BriefedTasksPort } from '@work/application/ports/briefed-tasks.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { RunFacts } from '@work/application/services/run-facts.service';
import { RunWorks } from '@work/application/services/run-works.service';
import { Runs } from '@work/application/services/runs.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export const runWorksOver = (
  runs: RunRepository,
  tasks: TaskRepository,
  chats: ChatRepository,
  lines: LineMapsPort,
  briefedTasks: BriefedTasksPort,
  clock: ClockPort,
): RunWorks => {
  const facts = new RunFacts(runs);

  return new RunWorks(
    facts,
    facts,
    new Runs(runs, { sha256: (text) => text }, clock),
    runs,
    tasks,
    chats,
    lines,
    briefedTasks,
    clock,
  );
};
