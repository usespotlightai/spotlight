export const taskIdentifier = (teamKey: string, number: number): string =>
  `${teamKey.toUpperCase()}-${number}`;
