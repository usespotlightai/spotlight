import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';
import { auth } from '@infrastructure/auth/auth';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GreetingController } from '@presentation/http/controllers/greeting.controller';
import { HealthController } from '@presentation/http/controllers/health.controller';
import { AuthModule } from '@thallesp/nestjs-better-auth';

@Module({
  imports: [CqrsModule, DrizzleModule, AuthModule.forRoot({ auth })],
  controllers: [GreetingController, HealthController],
  providers: [GetGreetingHandler],
})
export class AppModule {}
