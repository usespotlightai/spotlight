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

  const exposedOf = (token: symbol): symbol => {
    const exposed = exposedAs.get(token);

    if (exposed === undefined) {
      throw new Error('A token has no exposed binding');
    }

    return exposed;
  };

  return {
    tokens,
    exposed: tokens.map((token) => ({
      provide: exposedOf(token),
      useExisting: token,
    })),
    exposedTokens: [...exposedAs.values()],
    bound: tokens.map((token) => ({
      provide: token,
      useExisting: exposedOf(token),
    })),
  };
};
