import { BadRequestException } from '@nestjs/common';

const isFields = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const fieldsOf = (value: unknown): Record<string, unknown> =>
  isFields(value) ? value : {};

export const pushDiffInput = (
  value: unknown,
): { readonly diff: string; readonly base: string } => {
  const { diff, base } = fieldsOf(value);

  if (typeof diff !== 'string' || typeof base !== 'string') {
    throw new BadRequestException(
      'The body must contain a diff and a base as text.',
    );
  }

  return { diff, base };
};

export const pushDiffFailureInput = (value: unknown): string => {
  const { reason } = fieldsOf(value);

  if (typeof reason !== 'string') {
    throw new BadRequestException('The body must contain a reason as text.');
  }

  return reason;
};
