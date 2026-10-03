import type { ChangeStack } from '@/lib/change-stack';

const UNNAMED = 'the repository';

export const repositoryOf = (stack: ChangeStack): string =>
  stack.repository ?? UNNAMED;
