export const ENVIRONMENT_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const ENVIRONMENT_VARIABLE_NAME_RULE =
  'environment variable names must use letters, digits and underscores';

export const isEnvironmentVariableName = (name: string): boolean =>
  ENVIRONMENT_VARIABLE_NAME.test(name);
