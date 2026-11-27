const settled = <T>(found: T | null | undefined | false): found is T =>
  Boolean(found);

export const eventually = async <T>(
  check: () => Promise<T | null | undefined | false>,
  within = 15_000,
): Promise<T> => {
  const deadline = Date.now() + within;

  for (;;) {
    const found = await check();

    if (settled(found)) {
      return found;
    }

    if (Date.now() > deadline) {
      throw new Error('it never happened');
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};
