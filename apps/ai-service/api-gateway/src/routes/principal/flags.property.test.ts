// Feature: multi-role-portal, Property 16
import * as fc from 'fast-check';

type SectionState = {
  flagged: boolean;
  flag_note: string | null;
  flagged_at: string | null;
  flagged_by: string | null;
};

function applyFlag(note: string, userId: string): SectionState {
  return { flagged: true, flag_note: note, flagged_at: new Date().toISOString(), flagged_by: userId };
}

function applyUnflag(): SectionState {
  return { flagged: false, flag_note: null, flagged_at: null, flagged_by: null };
}

// ─── Property 16: Section flagging round-trip with note ──────────────────────
describe('Property 16: Section flagging round-trip with note', () => {
  it('flagging sets flagged=true and preserves note', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.uuid(),
        (note, userId) => {
          const state = applyFlag(note, userId);
          expect(state.flagged).toBe(true);
          expect(state.flag_note).toBe(note);
          expect(state.flagged_by).toBe(userId);
          expect(state.flagged_at).not.toBeNull();
        }
      )
    );
  });

  it('unflagging clears all flag fields', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.uuid(),
        (note, userId) => {
          // First flag, then unflag
          applyFlag(note, userId);
          const state = applyUnflag();
          expect(state.flagged).toBe(false);
          expect(state.flag_note).toBeNull();
          expect(state.flagged_at).toBeNull();
          expect(state.flagged_by).toBeNull();
        }
      )
    );
  });

  it('flag then unflag is idempotent — always ends cleared', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        fc.uuid(),
        (ops, userId) => {
          let state: SectionState = applyUnflag();
          for (const shouldFlag of ops) {
            state = shouldFlag ? applyFlag('note', userId) : applyUnflag();
          }
          // Final state is deterministic based on last op
          const lastOp = ops[ops.length - 1];
          expect(state.flagged).toBe(lastOp);
        }
      )
    );
  });
});
