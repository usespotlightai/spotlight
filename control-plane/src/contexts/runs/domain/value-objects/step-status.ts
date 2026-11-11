export const faulted = (status: string | null | undefined): boolean =>
  status === 'failed';
