import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService, containsSensitiveAdministrativeText, type AuditContext } from '../admin-audit.service';
import type { AdminCapability, AdminIdentity } from '../admin-rbac';
import { CostCenterService } from '../costs/cost-center.service';
import { SystemHealthService } from '../infrastructure/system-health.service';
import type { AdminCopilotQueryDto } from './admin-copilot.dto';

const MEMORY_TTL_MS = 30 * 60 * 1_000;
const MAX_MEMORIES = 200;
const MAX_CODE_FILES = 400;
const MAX_CODE_FILE_BYTES = 256 * 1_024;
const MAX_CODE_RESULTS = 12;
const SOURCE_ROOTS = [
  ['apps', 'api', 'src'],
  ['apps', 'admin'],
  ['packages', 'shared'],
] as const;
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md']);
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.expo', 'coverage']);

type CopilotStatus =
  | 'AVAILABLE'
  | 'INSUFFICIENT_DATA'
  | 'UNKNOWN'
  | 'NOT_AVAILABLE'
  | 'NOT_CONFIGURED'
  | 'NOT_INSTRUMENTED'
  | 'ACCESS_DENIED'
  | 'REDACTED'
  | 'PROPOSAL_ONLY';

type CopilotTool =
  | 'health'
  | 'costs'
  | 'bugs'
  | 'incidents'
  | 'support'
  | 'users'
  | 'plans'
  | 'quotas'
  | 'subscriptions'
  | 'payments'
  | 'usage'
  | 'features'
  | 'settings'
  | 'audit'
  | 'code';

type CopilotSource = { kind: string; label: string; status: CopilotStatus };
type CopilotProposal = { status: 'HUMAN_CONFIRMATION_REQUIRED'; reason: string };
type CopilotTrace = {
  provider: 'NOT_CONFIGURED';
  model: string;
  costStatus: 'NOT_INSTRUMENTED';
  correlation: string;
};
type ToolResult = { source: CopilotSource; fact: string; status: CopilotStatus };
type ConversationMemory = { expiresAt: number; categories: string[]; lastUsedAt: number };

const TOOL_CAPABILITIES: Record<CopilotTool, readonly AdminCapability[]> = {
  health: ['infrastructure.read'],
  costs: ['costs.read'],
  bugs: ['bugs.read'],
  incidents: ['incidents.read'],
  support: ['support.read'],
  users: ['users.read'],
  plans: ['plans.read'],
  quotas: ['quotas.read'],
  subscriptions: ['subscriptions.read'],
  payments: ['payments.read'],
  usage: ['usage.read'],
  features: ['feature_flags.read'],
  settings: ['settings.read'],
  audit: ['audit.read'],
  // There is no general repository-read capability. Infrastructure access is
  // the narrow existing technical capability aligned with source diagnosis.
  code: ['infrastructure.read'],
};

/**
 * A bounded, evidence-only assistant facade. This service never dispatches a
 * provider request, invokes a shell, accepts SQL, edits source, or calls an
 * administrative mutation. Each selected tool is independently constrained by
 * the current admin's existing capabilities.
 */
