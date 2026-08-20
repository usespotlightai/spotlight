import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GreetingController } from '@presentation/http/controllers/greeting.controller';

@Module({
  imports: [CqrsModule, DrizzleModule],
  controllers: [GreetingController],
  providers: [GetGreetingHandler],
})
export class AppModule {}
