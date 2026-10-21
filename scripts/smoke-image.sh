#!/usr/bin/env bash
set -euo pipefail

container="qmt-validation-${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}"
docker run --rm --entrypoint node qmt:validation --check scripts/budget-guard.cjs
cleanup() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    docker logs "$container" || echo "::error::Container logs unavailable for $container"
  fi
  if ! docker rm --force "$container" >/dev/null; then
    echo "::error::Could not remove validation container $container"
    if [ "$status" -eq 0 ]; then status=1; fi
  fi
  exit "$status"
}
trap cleanup EXIT
docker run --detach --name "$container" --cpus 0.25 --memory 512m \
  --publish 127.0.0.1:8080:3000 \
  --env JWT_SECRET=synthetic-ci-runtime-secret-not-a-production-credential qmt:validation
curl --fail --silent --show-error --retry 15 --retry-delay 2 --retry-all-errors \
  --retry-max-time 45 --connect-timeout 2 --max-time 5 \
  --output "$RUNNER_TEMP/qmt-health.json" http://127.0.0.1:8080/api/health
node -e "if(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).ok!==true)process.exit(1)" "$RUNNER_TEMP/qmt-health.json"
test "$(docker exec "$container" id -u)" -ne 0
curl --fail --silent --show-error http://127.0.0.1:8080/ | grep 'id="root"'
curl --fail --silent --show-error http://127.0.0.1:8080/api/capabilities | \
  node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const c=JSON.parse(s);if(c.ai!==false||c.spond!==false)process.exit(1)})"
