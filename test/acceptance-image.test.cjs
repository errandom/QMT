const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main_qmt.yml'), 'utf8');
const smoke = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'smoke-image.sh'), 'utf8');
const publisher = workflow.slice(workflow.indexOf('  publish-acceptance-image:'));
const validation = workflow.slice(0, workflow.indexOf('  publish-acceptance-image:'));

test('image publication is a separate manual, branch-bound, exact-commit operation after validation', () => {
  assert.match(validation, /publish_acceptance_image:[\s\S]*?type: boolean\s+default: false/);
  assert.doesNotMatch(validation, /packages: write|docker push|azure\/login/);
  assert.match(publisher, /if: github\.event_name == 'workflow_dispatch' && inputs\.publish_acceptance_image && github\.ref == 'refs\/heads\/copilot\/qmt-cost-controlled-relaunch-20261021'/);
  assert.match(publisher, /needs: validate/);
  assert.match(publisher, /permissions:\s+contents: read\s+packages: write/);
  assert.match(publisher, /test "\$APPROVED_COMMIT" = "\$GITHUB_SHA"/);
  assert.doesNotMatch(publisher, /azure\/login|az deployment|az webapp|az group|:latest|secrets\./);
});

test('the published image is built and smoke-tested before push using the ephemeral job token', () => {
  assert.ok(publisher.indexOf('bash scripts/smoke-image.sh') < publisher.indexOf('docker push'));
  assert.match(publisher, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(publisher, /--password-stdin/);
  assert.match(publisher, /org\.opencontainers\.image\.revision=\$GITHUB_SHA/);
  assert.match(publisher, /image="ghcr\.io\/errandom\/qmt:acceptance-\$GITHUB_SHA"/);
  assert.match(publisher, /persist-credentials: false/);
  assert.match(publisher, /if: always\(\)\s+run: docker logout ghcr\.io/);
});

test('Azure image readiness requires an anonymous digest pull, not authenticated publication alone', () => {
  assert.match(publisher, /RepoDigests 0/);
  assert.match(publisher, /mkdir "\$RUNNER_TEMP\/qmt-anonymous-docker"/);
  assert.match(publisher, /docker --config "\$RUNNER_TEMP\/qmt-anonymous-docker" pull "\$IMAGE_DIGEST"/);
  assert.match(publisher, /Anonymous pull must pass before Azure provisioning/);
});

test('both jobs share bounded health, disabled-provider, non-root and exact-container cleanup checks', () => {
  assert.equal((workflow.match(/run: bash scripts\/smoke-image\.sh/g) || []).length, 2);
  assert.match(smoke, /set -euo pipefail/);
  assert.match(smoke, /--retry-all-errors/);
  assert.match(smoke, /--retry-max-time 45/);
  assert.match(smoke, /JSON\.parse[\s\S]*?\.ok!==true/);
  assert.match(smoke, /docker exec "\$container" id -u/);
  assert.match(smoke, /c\.ai!==false\|\|c\.spond!==false/);
  assert.match(smoke, /docker logs "\$container"/);
  assert.match(smoke, /docker rm --force "\$container"/);
  assert.match(smoke, /exit "\$status"/);
});
