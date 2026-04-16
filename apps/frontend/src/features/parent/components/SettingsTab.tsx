'use client';
import { useState, useEffect } from 'react';
import { Shield, Bell, CalendarDays, Zap, Apple } from 'lucide-react';
import { apiPost, apiPut, apiDelete } from '@/lib/api';
import { useTranslation } from '../context';
import type { EmergencyContact, NotificationPreference, CalendarEvent, TranslationSettings } from '../types';

export default function SettingsTab({
  token, emergencyContacts, notificationPrefs, calendarEvents,
  calendarSyncEnabled, assistantReminders, translationSettings,
  onEmergencyContactsChange, onNotificationPrefsChange,
  onCalendarSyncChange, onAssistantRemindersChange, onTranslationSettingsChange,
}: {
  token: string;
  emergencyContacts: EmergencyContact[];
  notificationPrefs: NotificationPreference[];
  calendarEvents: CalendarEvent[];
  calendarSyncEnabled: boolean;
  assistantReminders: boolean;
  translationSettings: TranslationSettings;
  onEmergencyContactsChange: (contacts: EmergencyContact[]) => void;
  onNotificationPrefsChange: (prefs: NotificationPreference[]) => void;
  onCalendarSyncChange: (enabled: boolean) => void;
  onAssistantRemindersChange: (enabled: boolean) => void;
  onTranslationSettingsChange: (settings: TranslationSettings) => void;
}) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<'emergency' | 'notifications' | 'calendar' | 'translation'>('emergency');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPriority, setNewPriority] = useState<number>(2);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRelation, setEditRelation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPriority, setEditPriority] = useState<number>(2);
  const [editSaving, setEditSaving] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<NotificationPreference[]>(notificationPrefs);
  useEffect(() => setLocalPrefs(notificationPrefs), [notificationPrefs]);

  const languageNames: Record<string, string> = {
    en: 'English', hi: 'हिंदी (Hindi)', te: 'తెలుగు (Telugu)', ta: 'தமிழ் (Tamil)',
    kn: 'ಕನ್ನಡ (Kannada)', ml: 'മലയാളം (Malayalam)', gu: 'ગુજરાતી (Gujarati)',
    bn: 'বাংলা (Bengali)', mr: 'मराठी (Marathi)', pa: 'ਪੰਜਾਬੀ (Punjabi)',
  };

  const sections = [
    { id: 'emergency' as const, label: t('Emergency Contacts', 'Emergency Contacts'), icon: Shield },
    { id: 'notifications' as const, label: t('Notifications', 'Notifications'), icon: Bell },
    { id: 'calendar' as const, label: t('Calendar Integration', 'Calendar'), icon: CalendarDays },
    { id: 'translation' as const, label: t('Translation Settings', 'Translation'), icon: Zap },
  ];

  return (
    <div className="space-y-6">
      {/* Nav */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveSection(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeSection === id ? 'bg-emerald-100 text-emerald-700' : 'text-neutral-600 hover:bg-neutral-100'
              }`}>
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Emergency Contacts */}
      {activeSection === 'emergency' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-neutral-800">Emergency Contacts</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-600">Manage who the school should contact in an emergency.</p>
              <button onClick={() => setShowAddForm(s => !s)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-sm">
                {showAddForm ? 'Close' : 'Add contact'}
              </button>
            </div>
            {showAddForm && (
              <div className="p-4 border border-neutral-200 rounded-xl space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" className="p-2 border rounded-md text-sm" />
                  <input value={newRelation} onChange={e => setNewRelation(e.target.value)} placeholder="Relation" className="p-2 border rounded-md text-sm" />
                  <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone" className="p-2 border rounded-md text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-neutral-600">Priority</label>
                  <select value={String(newPriority)} onChange={e => setNewPriority(Number(e.target.value))} className="p-2 border rounded-md text-sm">
                    <option value="1">1 — Primary</option>
                    <option value="2">2 — Secondary</option>
                    <option value="3">3 — Other</option>
                  </select>
                  <div className="flex-1" />
                  <button disabled={creating} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-sm"
                    onClick={async () => {
                      if (!newName.trim() || !newPhone.trim()) return;
                      setCreating(true);
                      try {
                        const payload = { name: newName.trim(), relationship: newRelation.trim() || null, phone: newPhone.trim(), phone_type: null, is_primary: newPriority === 1 };
                        const created = await apiPost<any>('/api/v1/parent/emergency-contacts', payload, token);
                        const mapped: EmergencyContact = { id: created.id, name: created.name, relation: created.relationship || created.relation || '', phone: created.phone, priority: created.is_primary ? 1 : 2, available: true };
                        onEmergencyContactsChange([...emergencyContacts, mapped]);
                        setNewName(''); setNewRelation(''); setNewPhone(''); setNewPriority(2); setShowAddForm(false);
                      } catch (err) { console.error(err); alert('Failed to add contact'); }
                      finally { setCreating(false); }
                    }}>
                    {creating ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            )}
            {emergencyContacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl">
                {editingId === contact.id ? (
                  <div className="flex-1">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="p-2 border rounded-md text-sm" />
                      <input value={editRelation} onChange={e => setEditRelation(e.target.value)} className="p-2 border rounded-md text-sm" />
                      <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="p-2 border rounded-md text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={String(editPriority)} onChange={e => setEditPriority(Number(e.target.value))} className="p-2 border rounded-md text-sm">
                        <option value="1">1 — Primary</option>
                        <option value="2">2 — Secondary</option>
                        <option value="3">3 — Other</option>
                      </select>
                      <div className="flex-1" />
                      <button disabled={editSaving} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-sm mr-2"
                        onClick={async () => {
                          setEditSaving(true);
                          try {
                            const payload = { name: editName.trim(), relationship: editRelation.trim() || null, phone: editPhone.trim(), phone_type: null, is_primary: editPriority === 1 };
                            const updated = await apiPut<any>(`/api/v1/parent/emergency-contacts/${contact.id}`, payload, token);
                            const mapped: EmergencyContact = { id: updated.id, name: updated.name, relation: updated.relationship || updated.relation || '', phone: updated.phone, priority: updated.is_primary ? 1 : 2, available: true };
                            onEmergencyContactsChange(emergencyContacts.map(c => c.id === contact.id ? mapped : c));
                            setEditingId(null);
                          } catch (err) { console.error(err); alert('Failed to update contact'); }
                          finally { setEditSaving(false); }
                        }}>
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-neutral-100 rounded-xl text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${contact.available ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="font-semibold text-neutral-800">{contact.name}</div>
                        <div className="text-sm text-neutral-600">{contact.relation} • {contact.phone}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${contact.priority === 1 ? 'bg-red-100 text-red-700' : contact.priority === 2 ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100 text-neutral-700'}`}>
                        Priority {contact.priority}
                      </span>
                      <button onClick={() => { setEditingId(contact.id); setEditName(contact.name); setEditRelation(contact.relation); setEditPhone(contact.phone); setEditPriority(contact.priority || 2); }}
                        className="ml-2 text-sm text-emerald-700 px-3 py-1 rounded-md border border-emerald-100">Edit</button>
                      <button onClick={async () => {
                        if (!confirm('Delete this contact?')) return;
                        try {
                          await apiDelete(`/api/v1/parent/emergency-contacts/${contact.id}`, token);
                          onEmergencyContactsChange(emergencyContacts.filter(c => c.id !== contact.id));
                        } catch (err) { console.error(err); alert('Failed to delete'); }
                      }} className="ml-2 text-sm text-red-600 px-3 py-1 rounded-md border border-red-100">Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeSection === 'notifications' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-neutral-800">Notification Preferences</h2>
          </div>
          <div className="space-y-4">
            {localPrefs.map((pref, idx) => (
              <div key={pref.type} className="border border-neutral-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-neutral-800 capitalize">{pref.type}</p>
                    <p className="text-xs text-neutral-500">Frequency: {pref.frequency}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={pref.enabled} className="sr-only peer"
                      onChange={e => {
                        const updated = localPrefs.map((p, i) => i === idx ? { ...p, enabled: e.target.checked } : p);
                        setLocalPrefs(updated);
                        onNotificationPrefsChange(updated);
                      }} />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['push', 'sms', 'email'] as const).map(ch => (
                    <label key={ch} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={pref.channels.includes(ch)}
                        onChange={e => {
                          const channels = e.target.checked ? [...pref.channels, ch] : pref.channels.filter(c => c !== ch);
                          const updated = localPrefs.map((p, i) => i === idx ? { ...p, channels } : p);
                          setLocalPrefs(updated);
                          onNotificationPrefsChange(updated);
                        }} className="rounded" />
                      <span className="text-neutral-600 capitalize">{ch}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar — Premium Gate */}
      {activeSection === 'calendar' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <CalendarDays className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-neutral-800">Calendar Integration</h2>
            <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">✨ Premium</span>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50 p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-purple-900 mb-2">Coming Soon</h3>
            <p className="text-sm text-purple-700 mb-4 max-w-xs mx-auto">
              Sync school events, homework deadlines, and exams directly to your Google or Apple Calendar.
            </p>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-purple-200 text-sm text-purple-700">
                <Apple size={16} /> Apple Calendar
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-purple-200 text-sm text-purple-700">
                <CalendarDays size={16} /> Google Calendar
              </div>
            </div>
            <span className="inline-block px-4 py-1.5 bg-purple-200 text-purple-800 text-xs font-bold rounded-full">
              Premium Feature — Payment coming soon
            </span>
          </div>
        </div>
      )}

      {/* Translation — Live (local test) */}
      {activeSection === 'translation' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-neutral-800">Translation</h2>
            <span className="ml-2 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">🧪 Test Mode</span>
          </div>

          <div className="space-y-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl">
              <div>
                <p className="font-semibold text-neutral-800">Enable Translation</p>
                <p className="text-xs text-neutral-500">Translate app content to your language</p>
              </div>
              <button
                onClick={() => onTranslationSettingsChange({ ...translationSettings, enabled: !translationSettings.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${translationSettings.enabled ? 'bg-emerald-600' : 'bg-neutral-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${translationSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Language picker */}
            {translationSettings.enabled && (
              <div className="p-4 border border-neutral-200 rounded-xl">
                <p className="font-semibold text-neutral-800 mb-3">Select Language</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    // Indian languages — fully translated
                    { code: 'hi', label: 'हिंदी', sublabel: 'Hindi', available: true },
                    { code: 'te', label: 'తెలుగు', sublabel: 'Telugu', available: true },
                    { code: 'kn', label: 'ಕನ್ನಡ', sublabel: 'Kannada', available: true },
                    { code: 'ta', label: 'தமிழ்', sublabel: 'Tamil', available: true },
                    { code: 'ml', label: 'മലയാളം', sublabel: 'Malayalam', available: true },
                    { code: 'gu', label: 'ગુજરાતી', sublabel: 'Gujarati', available: true },
                    { code: 'mr', label: 'मराठी', sublabel: 'Marathi', available: true },
                    { code: 'bn', label: 'বাংলা', sublabel: 'Bengali', available: true },
                    { code: 'pa', label: 'ਪੰਜਾਬੀ', sublabel: 'Punjabi', available: true },
                    { code: 'ur', label: 'اردو', sublabel: 'Urdu', available: true },
                    // International
                    { code: 'ar', label: 'العربية', sublabel: 'Arabic', available: true },
                    { code: 'fr', label: 'Français', sublabel: 'French', available: true },
                    { code: 'es', label: 'Español', sublabel: 'Spanish', available: true },
                    // Default
                    { code: 'en', label: 'English', sublabel: 'Default', available: true },
                  ].map(lang => (
                    <button key={lang.code}
                      onClick={() => onTranslationSettingsChange({ ...translationSettings, targetLanguage: lang.code })}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        translationSettings.targetLanguage === lang.code
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}>
                      <span className="text-lg leading-none">{lang.label}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-800 truncate">{lang.sublabel}</p>
                        {translationSettings.targetLanguage === lang.code && <p className="text-[10px] text-emerald-600 font-medium">✓ Active</p>}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-neutral-400 mt-3">More languages powered by Google Gemini AI.</p>
              </div>
            )}

            {translationSettings.enabled && translationSettings.targetLanguage !== 'en' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm font-semibold text-emerald-800 mb-1">✅ Translation Active</p>
                <p className="text-xs text-emerald-700">Tab labels, settings, and key UI text are now translated. Dynamic content (homework text, teacher notes) will be translated in the full version.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
