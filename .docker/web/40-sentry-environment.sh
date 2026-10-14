#!/bin/sh
set -eu

printf 'window.SENTRY_ENVIRONMENT = "%s";\n' "${SENTRY_ENVIRONMENT:-production}" > /usr/share/nginx/html/env.js
