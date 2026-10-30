import { IdentityModule } from '@identity/identity.module';
import { Module } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { ConnectEditorHandler } from '@runners/application/commands/handlers/connect-editor.handler';
import { ConnectEditorCommand } from '@runners/application/commands/sandbox-editor.commands';
import { EDITOR_ACCESS } from '@runners/application/ports/editor-access.port';
import {
  EDITOR_SANDBOXES,
  type EditorSandboxesPort,
} from '@runners/application/ports/editor-sandboxes.port';
import {
  SANDBOX_TUNNELS,
  type SandboxTunnelsPort,
} from '@runners/application/ports/sandbox-tunnels.port';
import { SandboxEditors } from '@runners/application/services/sandbox-editors.service';
import { SandboxEditorGateway } from '@runners/presentation/websocket/sandbox-editor.gateway';
import { RunnersModule } from '@runners/runners.module';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { WorkModule } from '@work/work.module';

@Module({
  imports: [IdentityModule, RunnersModule, WorkModule],
  providers: [
    {
      provide: SandboxEditors,
      inject: [EDITOR_SANDBOXES, SANDBOX_TUNNELS, CLOCK],
      useFactory: (
        sandboxes: EditorSandboxesPort,
        tunnels: SandboxTunnelsPort,
        clock: ClockPort,
      ) => new SandboxEditors(sandboxes, tunnels, clock),
    },
    ...bindCommandHandler(ConnectEditorCommand, ConnectEditorHandler, [
      EDITOR_ACCESS,
      EDITOR_SANDBOXES,
      ID_GENERATOR,
      CLOCK,
    ]),
    SandboxEditorGateway,
  ],
})
export class SandboxEditorsModule {}