@Injectable()
export class AdminCopilotService {
  private readonly memories = new Map<string, ConversationMemory>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly health: SystemHealthService,
    private readonly costs: CostCenterService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly config: ConfigService,
  ) {}

  capabilities(identity: AdminIdentity) {
    const availableTools = (Object.keys(TOOL_CAPABILITIES) as CopilotTool[])
      .filter((tool) => this.allowed(identity, tool));
    return {
      mode: 'READ_ANALYZE_EXPLAIN_RECOMMEND',
      readOnly: true,
      availableTools,
      unavailableTools: (Object.keys(TOOL_CAPABILITIES) as CopilotTool[])
        .filter((tool) => !availableTools.includes(tool)),
      actions: 'PROPOSAL_ONLY_WITH_FUTURE_RBAC_STEP_UP_AND_HUMAN_CONFIRMATION',
      model: this.configuredModel(),
      provider: 'NOT_CONFIGURED',
      costTrace: 'NOT_INSTRUMENTED_UNTIL_AN_EXPLICIT_PROVIDER_OPERATION_IS_AUTHORIZED',
      repositoryRead: availableTools.includes('code')
        ? (this.repositoryRoot() ? 'CONFIGURED_READ_ONLY_MOUNT_REQUIRED' : 'NOT_AVAILABLE')
        : 'ACCESS_DENIED',
    };
  }

  async query(input: AdminCopilotQueryDto, identity: AdminIdentity, context: AuditContext) {
    const conversationId = input.conversationId ?? `copilot_${randomUUID().replaceAll('-', '')}`;
    const correlation = `admin-copilot:${conversationId}`;
    const normalized = normalizeQuestion(input.query);
    const categories = classify(normalized);
    const actionRequested = isActionRequest(normalized);

    if (containsSensitiveAdministrativeText(input.query)) {
      const response = this.response(
        conversationId,
        correlation,
        'REDACTED',
        'Je ne traite pas de valeur sensible dans une conversation Copilot. Retirez toute clé, tout token, mot de passe, cookie ou code MFA puis posez une question descriptive.',
        [],
      );
      await this.auditQuery(context, conversationId, categories, input.query.length, response.status, [], true);
      return response;
    }

    this.remember(identity, context, conversationId, categories);
    const selected = selectTools(categories);
    const results: ToolResult[] = [];
    for (const tool of selected) {
      if (!this.allowed(identity, tool)) {
        results.push({
          source: { kind: tool, label: 'Restricted source', status: 'ACCESS_DENIED' },
          fact: '',
          status: 'ACCESS_DENIED',
        });
        continue;
      }
      results.push(await this.runTool(tool, normalized, identity));
    }

    const readableFacts = results.map((result) => result.fact).filter(Boolean);
    const status = responseStatus(results, actionRequested);
    const proposal = actionRequested ? this.actionProposal(identity) : undefined;
    const answer = this.answer(readableFacts, status, proposal);
    const response = this.response(conversationId, correlation, status, answer, results.map((result) => result.source), proposal);
    await this.auditQuery(context, conversationId, categories, input.query.length, status, selected, false);
    return response;
  }

  private response(
    conversationId: string,
    correlation: string,
    status: CopilotStatus,
    answer: string,
    sources: CopilotSource[],
    proposal?: CopilotProposal,
  ) {
    return {
      conversationId,
      answer: redact(answer),
      status,
      sources,
      ...(proposal ? { proposal } : {}),
      trace: this.trace(correlation),
    };
  }

  private trace(correlation: string): CopilotTrace {
    return {
      // The V1 deterministic read path does not make an LLM call. Returning
      // the configured model name only states configuration, never usage.
      provider: 'NOT_CONFIGURED',
      model: this.configuredModel(),
      costStatus: 'NOT_INSTRUMENTED',
      correlation,
    };
  }

  private configuredModel(): string {
    const model = this.config.get<string>('admin.copilotModel');
    return model && model.trim() ? model.trim().slice(0, 160) : 'NOT_CONFIGURED';
  }

  private repositoryRoot(): string | null {
    const root = process.env.ADMIN_COPILOT_REPOSITORY_ROOT?.trim();
    return root ? resolve(root) : null;
  }

  private allowed(identity: AdminIdentity, tool: CopilotTool): boolean {
    return TOOL_CAPABILITIES[tool].every((capability) => identity.capabilities.includes(capability));
  }

  private async runTool(tool: CopilotTool, question: string, identity: AdminIdentity): Promise<ToolResult> {
    try {
      switch (tool) {
        case 'health': return await this.healthSummary();
        case 'costs': return await this.costSummary();
        case 'bugs': return await this.bugSummary();
        case 'incidents': return await this.incidentSummary();
        case 'support': return await this.supportSummary();
        case 'users': return await this.userSummary(question, identity);
        case 'plans': return await this.planSummary();
        case 'quotas': return await this.quotaSummary();
        case 'subscriptions': return await this.subscriptionSummary();
        case 'payments': return await this.paymentSummary();
        case 'usage': return await this.usageSummary();
        case 'features': return this.featureSummary();
        case 'settings': return this.settingsSummary();
        case 'audit': return await this.auditSummary();
        case 'code': return await this.codeSummary(question);
      }
    } catch {
      // A read dependency error must be visible as unknown, without echoing a
      // raw database, filesystem, provider, or host error.
      return {
        source: { kind: tool, label: sourceLabel(tool), status: 'UNKNOWN' },
        fact: `${sourceLabel(tool)}: UNKNOWN — la source n'est pas disponible pour une lecture sûre.`,
        status: 'UNKNOWN',
      };
    }
  }

  private async healthSummary(): Promise<ToolResult> {
    const overview = await this.health.overview('now');
    const components = overview.components ?? [];
    const degraded = components
      .filter((component) => !['HEALTHY', 'NOT_AVAILABLE', 'NOT_INSTRUMENTED'].includes(component.status))
      .map((component) => component.key)
      .slice(0, 8);
    const overall = overview.overall.status;
    const status: CopilotStatus = overview.overall.dataStatus === 'NOT_INSTRUMENTED'
      ? 'NOT_INSTRUMENTED'
      : overall === 'UNKNOWN'
        ? 'UNKNOWN'
        : 'AVAILABLE';
    return {
      source: { kind: 'system_health', label: 'System Health', status },
      fact: degraded.length
        ? `System Health: ${overall}. Composants nécessitant une attention: ${degraded.join(', ')}.`
        : `System Health: ${overall}. Aucun composant dégradé n'a été retourné par le relevé courant.`,
      status,
    };
  }

  private async costSummary(): Promise<ToolResult> {
    const [overview, providers] = await Promise.all([
      this.costs.overview({ range: 'today' }),
      this.costs.providers({ range: 'today' }),
    ]);
    const data = asRecord(asRecord(overview).data);
    const cost = asRecord(data.cost);
    const providerRows = asRecord(asRecord(providers).data).items;
    const calls = asFiniteInteger(data.providerCalls);
    const costStatus = stringField(cost.costStatus, calls === 0 ? 'INSUFFICIENT_DATA' : 'UNKNOWN');
    const dataStatus = copilotCostStatus(costStatus);
    const providerCount = Array.isArray(providerRows) ? providerRows.length : 0;
    const costFact = safeCostFact(cost, costStatus);
    return {
      source: { kind: 'cost_center', label: 'Cost Center / provider ledger', status: dataStatus },
      fact: calls === null
        ? `Cost Center: ${costStatus}. Les appels provider et le coût ne sont pas disponibles dans la fenêtre demandée.`
        : `Cost Center aujourd'hui: ${calls} appel(s) provider observé(s), ${providerCount} regroupement(s) provider. Statut de coût: ${costStatus}.${costFact}`,
      status: dataStatus,
    };
  }

  private async bugSummary(): Promise<ToolResult> {
    const [count, recent] = await Promise.all([
      this.prisma.bugGroup.count({ where: { status: { notIn: ['resolved', 'wont_fix'] } } }),
      this.prisma.bugGroup.findMany({
        where: { status: { notIn: ['resolved', 'wont_fix'] } },
        orderBy: { lastSeen: 'desc' },
        take: 3,
        select: { status: true, severity: true },
      }),
    ]);
    return {
      source: { kind: 'bug_center', label: 'Bug Center', status: count ? 'AVAILABLE' : 'INSUFFICIENT_DATA' },
      fact: count
        ? `Bug Center: ${count} groupe(s) non résolu(s). Les 3 plus récents couvrent ${recent.map((row) => `${row.severity}/${row.status}`).join(', ')}.`
        : 'Bug Center: aucun groupe non résolu n’est disponible.',
      status: count ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
    };
  }

  private async incidentSummary(): Promise<ToolResult> {
    const [count, recent] = await Promise.all([
      this.prisma.incident.count({ where: { status: { not: 'resolved' } } }),
      this.prisma.incident.findMany({
        where: { status: { not: 'resolved' } },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { status: true, severity: true },
      }),
    ]);
    return {
      source: { kind: 'incident_center', label: 'Incident Center', status: count ? 'AVAILABLE' : 'INSUFFICIENT_DATA' },
      fact: count
        ? `Incident Center: ${count} incident(s) non résolu(s), dont les statuts récents sont ${recent.map((row) => `${row.severity}/${row.status}`).join(', ')}.`
        : 'Incident Center: aucun incident non résolu n’est disponible.',
      status: count ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
    };
  }

  private async supportSummary(): Promise<ToolResult> {
    const [open, total] = await Promise.all([
      this.prisma.supportCase.count({ where: { status: { notIn: ['resolved', 'closed'] } } }),
      this.prisma.supportCase.count(),
    ]);
    return {
      source: { kind: 'support_center', label: 'Support Center', status: total ? 'AVAILABLE' : 'INSUFFICIENT_DATA' },
      fact: total
        ? `Support Center: ${open} dossier(s) actif(s) sur ${total} dossier(s) conservés. Les contenus de rapports utilisateur restent UNTRUSTED et redacted.`
        : 'Support Center: aucun dossier n’est disponible.',
      status: total ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
    };
  }

  private async userSummary(question: string, identity: AdminIdentity): Promise<ToolResult> {
    const identifier = userIdentifier(question);
    if (!identifier) {
      return {
        source: { kind: 'users', label: 'Users / Quota Engine', status: 'NOT_AVAILABLE' },
        fact: 'Users / Quota Engine: fournissez un identifiant utilisateur opaque ou une adresse email exacte pour une recherche ciblée.',
        status: 'NOT_AVAILABLE',
      };
    }
    const user = identifier.kind === 'email'
      ? await this.prisma.user.findUnique({ where: { email: identifier.value }, select: userSelect })
      : await this.prisma.user.findUnique({ where: { id: identifier.value }, select: userSelect });
    if (!user) {
      return {
        source: { kind: 'users', label: 'Users / Quota Engine', status: 'NOT_AVAILABLE' },
        fact: 'Users / Quota Engine: aucun compte correspondant n’est disponible.',
        status: 'NOT_AVAILABLE',
      };
    }
    const cycle = user.quotaCycles[0];
    const states = cycle?.accounts.map((account) => `${account.resource}:${account.state}`).join(', ') || 'NOT_AVAILABLE';
    const passportRequested = matches(question, /\b(passport|onboarding)\b/);
    const passport = passportRequested
      ? identity.capabilities.includes('learner_profile.read')
        ? ` Passeport: ${user.onboardingProfile ? String(user.onboardingProfile.status).toUpperCase() : 'NOT_AVAILABLE'}.`
        : ' Passeport: ACCESS_DENIED.'
      : '';
    return {
      source: { kind: 'users', label: 'Users / Quota Engine', status: 'AVAILABLE' },
      fact: `Compte demandé: état ${String(user.accountStatus).toUpperCase()}, plan ${user.subscription?.plan.slug ?? 'NOT_AVAILABLE'}, abonnement ${user.subscription?.status ?? 'NOT_AVAILABLE'}, quota ${states}.${passport}`,
      status: 'AVAILABLE',
    };
  }

  private async planSummary(): Promise<ToolResult> {
    const plans = await this.prisma.plan.findMany({
      where: { slug: { in: ['free', 'pro', 'pro_max'] } },
      select: { slug: true, priceMonthly: true, priceYearly: true, currency: true },
      orderBy: { tier: 'asc' },
    });
    const labels = plans.map((plan) => `${plan.slug.toUpperCase()} ${formatMinor(plan.priceMonthly, plan.currency)}/mois, ${formatMinor(plan.priceYearly, plan.currency)}/an`).join('; ');
    return {
      source: { kind: 'plans', label: 'Plans catalog', status: plans.length ? 'AVAILABLE' : 'NOT_AVAILABLE' },
      fact: plans.length ? `Plans actifs lus depuis le catalogue: ${labels}.` : 'Plans: aucun plan public n’est disponible.',
      status: plans.length ? 'AVAILABLE' : 'NOT_AVAILABLE',
    };
  }

  private async quotaSummary(): Promise<ToolResult> {
    const grouped = await this.prisma.quotaAccount.groupBy({ by: ['state'], _count: { _all: true } });
    const labels = grouped.map((row) => `${row.state}:${row._count._all}`).join(', ');
    return {
      source: { kind: 'quota_engine', label: 'Quota Engine', status: grouped.length ? 'AVAILABLE' : 'INSUFFICIENT_DATA' },
      fact: grouped.length
        ? `Quota Engine: comptes groupés par état ${labels}. Les limites officielles non configurées restent NOT_CONFIGURED.`
        : 'Quota Engine: aucune donnée de compte de quota n’est disponible.',
      status: grouped.length ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
    };
  }

  private async subscriptionSummary(): Promise<ToolResult> {
    const grouped = await this.prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } });
    return {
      source: { kind: 'subscriptions', label: 'Subscriptions', status: grouped.length ? 'AVAILABLE' : 'INSUFFICIENT_DATA' },
      fact: grouped.length
        ? `Abonnements: ${grouped.map((row) => `${row.status}:${row._count._all}`).join(', ')}.`
        : 'Abonnements: aucune donnée disponible.',
      status: grouped.length ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
    };
  }

  private async paymentSummary(): Promise<ToolResult> {
    const grouped = await this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true } });
    return {
      source: { kind: 'payments', label: 'Payments / verified billing records', status: grouped.length ? 'AVAILABLE' : 'NOT_CONFIGURED' },
      fact: grouped.length
        ? `Paiements vérifiés: ${grouped.map((row) => `${row.status}:${row._count._all}`).join(', ')}. Les références provider restent redacted.`
        : 'Payments: NOT_CONFIGURED — aucun enregistrement de paiement vérifié n’est disponible.',
      status: grouped.length ? 'AVAILABLE' : 'NOT_CONFIGURED',
    };
  }

  private async usageSummary(): Promise<ToolResult> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const [operations, attempts] = await Promise.all([
      this.prisma.providerUsageOperation.count({ where: { startedAt: { gte: since } } }),
      this.prisma.providerUsageAttempt.count({ where: { startedAt: { gte: since } } }),
    ]);
    return {
      source: { kind: 'usage_ledger', label: 'Usage / provider ledger', status: attempts ? 'AVAILABLE' : 'INSUFFICIENT_DATA' },
      fact: attempts
        ? `Usage des dernières 24 h: ${operations} opération(s) et ${attempts} tentative(s) provider durablement enregistrées.`
        : 'Usage: aucune tentative provider durablement enregistrée sur les dernières 24 h.',
      status: attempts ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
    };
  }

  private featureSummary(): ToolResult {
    const flags = this.featureFlags.all();
    const enabled = Object.values(flags).filter((value) => value === true).length;
    return {
      source: { kind: 'feature_control', label: 'Feature Control', status: 'AVAILABLE' },
      fact: `Feature Control: ${enabled} flag(s) activé(s) sur ${Object.keys(flags).length}. Les flags sont environment-owned et ne sont pas mutables via Copilot.`,
      status: 'AVAILABLE',
    };
  }

  private settingsSummary(): ToolResult {
    return {
      source: { kind: 'settings', label: 'Non-secret configuration authorities', status: 'AVAILABLE' },
      fact: 'Settings: seules les autorités de configuration non secrètes sont lisibles. Les secrets runtime ne sont jamais exposés et aucune configuration n’est modifiable via Copilot.',
      status: 'AVAILABLE',
    };
  }

  private async auditSummary(): Promise<ToolResult> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const count = await this.prisma.auditLog.count({ where: { createdAt: { gte: since } } });
    return {
      source: { kind: 'audit_log', label: 'Audit Log', status: 'AVAILABLE' },
      fact: `Audit Log: ${count} événement(s) administratif(s) dans les dernières 24 h. Les détails sensibles ne sont pas retournés par Copilot.`,
      status: 'AVAILABLE',
    };
  }

  private async codeSummary(question: string): Promise<ToolResult> {
    const root = this.repositoryRoot();
    if (!root) {
      return {
        source: { kind: 'repository', label: 'Repository source mount', status: 'NOT_AVAILABLE' },
        fact: 'Repository source: NOT_AVAILABLE — aucun montage source en lecture seule n’est configuré pour ce runtime.',
        status: 'NOT_AVAILABLE',
      };
    }
    const terms = codeTerms(question);
    if (!terms.length) {
      return {
        source: { kind: 'repository', label: 'Repository source mount', status: 'NOT_AVAILABLE' },
        fact: 'Repository source: indiquez un module, une route, un symbole ou un terme technique à rechercher.',
        status: 'NOT_AVAILABLE',
      };
    }
    const results = await searchRepository(root, terms);
    return {
      source: { kind: 'repository', label: 'Repository source mount', status: results.length ? 'AVAILABLE' : 'NOT_AVAILABLE' },
      fact: results.length
        ? `Repository source: ${results.length} occurrence(s) sûre(s) trouvée(s): ${results.map((result) => `${result.path}:${result.line} ${result.preview}`).join(' | ')}`
        : 'Repository source: aucun emplacement correspondant n’a été trouvé dans les chemins source autorisés.',
      status: results.length ? 'AVAILABLE' : 'NOT_AVAILABLE',
    };
  }

  private actionProposal(identity: AdminIdentity): CopilotProposal {
    const hasManage = identity.capabilities.some((capability) => capability.endsWith('.manage') || capability.endsWith('.adjust'));
    return {
      status: 'HUMAN_CONFIRMATION_REQUIRED',
      reason: hasManage
        ? 'Le Copilot est en lecture seule. Toute action doit passer par la route Admin officielle, avec confirmation humaine, RBAC et step-up MFA lorsque requis.'
        : 'Le Copilot est en lecture seule et votre rôle ne possède pas nécessairement la capacité métier demandée. Aucune action n’est exécutée.',
    };
  }

  private answer(facts: string[], status: CopilotStatus, proposal?: CopilotProposal): string {
    const body = facts.length
      ? facts.join('\n')
      : status === 'ACCESS_DENIED'
        ? 'Aucune source autorisée n’est disponible pour votre rôle actuel.'
        : 'NOT_AVAILABLE — aucune source vérifiable n’a été sélectionnée pour cette question. Précisez le domaine (santé, coût, bug, utilisateur, plan ou module).';
    return proposal ? `${body}\n${proposal.reason}` : body;
  }

  private remember(identity: AdminIdentity, context: AuditContext, conversationId: string, categories: string[]): void {
    const now = Date.now();
    for (const [key, memory] of this.memories) {
      if (memory.expiresAt <= now) this.memories.delete(key);
    }
    if (this.memories.size >= MAX_MEMORIES) {
      const oldest = [...this.memories.entries()].sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt)[0];
      if (oldest) this.memories.delete(oldest[0]);
    }
    const key = `${identity.userId}:${context.sessionId ?? 'no-session'}:${conversationId}`;
    // Keep classifications only—not prompts, evidence, credentials or an
    // authorization decision. A conversation can never confer future rights.
    this.memories.set(key, { categories: [...categories].slice(0, 8), lastUsedAt: now, expiresAt: now + MEMORY_TTL_MS });
  }

  private async auditQuery(
    context: AuditContext,
    conversationId: string,
    categories: string[],
    queryLength: number,
    result: CopilotStatus,
    tools: CopilotTool[],
    sensitiveInput: boolean,
  ): Promise<void> {
    try {
      await this.audit.record(context, {
        action: 'admin.copilot.query',
        targetType: 'AdminCopilotConversation',
        targetId: conversationId,
        result: result.toLowerCase(),
        metadata: {
          source: 'ADMIN_COPILOT',
          categories,
          tools,
          queryLength,
          sensitiveInput,
          // Never persist query text, source records, tokens, or model output.
          promptStored: false,
          mode: 'READ_ANALYZE_EXPLAIN_RECOMMEND',
        },
      });
    } catch {
      // No audit means no response. This is a read-only product surface, so a
      // fail-closed response is preferable to presenting untraceable evidence.
      throw new ServiceUnavailableException({ code: 'ADMIN_COPILOT_AUDIT_UNAVAILABLE' });
    }
  }
}

