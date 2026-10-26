import { SetMetadata } from '@nestjs/common';

export const ALLOW_BASIC_CREDENTIALS = Symbol('ALLOW_BASIC_CREDENTIALS');

export const AllowBasicCredentials = () =>
  SetMetadata(ALLOW_BASIC_CREDENTIALS, true);
