import type { Provider } from '@nestjs/common';

export interface ContextBindings {
  readonly tokens: readonly symbol[];
  readonly exposed: readonly Provider[];
  readonly exposedTokens: readonly symbol[];
  readonly bound: readonly Provider[];
}

export const contextBindings = (tokens: readonly symbol[]): ContextBindings => {
  const exposedAs = new Map(
    tokens.map((token) => [token, Symbol(`bound ${token.description}`)]),
  );

  return {
    tokens,
    exposed: tokens.map((token) => ({
      provide: exposedAs.get(token) as symbol,
      useExisting: token,
    })),
    exposedTokens: [...exposedAs.values()],
    bound: tokens.map((token) => ({
      provide: token,
      useExisting: exposedAs.get(token) as symbol,
    })),
  };
};
