import { BadRequestException } from '@nestjs/common';

// A date and a time, with seconds and a time zone, as ISO 8601 writes them.
const ISO_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

export const isoTimeOf = (field: string, raw: string): Date => {
  const time = new Date(raw);

  if (!ISO_TIME.test(raw) || Number.isNaN(time.getTime())) {
    throw new BadRequestException(
      `Sorry, ${field} must be an ISO 8601 time, such as 2027-01-01T00:00:00Z.`,
    );
  }

  return time;
};
