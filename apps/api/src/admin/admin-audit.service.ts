import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  actorId?: string; actorRole?: string; requestId?: string; sessionId?: string;
  ip?: string; userAgent?: string;
}

export interface AuditEvent {
  action: string; targetType?: string; targetId?: string; before?: unknown;
  after?: unknown; reason?: string; result?: string; metadata?: unknown;
}

const SECRET_KEYS = /password|secret|token|authorization|cookie|recovery|totp|api.?key/i;
const SECRET_VALUE = /\b(password|passcode|secret|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|totp|one[ _-]?time[ _-]?password|\botp\b|recovery[ _-]?code|\bcvv\b|card[ _-]?number)\b\s*(?:[:=]|is)\s*[^\s,;]+/gi;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
// Provider identifiers are not credentials, but they are payment/customer data and
// must not be copied into audit/security text.  Keep this list deliberately narrow
// and provider-shaped so normal administrative prose is not unexpectedly rejected.
const PROVIDER_VALUE = /\b(?:sk|pk|whsec|rk|pi|ch|sub|cus|in|evt|cs|pm|seti)_[A-Za-z0-9_]{8,}\b/gi;
const PAN_VALUE = /\b(?:\d[ -]?){13,19}\b/g;
const URL_VALUE = /\bhttps?:\/\/[^\s<>{}"']+/gi;
const OPAQUE_VALUE = /\b[A-Za-z0-9_-]{32,}\b/g;
const RAW_SENSITIVE_VALUE = /(?:\b(?:password|passcode|secret|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|totp|one[ _-]?time[ _-]?password|\botp\b|recovery[ _-]?code|\bcvv\b|card[ _-]?number)\b|\bBearer\s+[A-Za-z0-9._~+\/-]+=*|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b|\b(?:sk|pk|whsec|rk|pi|ch|sub|cus|in|evt|cs|pm|seti)_[A-Za-z0-9_]{8,}\b|\b(?:\d[ -]?){13,19}\b|\bhttps?:\/\/[^\s<>{}"']+|\b[A-Za-z0-9_-]{32,}\b)/i;

/** Reject this material before it can be persisted outside redacted audit data. */
export function containsSensitiveAdministrativeText(value: string | null | undefined): boolean {
  return Boolean(value && RAW_SENSITIVE_VALUE.test(value));
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(context: AuditContext, event: AuditEvent): Promise<unknown> {
    return this.prisma.auditLog.create({
      data: this.auditData(context, event),
    });
  }

  security(context: AuditContext, type: string, userId?: string, metadata?: unknown, severity = 'medium'): Promise<unknown> {
    return this.prisma.securityEvent.create({
      data: this.securityData(context, type, userId, metadata, severity),
    });
  }

  /** Data factories let a critical mutation write its audit/security records in
   * the very same Prisma transaction as the state change. */
  auditData(context: AuditContext, event: AuditEvent): Prisma.AuditLogCreateArgs['data'] {
    return {
      actorId: context.actorId ?? null, actorRole: context.actorRole ?? null,
      action: event.action, targetType: event.targetType ?? null, targetId: event.targetId ?? null,
      before: this.json(event.before), after: this.json(event.after), reason: this.text(event.reason),
      result: event.result ?? 'success', requestId: this.text(context.requestId),
      sessionId: context.sessionId ?? null, ip: context.ip ?? null,
      userAgent: this.text(context.userAgent), metadata: this.json(event.metadata),
    };
  }

  securityData(context: AuditContext, type: string, userId?: string, metadata?: unknown, severity = 'medium'): Prisma.SecurityEventCreateArgs['data'] {
    return {
      actorId: context.actorId ?? null, userId: userId ?? null, type, severity,
      requestId: this.text(context.requestId), sessionId: context.sessionId ?? null,
      ip: context.ip ?? null, userAgent: this.text(context.userAgent), metadata: this.json(metadata),
    };
  }

  private json(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return this.sanitize(value) as Prisma.InputJsonValue;
  }

  private sanitize(value: unknown): unknown {
    if (typeof value === 'string') return this.text(value);
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, SECRET_KEYS.test(key) ? '[REDACTED]' : this.sanitize(child)]));
    }
    return value;
  }

  private text(value: string | undefined): string | null {
    if (value === undefined) return null;
    return value
      .replace(SECRET_VALUE, '$1=[REDACTED]')
      .replace(BEARER_VALUE, 'Bearer [REDACTED]')
      .replace(JWT_VALUE, '[REDACTED]')
      .replace(PROVIDER_VALUE, '[REDACTED]')
      .replace(PAN_VALUE, '[REDACTED]')
      .replace(URL_VALUE, '[REDACTED_URL]')
      .replace(OPAQUE_VALUE, '[REDACTED]')
      .slice(0, 1_024);
  }
}
