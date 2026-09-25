export const eventually = async <T>(
  check: () => Promise<T | null | undefined | false>,
  within = 15_000,
): Promise<T> => {
  const deadline = Date.now() + within;

  for (;;) {
    const found = await check();

    if (found) {
      return found;
    }

    if (Date.now() > deadline) {
      throw new Error('it never happened');
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};
