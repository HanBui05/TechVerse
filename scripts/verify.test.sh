#!/usr/bin/env bash
set -euo pipefail

repo_under_test="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT

mkdir -p "$fixture/scripts" "$fixture/server" "$fixture/app" "$fixture/bin"
cp "$repo_under_test/scripts/verify.sh" "$fixture/scripts/verify.sh"

cat > "$fixture/server/gradlew" <<'EOF'
#!/usr/bin/env bash
printf 'gradle:%s\n' "$*" >> "${VERIFY_TEST_LOG:?}"
EOF
chmod +x "$fixture/server/gradlew"

cat > "$fixture/bin/npm" <<'EOF'
#!/usr/bin/env bash
printf 'npm:%s:%s\n' "$(basename "$PWD")" "$*" >> "${VERIFY_TEST_LOG:?}"
EOF
chmod +x "$fixture/bin/npm"

export VERIFY_TEST_LOG="$fixture/calls.log"
PATH="$fixture/bin:$PATH" bash "$fixture/scripts/verify.sh"

expected=$'gradle:test bootJar\nnpm:app:test\nnpm:app:run build'
actual="$(cat "$VERIFY_TEST_LOG")"

if [[ "$actual" != "$expected" ]]; then
  printf 'Expected calls:\n%s\nActual calls:\n%s\n' "$expected" "$actual" >&2
  exit 1
fi

printf 'verify.sh dispatch test passed\n'
