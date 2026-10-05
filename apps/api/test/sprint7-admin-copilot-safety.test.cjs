const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const apiRoot = path.resolve(__dirname, '..');
const serviceSource = read('src/admin/copilot/admin-copilot.service.ts');
const controllerSource = read('src/admin/copilot/admin-copilot.controller.ts');
const dtoSource = read('src/admin/copilot/admin-copilot.dto.ts');
const providerGateSource = fs.readFileSync(path.resolve(apiRoot, '../../scripts/admin-copilot-provider-gate-client.cjs'), 'utf8');
const verificationClientSource = fs.readFileSync(path.resolve(apiRoot, '../../scripts/admin-copilot-cost-trace-verify-client.cjs'), 'utf8');
const verificationComposeSource = fs.readFileSync(path.resolve(apiRoot, '../../scripts/compose.admin-copilot-cost-trace-verify.yml'), 'utf8');

function read(relativePath) {
  return fs.readFileSync(path.join(apiRoot, relativePath), 'utf8');
}

test('Admin Copilot exposes only authenticated bounded read routes', () => {
  assert.match(controllerSource, /@UseGuards\(JwtAccessGuard, AdminGuard, CapabilityGuard\)/u);
  assert.match(controllerSource, /@RequireAdminCapabilities\('dashboard\.read'\)/u);
  assert.match(controllerSource, /@Get\('capabilities'\)/u);
  assert.match(controllerSource, /@Post\('query'\)/u);
  assert.doesNotMatch(controllerSource, /@(Put|Patch|Delete)\(/u);
  assert.doesNotMatch(controllerSource, /\b(Put|Patch|Delete),/u);
});

test('Admin Copilot bounds every selected tool by the current Admin capabilities', () => {
  assert.match(serviceSource, /const TOOL_CAPABILITIES: Record<CopilotTool, readonly AdminCapability\[\]> =/u);
  assert.match(
    serviceSource,
    /TOOL_CAPABILITIES\[tool\]\.every\(\(capability\) => identity\.capabilities\.includes\(capability\)\)/u,
  );
  assert.match(serviceSource, /if \(!this\.allowed\(identity, tool\)\) \{[\s\S]*?status: 'ACCESS_DENIED'[\s\S]*?continue;/u);
  assert.match(serviceSource, /status: 'HUMAN_CONFIRMATION_REQUIRED'/u);
  assert.match(serviceSource, /Toute action doit passer par la route Admin officielle/u);
});

test('Admin Copilot permits only the single-bounded metered provider seam, never direct provider access or mutation', () => {
  assert.match(serviceSource, /private readonly llm: LlmService/u);
  assert.match(serviceSource, /this\.providerGateEnabled\(\)/u);
  assert.match(serviceSource, /this\.llm\.generate\(/u);
  assert.match(serviceSource, /operation: 'admin-copilot'/u);
  assert.match(serviceSource, /selected\[0\] !== 'health'/u);
  assert.match(serviceSource, /this\.providerGateConsumed = true/u);
  assert.doesNotMatch(serviceSource, /\bOpenAIProvider\b|\bfetch\(|\baxios\b|\bchild_process\b|\bexec\(|\bspawn\(/u);
  assert.doesNotMatch(
    serviceSource,
    /this\.prisma(?:\.[A-Za-z][A-Za-z0-9_]*)?\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert|\$executeRaw|\$queryRaw|\$transaction)\s*\(/u,
  );
  assert.doesNotMatch(serviceSource, /fs\.(?:writeFile|appendFile|rm|unlink|rename|mkdir|chmod|chown|copyFile)\s*\(/u);
  assert.match(serviceSource, /provider: 'NOT_CONFIGURED'/u);
  assert.match(serviceSource, /costStatus: 'NOT_INSTRUMENTED'/u);
  assert.match(serviceSource, /this\.config\.get<string>\('admin\.copilotModel'\)/u);
  assert.match(controllerSource, /\['x-request-id'\]/u);
});

test('Admin Copilot redacts untrusted sensitive prompts and audits only safe metadata', () => {
  assert.match(dtoSource, /@MaxLength\(2_000\)/u);
  assert.match(serviceSource, /containsSensitiveAdministrativeText\(input\.query\)/u);
  assert.match(serviceSource, /Je ne traite pas de valeur sensible/u);
  assert.match(serviceSource, /source: 'ADMIN_COPILOT'/u);
  assert.match(serviceSource, /promptStored: false/u);
  assert.match(serviceSource, /queryLength,/u);
  assert.match(serviceSource, /Never persist query text, source records, tokens, or model output/u);
  assert.match(serviceSource, /function redact\(value: string\)/u);
});

test('Admin Copilot code lookup is confined to the read-only source mount allowlist', () => {
  assert.match(serviceSource, /ADMIN_COPILOT_REPOSITORY_ROOT/u);
  assert.match(serviceSource, /const SOURCE_ROOTS = \[[\s\S]*?\['apps', 'api', 'src'\],[\s\S]*?\['apps', 'admin'\],[\s\S]*?\['packages', 'shared'\]/u);
  assert.match(serviceSource, /entry\.isSymbolicLink\(\) \|\| entry\.name\.startsWith\('\.'\)/u);
  assert.match(serviceSource, /!entry\.name\.endsWith\('\.env'\)/u);
  assert.match(serviceSource, /if \(!inside\(root, candidate\)\) continue;/u);
  assert.match(serviceSource, /async function searchRepository\(root: string, terms: string\[\]\)/u);
  assert.match(serviceSource, /Keep classifications only—not prompts, evidence, credentials or an[\s\S]*?authorization decision/u);
});

test('Admin Copilot provider evidence joins its redacted audit safely and verification never invokes Copilot', () => {
  assert.match(providerGateSource, /targetType: 'AdminCopilotConversation', targetId: copilot\.conversationId/u);
  assert.match(providerGateSource, /requestId !== '\[REDACTED\]'/u);
  assert.match(providerGateSource, /promptStored !== false/u);
  assert.doesNotMatch(verificationClientSource, /request\('\/admin\/copilot\/query'/u);
  assert.match(verificationClientSource, /providerRequestsTriggered: 0/u);
  assert.match(verificationClientSource, /requestId !== '\[REDACTED\]'/u);
  assert.match(verificationComposeSource, /LLM_PROVIDER: echo/u);
  assert.match(verificationComposeSource, /OPENAI_API_KEY: ''/u);
});
