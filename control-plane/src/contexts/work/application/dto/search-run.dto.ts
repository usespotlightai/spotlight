import type { RunAgentDto } from '@work/application/dto/run-agent.dto';
import type { RunJournalDto } from '@work/application/dto/run-journal.dto';
import type { RunSpendDto } from '@work/application/dto/run-notes.dto';
import type { TaskRunDto } from '@work/application/dto/task-run.dto';

export interface SearchRunSpentDto {
  readonly spentCosts: readonly {
    readonly amount: number;
    readonly currency: string;
  }[];
  readonly unpricedCalls: number;
}

export interface SearchRunDto extends TaskRunDto {
  readonly searchId: string;
  readonly iteration: number;
  readonly agent: RunAgentDto | null;
  readonly failure: string | null;
  readonly endedAt: string | null;
  readonly spent: SearchRunSpentDto;
  readonly spend: RunSpendDto | null;
  readonly journals: readonly RunJournalDto[];
  readonly briefing: string;
}
