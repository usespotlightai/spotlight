import { SetMetadata } from '@nestjs/common';

export const ALLOW_ANONYMOUS = Symbol('ALLOW_ANONYMOUS');

export const AllowAnonymous = () => SetMetadata(ALLOW_ANONYMOUS, true);
