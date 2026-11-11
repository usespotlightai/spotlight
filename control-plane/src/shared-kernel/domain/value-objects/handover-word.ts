export const HANDOVER_TO_A_PERSON = 'review';

export const HANDOVER_TO_FINISH = 'done';

export const requestsAPerson = (next: string | null): boolean => {
  const word = (next ?? '').trim().toLowerCase();

  return word === '' || word === HANDOVER_TO_A_PERSON;
};
