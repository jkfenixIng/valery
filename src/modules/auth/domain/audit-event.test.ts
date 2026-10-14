import { describe, expect, it } from 'vitest';

import { AuditEvent } from './audit-event';

describe('AuditEvent', () => {
  it('records an allowed authentication event without personal data', () => {
    const event = AuditEvent.create({
      eventType: 'auth.sign_in',
      outcome: 'blocked',
      subjectHash: 'a'.repeat(64),
      metadata: { reason: 'locked' },
    });

    expect(event.toRecord()).toMatchObject({
      eventType: 'auth.sign_in',
      outcome: 'blocked',
      actorUserId: null,
      metadata: { reason: 'locked' },
    });
  });

  it.each(['email', 'password', 'secret', 'code', 'ip', 'userAgent'])(
    'rejects %s metadata',
    (key) => {
      expect(() =>
        AuditEvent.create({
          eventType: 'auth.sign_in',
          outcome: 'failure',
          metadata: { [key]: 'not stored' },
        }),
      ).toThrow('Audit metadata contains a forbidden key.');
    },
  );

  it('records a pricing settings update attributed to its actor only', () => {
    const event = AuditEvent.create({
      eventType: 'pricing.settings.updated',
      outcome: 'success',
      actorUserId: 'admin-1',
    });

    expect(event.toRecord()).toEqual({
      eventType: 'pricing.settings.updated',
      outcome: 'success',
      actorUserId: 'admin-1',
      subjectHash: null,
      metadata: {},
    });
  });

  it.each(['hourlyRateCop', 'marginBps', 'value'])(
    'rejects pricing value %s in metadata',
    (key) => {
      expect(() =>
        AuditEvent.create({
          eventType: 'pricing.settings.updated',
          outcome: 'success',
          metadata: { [key]: 8000 },
        }),
      ).toThrow('Audit metadata contains a forbidden key.');
    },
  );

  it.each(['supply.created', 'supply.updated', 'supply.archived'] as const)(
    'records %s without supply details',
    (eventType) => {
      expect(
        AuditEvent.create({
          eventType,
          outcome: 'success',
          actorUserId: 'admin-1',
          metadata: { method: 'admin_supply_form' },
        }).toRecord(),
      ).toEqual({
        eventType,
        outcome: 'success',
        actorUserId: 'admin-1',
        subjectHash: null,
        metadata: { method: 'admin_supply_form' },
      });
    },
  );

  it.each(['name', 'unit', 'unitCostCop', 'supplyId'])(
    'rejects supply detail %s in metadata',
    (key) => {
      expect(() =>
        AuditEvent.create({
          eventType: 'supply.created',
          outcome: 'success',
          metadata: { [key]: 'not stored' },
        }),
      ).toThrow('Audit metadata contains a forbidden key.');
    },
  );

  it.each(['product.created', 'product.updated', 'product.archived'] as const)(
    'records %s with only the product form method',
    (eventType) => {
      expect(
        AuditEvent.create({
          eventType,
          outcome: 'success',
          actorUserId: 'admin-1',
          metadata: { method: 'admin_product_form' },
        }).toRecord(),
      ).toEqual({
        eventType,
        outcome: 'success',
        actorUserId: 'admin-1',
        subjectHash: null,
        metadata: { method: 'admin_product_form' },
      });
    },
  );

  it('rejects unknown event types', () => {
    expect(() =>
      AuditEvent.create({ eventType: 'auth.unknown', outcome: 'success' }),
    ).toThrow('Unknown audit event type.');
  });
});
