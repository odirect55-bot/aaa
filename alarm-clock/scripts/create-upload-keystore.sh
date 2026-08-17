#!/usr/bin/env bash
#
# Creates the upload keystore used to sign release builds.
#
#   ./scripts/create-upload-keystore.sh
#
# The keystore and its passwords never enter the repository: the file is
# written to credentials/ (git-ignored) and the passwords are printed once for
# you to store in a password manager and in your CI secrets.
#
# Losing this key means you can no longer update the app on Google Play unless
# Play App Signing is enabled — back it up somewhere durable.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CREDENTIALS_DIR="${PROJECT_ROOT}/credentials"
KEYSTORE_PATH="${CREDENTIALS_DIR}/upload-keystore.jks"
KEY_ALIAS="${ALARMCLOCK_KEY_ALIAS:-upload}"
VALIDITY_DAYS=10950 # ~30 years; Play requires a key valid past 2033

if [[ -f "${KEYSTORE_PATH}" ]]; then
  echo "Refusing to overwrite an existing keystore at ${KEYSTORE_PATH}" >&2
  echo "Delete it first if you really mean to replace it (this invalidates the app's identity)." >&2
  exit 1
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool not found. Install a JDK (17 or newer) and try again." >&2
  exit 1
fi

mkdir -p "${CREDENTIALS_DIR}"

# Generate a strong password unless one was supplied.
if [[ -n "${ALARMCLOCK_KEYSTORE_PASSWORD:-}" ]]; then
  PASSWORD="${ALARMCLOCK_KEYSTORE_PASSWORD}"
else
  # `cut` consumes its whole input, so — unlike `head -c` — the pipeline cannot
  # die from SIGPIPE under `set -o pipefail`.
  PASSWORD="$(dd if=/dev/urandom bs=256 count=1 2>/dev/null | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-32)"
fi

keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore "${KEYSTORE_PATH}" \
  -alias "${KEY_ALIAS}" \
  -keyalg RSA \
  -keysize 4096 \
  -validity "${VALIDITY_DAYS}" \
  -storepass "${PASSWORD}" \
  -keypass "${PASSWORD}" \
  -dname "CN=Alarm Clock, OU=Mobile, O=Alarm Clock, L=, ST=, C=US" >/dev/null

chmod 600 "${KEYSTORE_PATH}"

cat <<EOF

Upload keystore created: ${KEYSTORE_PATH}

  alias:    ${KEY_ALIAS}
  password: ${PASSWORD}

Store the password now — it is not written to disk.

To build a signed release locally, add this to ~/.gradle/gradle.properties
(NOT to the repository):

  ALARMCLOCK_UPLOAD_STORE_FILE=${KEYSTORE_PATH}
  ALARMCLOCK_UPLOAD_STORE_PASSWORD=${PASSWORD}
  ALARMCLOCK_UPLOAD_KEY_ALIAS=${KEY_ALIAS}
  ALARMCLOCK_UPLOAD_KEY_PASSWORD=${PASSWORD}

For CI, set the same four values as ORG_GRADLE_PROJECT_* secrets and provide
the keystore as a base64 secret (see .github/workflows/alarm-clock-release.yml).

Fingerprints (needed when enrolling in Play App Signing):
EOF

keytool -list -v -keystore "${KEYSTORE_PATH}" -storepass "${PASSWORD}" -alias "${KEY_ALIAS}" |
  grep -E 'SHA1:|SHA256:' || true
