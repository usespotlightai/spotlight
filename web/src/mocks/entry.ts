export const entryOf = <T>(
  record: Readonly<Record<string, T>>,
  key: string,
): T | undefined => (Object.hasOwn(record, key) ? record[key] : undefined);
