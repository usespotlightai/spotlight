import { SetMetadata } from '@nestjs/common';

export const ADMIN_ONLY = Symbol('ADMIN_ONLY');

export const AdminOnly = () => SetMetadata(ADMIN_ONLY, true);
