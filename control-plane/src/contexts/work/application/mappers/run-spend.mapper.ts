import type { RunUsageFacts } from '@runs/application/ports/run-usage-reader.port';
import type { RunSpendDto } from '@work/application/dto/run-notes.dto';

export const RunSpendMapper = {
  toDto(usage: RunUsageFacts): RunSpendDto {
    return {
      cost: usage.cost?.amount ?? null,
      currency: usage.cost?.currency ?? null,
      inputTokens: usage.tokens.input,
      outputTokens: usage.tokens.output,
      cacheReadTokens: usage.tokens.cacheRead,
      cacheWriteTokens: usage.tokens.cacheWrite,
    };
  },
};
