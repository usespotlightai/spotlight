import type { RunAgentDto } from '@work/application/dto/run-agent.dto';
import type { RunSpendDto } from '@work/application/dto/run-conversation.dto';
import type { RunJournalDto } from '@work/application/dto/run-journal.dto';
import type { TaskRunDto } from '@work/application/dto/task-run.dto';

export interface ReplayedRunDto {
  readonly runId: string;
  readonly taskId: string | null;
  readonly title: string | null;
}

export interface ReplayRunDto extends TaskRunDto {
  readonly original: ReplayedRunDto;
  readonly spend: RunSpendDto | null;
  readonly journals: readonly RunJournalDto[];
  readonly briefing: string;
  readonly agent: RunAgentDto;
  readonly repositories: readonly string[];
}
