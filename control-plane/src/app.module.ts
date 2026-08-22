import { CreateWorkspaceCommand } from '@application/commands/create-workspace.command';
import { CreateWorkspaceHandler } from '@application/commands/handlers/create-workspace.handler';
import { ID_GENERATOR } from '@application/ports/id-generator.port';
import { WORKSPACE_READER } from '@application/ports/workspace-reader.port';
import { GetGreetingQuery } from '@application/queries/get-greeting.query';
import { GetWorkspaceQuery } from '@application/queries/get-workspace.query';
import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';
import { GetWorkspaceHandler } from '@application/queries/handlers/get-workspace.handler';
import { ListWorkspacesHandler } from '@application/queries/handlers/list-workspaces.handler';
import { ListWorkspacesQuery } from '@application/queries/list-workspaces.query';
import { AuthenticationModule } from '@infrastructure/auth/auth.module';
import { ConfigModule } from '@infrastructure/config/config.module';
import { bindCommandHandler } from '@infrastructure/cqrs/bind-command-handler';
import { bindQueryHandler } from '@infrastructure/cqrs/bind-query-handler';
import { CryptoIdGenerator } from '@infrastructure/identity/crypto-id.generator';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { DrizzleWorkspaceReader } from '@infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleWorkspaceRepository } from '@infrastructure/persistence/drizzle/repositories/workspace.repository';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { GreetingController } from '@presentation/http/controllers/greeting.controller';
import { HealthController } from '@presentation/http/controllers/health.controller';
import { WorkspaceController } from '@presentation/http/controllers/workspace.controller';
import { ServerFaultFilter } from '@presentation/http/filters/server-fault.filter';
import { UseCaseFaultFilter } from '@presentation/http/filters/use-case-fault.filter';
import { AuthenticatedGuard } from '@presentation/http/guards/authenticated.guard';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    CqrsModule,
    DrizzleModule,
    AuthenticationModule,
  ],
  controllers: [GreetingController, HealthController, WorkspaceController],
  providers: [
    DrizzleWorkspaceRepository,
    { provide: WORKSPACE_READER, useClass: DrizzleWorkspaceReader },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },

    ...bindQueryHandler(GetGreetingQuery, GetGreetingHandler),
    ...bindQueryHandler(ListWorkspacesQuery, ListWorkspacesHandler, [
      WORKSPACE_READER,
    ]),
    ...bindQueryHandler(GetWorkspaceQuery, GetWorkspaceHandler, [
      WORKSPACE_READER,
    ]),
    ...bindCommandHandler(CreateWorkspaceCommand, CreateWorkspaceHandler, [
      DrizzleWorkspaceRepository,
      ID_GENERATOR,
    ]),

    { provide: APP_GUARD, useClass: AuthenticatedGuard },
    { provide: APP_FILTER, useClass: ServerFaultFilter },
    { provide: APP_FILTER, useClass: UseCaseFaultFilter },
  ],
})
export class AppModule {}
