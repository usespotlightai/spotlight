import { PAGE_LIMIT } from '@shared-kernel/application/dto/page.dto';

export interface PageRequest {
  readonly before: string | null;
  readonly limit: number;
}

export const FIRST_PAGE: PageRequest = { before: null, limit: PAGE_LIMIT };
