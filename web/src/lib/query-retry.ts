import { sentRequestOf } from '@/lib/request-failure';

const UNREACHABLE_STATUSES = new Set([502, 503]);

const UNREACHABLE_RETRIES = 5;
const OTHER_RETRIES = 1;

export const retryQuery = (failures: number, thrown: unknown): boolean => {
  const sent = sentRequestOf(thrown);
  const unreachable =
    sent !== null &&
    (sent.status === null || UNREACHABLE_STATUSES.has(sent.status));

  return failures < (unreachable ? UNREACHABLE_RETRIES : OTHER_RETRIES);
};
