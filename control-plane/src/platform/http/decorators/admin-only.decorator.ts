import { type CustomDecorator, SetMetadata } from '@nestjs/common';

export const ADMIN_ONLY = Symbol('ADMIN_ONLY');

export const AdminOnly = (): CustomDecorator<symbol> =>
  SetMetadata(ADMIN_ONLY, true);
