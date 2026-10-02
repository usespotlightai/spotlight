import type { RunSpendDto } from '@work/application/dto/run-conversation.dto';
import type { RunJournalDto } from '@work/application/dto/run-journal.dto';
import type { TaskRunDto } from '@work/application/dto/task-run.dto';
import type { SearchAgentShape } from '@work/application/ports/search-agents.port';

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
  readonly agent: SearchAgentShape | null;
  readonly failure: string | null;
  readonly endedAt: string | null;
  readonly spent: SearchRunSpentDto;
  readonly spend: RunSpendDto | null;
  readonly journals: readonly RunJournalDto[];
}
