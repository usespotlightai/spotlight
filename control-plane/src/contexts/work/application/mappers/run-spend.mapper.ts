import type { RunSpendDto } from '@work/application/dto/run-conversation.dto';
import type { RunUsage } from '@work/application/ports/run-usage-reader.port';

export const RunSpendMapper = {
  toDto(usage: RunUsage): RunSpendDto {
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