const userSelect = {
  accountStatus: true,
  subscription: { select: { status: true, plan: { select: { slug: true } } } },
  onboardingProfile: { select: { status: true } },
  quotaCycles: {
    where: { status: 'ACTIVE' },
    orderBy: { endsAt: 'desc' as const },
    take: 1,
    select: { accounts: { select: { resource: true, state: true } } },
  },
} as const;

function normalizeQuestion(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function classify(question: string): string[] {
  const categories = new Set<string>();
  if (matches(question, /\b(service|services|sant[ée]|health|degrad|qdrant|redis|postgres|database|deploy|version)\b/)) categories.add('health');
  if (matches(question, /\b(cost|co[uû]t|openai|provider|model|token|ledger|pricing|tarif)\b/)) categories.add('costs');
  if (matches(question, /\b(bug|erreur|error|diagnostic|rapport|report)\b/)) categories.add('bugs');
  if (matches(question, /\b(incident|outage)\b/)) categories.add('incidents');
  if (matches(question, /\b(support|case|dossier)\b/)) categories.add('support');
  if (matches(question, /\b(user|utilisateur|learner|apprenant|account|compte|blocked|quota|passport)\b/)) categories.add('users');
  if (matches(question, /\b(plan|forfait|pricing|prix)\b/)) categories.add('plans');
  if (matches(question, /\b(quota|primary|fallback|blocked)\b/)) categories.add('quotas');
  if (matches(question, /\b(subscription|abonnement)\b/)) categories.add('subscriptions');
  if (matches(question, /\b(payment|paiement|billing|facture|invoice)\b/)) categories.add('payments');
  if (matches(question, /\b(usage|consommation|utilisation)\b/)) categories.add('usage');
  if (matches(question, /\b(feature|flag|fonctionnalit[ée])\b/)) categories.add('features');
  if (matches(question, /\b(setting|configuration|config)\b/)) categories.add('settings');
  if (matches(question, /\b(audit|trace|journal)\b/)) categories.add('audit');
  if (matches(question, /\b(code|repository|repo|module|route|api|fichier|file|r[èe]gle|rule|source)\b/)) categories.add('code');
  return [...categories];
}

function selectTools(categories: string[]): CopilotTool[] {
  const result = new Set<CopilotTool>();
  for (const category of categories) {
    if (category === 'health') result.add('health');
    if (category === 'costs') result.add('costs');
    if (category === 'bugs') result.add('bugs');
    if (category === 'incidents') result.add('incidents');
    if (category === 'support') result.add('support');
    if (category === 'users') result.add('users');
    if (category === 'plans') result.add('plans');
    if (category === 'quotas') result.add('quotas');
    if (category === 'subscriptions') result.add('subscriptions');
    if (category === 'payments') result.add('payments');
    if (category === 'usage') result.add('usage');
    if (category === 'features') result.add('features');
    if (category === 'settings') result.add('settings');
    if (category === 'audit') result.add('audit');
    if (category === 'code') result.add('code');
  }
  return [...result];
}

function isActionRequest(question: string): boolean {
  return matches(question, /\b(delete|supprim|drop|update|modif|change|suspend|ban|revoke|restart|red[ée]marr|deploy|d[ée]plo|fix|r[ée]pare|upgrade|downgrade|activate|d[ée]sactive)\b/);
}

function responseStatus(results: ToolResult[], actionRequested: boolean): CopilotStatus {
  if (results.length && results.every((result) => result.status === 'ACCESS_DENIED')) return 'ACCESS_DENIED';
  if (actionRequested) return 'PROPOSAL_ONLY';
  if (results.some((result) => result.status === 'AVAILABLE')) return 'AVAILABLE';
  if (results.some((result) => result.status === 'UNKNOWN')) return 'UNKNOWN';
  if (results.some((result) => result.status === 'NOT_INSTRUMENTED')) return 'NOT_INSTRUMENTED';
  if (results.some((result) => result.status === 'INSUFFICIENT_DATA')) return 'INSUFFICIENT_DATA';
  if (results.some((result) => result.status === 'ACCESS_DENIED')) return 'ACCESS_DENIED';
  return 'NOT_AVAILABLE';
}

function sourceLabel(tool: CopilotTool): string {
  return {
    health: 'System Health', costs: 'Cost Center', bugs: 'Bug Center', incidents: 'Incident Center', support: 'Support Center',
    users: 'Users', plans: 'Plans', quotas: 'Quota Engine', subscriptions: 'Subscriptions', payments: 'Payments',
    usage: 'Usage ledger', features: 'Feature Control', settings: 'Settings', audit: 'Audit Log', code: 'Repository source',
  }[tool];
}

function userIdentifier(question: string): { kind: 'email' | 'id'; value: string } | null {
  const email = question.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  if (email) return { kind: 'email', value: email.toLowerCase() };
  const id = question.match(/\b[cC][a-z0-9]{20,32}\b/)?.[0];
  return id ? { kind: 'id', value: id } : null;
}

function codeTerms(question: string): string[] {
  const ignored = new Set(['pourquoi', 'quelle', 'partie', 'du', 'de', 'la', 'le', 'les', 'this', 'that', 'with', 'code', 'repository', 'repo', 'module', 'route', 'api', 'fichier', 'file', 'source', 'gère', 'gere', 'rule', 'règle']);
  return [...new Set(question.match(/[a-z0-9_./-]{3,64}/gi) ?? [])]
    .map((term) => term.toLowerCase())
    .filter((term) => !ignored.has(term) && !term.includes('..') && !term.includes('\\'))
    .slice(0, 5);
}

async function searchRepository(root: string, terms: string[]): Promise<Array<{ path: string; line: number; preview: string }>> {
  const rootPath = await fs.realpath(root);
  const files: string[] = [];
  for (const segments of SOURCE_ROOTS) {
    const candidate = resolve(rootPath, ...segments);
    if (!inside(rootPath, candidate)) continue;
    await collectCodeFiles(rootPath, candidate, files);
  }
  const results: Array<{ path: string; line: number; preview: string }> = [];
  for (const file of files) {
    if (results.length >= MAX_CODE_RESULTS) break;
    const stats = await fs.stat(file).catch(() => null);
    if (!stats || !stats.isFile() || stats.size > MAX_CODE_FILE_BYTES) continue;
    const content = await fs.readFile(file, 'utf8').catch(() => '');
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length && results.length < MAX_CODE_RESULTS; index += 1) {
      const line = lines[index];
      const lowered = line.toLowerCase();
      if (terms.every((term) => lowered.includes(term)) || terms.some((term) => lowered.includes(term))) {
        results.push({
          path: relative(rootPath, file).split(sep).join('/'),
          line: index + 1,
          preview: redact(line.trim()).slice(0, 240),
        });
      }
    }
  }
  return results;
}

