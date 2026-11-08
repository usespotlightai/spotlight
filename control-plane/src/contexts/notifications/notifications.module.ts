import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import {
  NOTIFICATIONS_CONTROLLERS,
  NOTIFICATIONS_PROVIDERS,
} from '@notifications/notifications.wiring';

@Module({
  imports: [IdentityModule],
  controllers: [...NOTIFICATIONS_CONTROLLERS],
  providers: [...NOTIFICATIONS_PROVIDERS],
})
export class NotificationsModule {}
