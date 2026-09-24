import type { McpServerDto } from '@configuration/application/dto/harness-profile-resource.dto';
import type { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';

export const HarnessProfileMapper = {
  servers(settings: ProfileSettings): McpServerDto[] {
    return settings.mcpServers.map((server) => ({
      name: server.name,
      command: server.command,
      args: [...server.args],
      env: { ...server.env },
    }));
  },
};