async function collectCodeFiles(root: string, directory: string, output: string[]): Promise<void> {
  if (output.length >= MAX_CODE_FILES || !inside(root, directory)) return;
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (output.length >= MAX_CODE_FILES) return;
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
    const candidate = resolve(directory, entry.name);
    if (!inside(root, candidate)) continue;
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) await collectCodeFiles(root, candidate, output);
      continue;
    }
    if (entry.isFile() && CODE_EXTENSIONS.has(extname(entry.name).toLowerCase()) && !entry.name.endsWith('.env')) {
      output.push(candidate);
    }
  }
}

function inside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === '' || (!path.startsWith('..') && !path.includes(`..${sep}`) && !resolve(root, path).startsWith(`${root}${sep}..`));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asFiniteInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

function copilotCostStatus(value: string): CopilotStatus {
  if (value === 'MEASURED' || value === 'ESTIMATED') return 'AVAILABLE';
  if (value === 'UNKNOWN') return 'UNKNOWN';
  if (value === 'NOT_INSTRUMENTED') return 'NOT_INSTRUMENTED';
  if (value === 'INSUFFICIENT_DATA') return 'INSUFFICIENT_DATA';
  return 'NOT_AVAILABLE';
}

function safeCostFact(cost: Record<string, unknown>, costStatus: string): string {
  if (costStatus === 'MEASURED' || costStatus === 'ESTIMATED') {
    const total = stringField(cost.knownUsd, '');
    return total ? ` Coût total USD: ${total} (${costStatus}).` : ` Coût total: ${costStatus}, valeur non disponible.`;
  }
  if (costStatus === 'UNKNOWN') {
    const subtotal = stringField(cost.knownSubtotalUsd, '');
    return subtotal
      ? ` Sous-total connu USD: ${subtotal}; ce n'est pas un total, le coût complet reste UNKNOWN.`
      : ' Le coût complet reste UNKNOWN; aucune valeur n’est substituée par $0.';
  }
  if (costStatus === 'NOT_INSTRUMENTED') return ' Le coût n’est pas instrumenté; aucune valeur n’est substituée par $0.';
  return '';
}

function formatMinor(value: number | null, currency: string): string {
  if (value === null) return 'NOT_CONFIGURED';
  return `${currency.toUpperCase()} ${(value / 100).toFixed(2)}`;
}

function matches(value: string, expression: RegExp): boolean {
  return expression.test(value);
}

function redact(value: string): string {
  return value
    .replace(/\b(?:sk|pk|whsec|rk)_[A-Za-z0-9_-]{8,}\b/gi, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/\b(?:password|passcode|secret|token|cookie|otp|totp|api[ _-]?key)\b\s*[:=]\s*[^\s,;]+/gi, '[REDACTED]')
    .replace(/\b[A-Za-z0-9_-]{48,}\b/g, '[REDACTED]');
}
