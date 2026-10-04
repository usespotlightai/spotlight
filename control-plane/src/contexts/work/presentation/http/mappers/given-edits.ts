export const givenEdits = (
  given: unknown,
): Readonly<Record<string, string>> | null =>
  Array.isArray(given) && given.length > 0
    ? Object.fromEntries(
        given.flatMap((each: unknown) =>
          typeof each === 'object' &&
          each !== null &&
          'name' in each &&
          'value' in each &&
          typeof each.name === 'string' &&
          typeof each.value === 'string'
            ? [[each.name, each.value]]
            : [],
        ),
      )
    : null;
