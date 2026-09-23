import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

interface RequestStore {
  requestId: string;
  userId?: string;
  sessionId?: string;
  operationSequence: number;
  reservations: Map<string, string>;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestStore>();

  run(requestId: string, next: () => void): void {
    this.storage.run({ requestId, operationSequence: 0, reservations: new Map() }, next);
  }

  authenticate(userId: string, sessionId: string): void {
    const store = this.storage.getStore();
    if (store) Object.assign(store, { userId, sessionId });
  }

  current(): Readonly<RequestStore> | undefined {
    return this.storage.getStore();
  }

  nextOperationId(provider: string, resource: string): string | null {
    const store = this.storage.getStore();
    // A request without an authenticated principal is still a meaningful
    // telemetry event: Sprint 4 must surface it as unattributed rather than
    // silently dropping potentially billable provider usage.  Calls made
    // outside any HTTP/request context continue to return null so startup and
    // isolated unit work are not mistaken for production traffic.
    if (!store) return null;
    store.operationSequence += 1;
    return `${store.requestId}:${store.operationSequence}:${provider}:${resource}`;
  }

  rememberReservation(resource: string, reservationId: string): void {
    this.storage.getStore()?.reservations.set(resource, reservationId);
  }

  reservationFor(resource: string): string | undefined {
    return this.storage.getStore()?.reservations.get(resource);
  }
}
