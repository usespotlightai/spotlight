import { type CustomDecorator, SetMetadata } from '@nestjs/common';

export const ALLOW_BASIC_CREDENTIALS = Symbol('ALLOW_BASIC_CREDENTIALS');

export const AllowBasicCredentials = (): CustomDecorator<symbol> =>
  SetMetadata(ALLOW_BASIC_CREDENTIALS, true);
