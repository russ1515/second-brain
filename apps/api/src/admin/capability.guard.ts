import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_CAPABILITIES_KEY, type AdminCapability, type AdminIdentity } from './admin-rbac';

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminCapability[]>(ADMIN_CAPABILITIES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    const req = context.switchToHttp().getRequest<{ adminIdentity?: AdminIdentity }>();
    if (!req.adminIdentity || required.some((capability) => !req.adminIdentity?.capabilities.includes(capability))) {
      throw new ForbiddenException({ code: 'ADMIN_CAPABILITY_DENIED', required });
    }
    return true;
  }
}
