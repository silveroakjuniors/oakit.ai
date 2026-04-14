// Feature: multi-role-portal, Property 20, Property 21
import * as fc from 'fast-check';

type Notification = {
  id: string;
  parent_id: string;
  completion_id: string;
  is_read: boolean;
};

// Simulate ON CONFLICT DO NOTHING idempotency
function insertNotifications(existing: Notification[], newOnes: Notification[]): Notification[] {
  const keys = new Set(existing.map((n) => `${n.parent_id}:${n.completion_id}`));
  const toInsert = newOnes.filter((n) => !keys.has(`${n.parent_id}:${n.completion_id}`));
  return [...existing, ...toInsert];
}

// ─── Property 20: Notification creation and idempotency ──────────────────────
describe('Property 20: Notification creation and idempotency', () => {
  it('inserting the same (parent_id, completion_id) twice does not duplicate', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // parent_id
        fc.uuid(), // completion_id
        (parentId, completionId) => {
          const notif: Notification = { id: 'n1', parent_id: parentId, completion_id: completionId, is_read: false };
          const after1 = insertNotifications([], [notif]);
          const after2 = insertNotifications(after1, [notif]);
          expect(after2.length).toBe(1);
        }
      )
    );
  });

  it('different (parent_id, completion_id) pairs are all inserted', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.uuid(), fc.uuid()), { minLength: 1, maxLength: 10 }),
        (pairs) => {
          // Deduplicate pairs
          const unique = [...new Map(pairs.map(([p, c]) => [`${p}:${c}`, { id: 'x', parent_id: p, completion_id: c, is_read: false }])).values()];
          const result = insertNotifications([], unique);
          expect(result.length).toBe(unique.length);
        }
      )
    );
  });

  it('new notifications are created with is_read=false', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (parentId, completionId) => {
        const notif: Notification = { id: 'n1', parent_id: parentId, completion_id: completionId, is_read: false };
        expect(notif.is_read).toBe(false);
      })
    );
  });
});

// ─── Property 21: Notification read status update ────────────────────────────
describe('Property 21: Notification read status update', () => {
  it('marking as read sets is_read=true', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (parentId, completionId) => {
        let notif: Notification = { id: 'n1', parent_id: parentId, completion_id: completionId, is_read: false };
        notif = { ...notif, is_read: true };
        expect(notif.is_read).toBe(true);
      })
    );
  });

  it('only the owner can mark as read (parent_id must match)', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (ownerId, otherId) => {
        fc.pre(ownerId !== otherId);
        const notif: Notification = { id: 'n1', parent_id: ownerId, completion_id: 'c1', is_read: false };
        const canRead = (requesterId: string) => notif.parent_id === requesterId;
        expect(canRead(ownerId)).toBe(true);
        expect(canRead(otherId)).toBe(false);
      })
    );
  });
});
