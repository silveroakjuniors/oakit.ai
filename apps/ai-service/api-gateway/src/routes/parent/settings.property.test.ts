import * as fc from 'fast-check';

type Settings = {
  notification_prefs?: any;
  calendar_sync?: boolean;
  assistant_reminders?: boolean;
  translation_settings?: any;
};

function mergeSettings(existing: Settings, incoming: Settings): Settings {
  return {
    notification_prefs: incoming.notification_prefs ?? existing.notification_prefs,
    calendar_sync: incoming.calendar_sync ?? existing.calendar_sync,
    assistant_reminders: incoming.assistant_reminders ?? existing.assistant_reminders,
    translation_settings: incoming.translation_settings ?? existing.translation_settings,
  };
}

describe('Parent settings upsert behavior', () => {
  it('PUT with partial payload preserves existing keys', () => {
    fc.assert(
      fc.property(
        fc.boolean(), fc.boolean(), fc.boolean(),
        (a, b, c) => {
          const existing: Settings = { calendar_sync: a, assistant_reminders: b };
          const incoming: Settings = { calendar_sync: c };
          const merged = mergeSettings(existing, incoming);
          // calendar_sync should be updated, assistant_reminders preserved
          if (merged.calendar_sync !== c) return false;
          if (merged.assistant_reminders !== b) return false;
          return true;
        }
      )
    );
  });
});
