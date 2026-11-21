export const RUNNER_VARIABLES: readonly string[] = [
  'ALL_PROXY',
  'COLORTERM',
  'CURL_CA_BUNDLE',
  'GIT_SSL_CAINFO',
  'HOME',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'LOGNAME',
  'NODE_EXTRA_CA_CERTS',
  'NODE_USE_ENV_PROXY',
  'NO_PROXY',
  'PATH',
  'REQUESTS_CA_BUNDLE',
  'SHELL',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'TERM',
  'USER',
];

export const RUNNER_VARIABLE_PREFIX = 'SPOTLIGHT_';

export const isRunnerVariable = (variable: string): boolean => {
  const upper = variable.toUpperCase();

  return (
    RUNNER_VARIABLES.includes(upper) || upper.startsWith(RUNNER_VARIABLE_PREFIX)
  );
};
