import { applyDecorators, Controller } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminOnly } from '@platform/http/decorators/admin-only.decorator';
import { ADMIN } from '@platform/http/routes';

// A controller of the admin API, under /api/admin, for the admin token only.
export const AdminController = (path: string) =>
  applyDecorators(
    ApiTags('admin'),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description:
        'The request does not have the admin token (SPOTLIGHT_ADMIN_TOKEN) as its bearer token',
    }),
    AdminOnly(),
    Controller(`${ADMIN}/${path}`),
  );
