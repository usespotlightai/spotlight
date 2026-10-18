export const editsInput = (
  value: unknown,
): Readonly<Record<string, string>> | null =>
  Array.isArray(value) && value.length > 0
    ? Object.fromEntries(
        value.flatMap((each: unknown) =>
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
