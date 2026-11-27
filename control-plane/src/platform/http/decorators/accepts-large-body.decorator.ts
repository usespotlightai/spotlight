import { type CustomDecorator, SetMetadata } from '@nestjs/common';

export const ACCEPTS_LARGE_BODY = Symbol('ACCEPTS_LARGE_BODY');

export const AcceptsLargeBody = (): CustomDecorator<symbol> =>
  SetMetadata(ACCEPTS_LARGE_BODY, true);
