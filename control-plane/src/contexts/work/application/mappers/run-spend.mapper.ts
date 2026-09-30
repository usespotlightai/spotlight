import type { RunSpendDto } from '@work/application/dto/run-conversation.dto';
import type { RunDigest } from '@work/application/ports/run-digest-reader.port';

export const RunSpendMapper = {
  toDto(digest: RunDigest): RunSpendDto {
    return {
      cost: digest.cost?.amount ?? null,
      currency: digest.cost?.currency ?? null,
      inputTokens: digest.tokens.input,
      outputTokens: digest.tokens.output,
      cacheReadTokens: digest.tokens.cacheRead,
      cacheWriteTokens: digest.tokens.cacheWrite,
    };
  },
};
