#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf '\n[verify] Backend tests and bootable JAR\n'
(
  cd "$repo_root/server"
  ./gradlew test bootJar
)

printf '\n[verify] Frontend tests\n'
(
  cd "$repo_root/app"
  npm test
)

printf '\n[verify] Frontend production build\n'
(
  cd "$repo_root/app"
  npm run build
)

printf '\n[verify] All checks passed\n'
