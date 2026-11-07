import { SetMetadata } from '@nestjs/common';

export const ACCEPTS_LARGE_BODY = Symbol('ACCEPTS_LARGE_BODY');

export const AcceptsLargeBody = () => SetMetadata(ACCEPTS_LARGE_BODY, true);
