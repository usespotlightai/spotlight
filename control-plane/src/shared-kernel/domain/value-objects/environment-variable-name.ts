const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const isEnvironmentVariableName = (name: string): boolean =>
  ENV_NAME.test(name);
