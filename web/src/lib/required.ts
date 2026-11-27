export const required = <T>(value: T | null | undefined): T => {
  if (value === undefined || value === null) {
    throw new Error('A required value is missing');
  }
  return value;
};
