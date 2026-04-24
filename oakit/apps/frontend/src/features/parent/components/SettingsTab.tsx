'use client';
import { useState, useEffect } from 'react';
import { Shield, Bell, CalendarDays, Zap, Apple } from 'lucide-react';
import { apiPost, apiPut, apiDelete } from '@/lib/api';
import { useTranslation } from '../context';
import type { EmergencyContact, NotificationPreference, CalendarEvent, TranslationSettings } from '../types';

const G = { 900:'#3B2F8F', 700:'#5B4FCF', 600:'#7C6FE8', 500:'#A89FF0', 400:'#C8C2F8', 200:'#E8E5FF', 100:'#F3F1FF', 50:'#F8F7FF' };
const TEAL = '#2EC4B6';

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

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(16px)',
    boxShadow: '0 2px 4px rgba(80,60,180,0.06), 0 8px 24px rgba(80,60,180,0.08)',
    border: '1px solid rgba(255,255,255,0.7)',
    borderRadius: 16,
    padding: 24,
  };

  const inputStyle: React.CSSProperties = {
    background: G[100], border: `1.5px solid ${G[200]}`, borderRadius: 10,
    padding: '8px 12px', fontSize: 14, color: '#374151', outline: 'none', width: '100%',
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Nav */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div className="flex flex-wrap gap-2">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveSection(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: activeSection === id ? G[100] : 'transparent',
                color: activeSection === id ? G[700] : '#6B7280',
                border: `1px solid ${activeSection === id ? G[200] : 'transparent'}`,
              }}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Emergency Contacts */}
      {activeSection === 'emergency' && (
        <div style={cardStyle}>
          <div className="flex items-center gap-3 mb-5">
            <Shield className="w-5 h-5" style={{ color: '#E74C3C' }} />
            <h2 className="text-base font-bold" style={{ color: G[900] }}>Emergency Contacts</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: '#6B7280' }}>Manage who the school should contact in an emergency.</p>
              <button onClick={() => setShowAddForm(s => !s)}
                className="px-3 py-1.5 text-sm font-semibold rounded-xl text-white"
                style={{ background: G[900] }}>
                {showAddForm ? 'Close' : 'Add contact'}
              </button>
            </div>
            {showAddForm && (
              <div className="p-4 rounded-xl space-y-3" style={{ background: G[100], border: `1px solid ${G[200]}` }}>
                <div className="grid grid-cols-3 gap-2">
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" style={inputStyle} />
                  <input value={newRelation} onChange={e => setNewRelation(e.target.value)} placeholder="Relation" style={inputStyle} />
                  <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone" style={inputStyle} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm" style={{ color: G[600] }}>Priority</label>
                  <select value={String(newPriority)} onChange={e => setNewPriority(Number(e.target.value))} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="1">1 — Primary</option>
                    <option value="2">2 — Secondary</option>
                    <option value="3">3 — Other</option>
                  </select>
                  <div className="flex-1" />
                  <button disabled={creating}
                    className="px-3 py-1.5 text-sm font-semibold rounded-xl text-white disabled:opacity-50"
                    style={{ background: G[900] }}
                    onClick={async () => {
                      if (!newName.trim() || !newPhone.trim()) return;
                      setCreating(true);
                      try {
                        const payload = { name: newName.trim(), relationship: newRelation.trim() || null, phone: newPhone.trim(), phone_type: null, is_primary: newPriority === 1 };
                        const created = await apiPost<any>('/api/v1/parent/emergency-contacts', payload, token);
                        const mapped: EmergencyContact = { id: created.id, name: created.name, relation: created.relationship || created.relation || '', phone: created.phone, priority: created.is_primary ? 1 : 2, available: true };
                        onEmergencyContactsChange([...emergencyContacts, mapped]);
                        setNewName(''); setNewRelation(''); setNewPhone(''); setNewPriority(2); setShowAddForm(false);
                      } catch { alert('Failed to add contact'); }
                      finally { setCreating(false); }
                    }}>
                    {creating ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            )}
            {emergencyContacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: G[50], border: `1px solid ${G[200]}` }}>
                {editingId === contact.id ? (
                  <div className="flex-1">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
                      <input value={editRelation} onChange={e => setEditRelation(e.target.value)} style={inputStyle} />
                      <input value={editPhone} onChange={e => setEditPhone(e.target.value)} style={inputStyle} />
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={String(editPriority)} onChange={e => setEditPriority(Number(e.target.value))} style={{ ...inputStyle, width: 'auto' }}>
                        <option value="1">1 — Primary</option>
                        <option value="2">2 — Secondary</option>
                        <option value="3">3 — Other</option>
                      </select>
                      <div className="flex-1" />
                      <button disabled={editSaving}
                        className="px-3 py-1.5 text-sm font-semibold rounded-xl text-white mr-2 disabled:opacity-50"
                        style={{ background: G[900] }}
                        onClick={async () => {
                          setEditSaving(true);
                          try {
                            const payload = { name: editName.trim(), relationship: editRelation.trim() || null, phone: editPhone.trim(), phone_type: null, is_primary: editPriority === 1 };
                            const updated = await apiPut<any>(`/api/v1/parent/emergency-contacts/${contact.id}`, payload, token);
                            const mapped: EmergencyContact = { id: updated.id, name: updated.name, relation: updated.relationship || updated.relation || '', phone: updated.phone, priority: updated.is_primary ? 1 : 2, available: true };
                            onEmergencyContactsChange(emergencyContacts.map(c => c.id === contact.id ? mapped : c));
                            setEditingId(null);
                          } catch { alert('Failed to update contact'); }
                          finally { setEditSaving(false); }
                        }}>
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-sm rounded-xl"
                        style={{ background: G[100], color: G[600], border: `1px solid ${G[200]}` }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                        style={{ background: G[900] }}>{contact.name[0]}</div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: G[900] }}>{contact.name}</p>
                        <p className="text-xs" style={{ color: '#6B5C4A' }}>{contact.relation} · {contact.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: contact.priority === 1 ? '#FEE2E2' : contact.priority === 2 ? '#FEF3C7' : G[100], color: contact.priority === 1 ? '#C0392B' : contact.priority === 2 ? '#D97706' : G[600] }}>
                        P{contact.priority}
                      </span>
                      <button onClick={() => { setEditingId(contact.id); setEditName(contact.name); setEditRelation(contact.relation); setEditPhone(contact.phone); setEditPriority(contact.priority || 2); }}
                        className="text-xs px-3 py-1 rounded-xl"
                        style={{ background: G[100], color: G[700], border: `1px solid ${G[200]}` }}>Edit</button>
                      <button onClick={async () => {
                        if (!confirm('Delete this contact?')) return;
                        try {
                          await apiDelete(`/api/v1/parent/emergency-contacts/${contact.id}`, token);
                          onEmergencyContactsChange(emergencyContacts.filter(c => c.id !== contact.id));
                        } catch { alert('Failed to delete'); }
                      }} className="text-xs px-3 py-1 rounded-xl"
                        style={{ background: '#FEE2E2', color: '#C0392B', border: '1px solid #FECACA' }}>Delete</button>
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
        <div style={cardStyle}>
          <div className="flex items-center gap-3 mb-5">
            <Bell className="w-5 h-5" style={{ color: G[600] }} />
            <h2 className="text-base font-bold" style={{ color: G[900] }}>Notification Preferences</h2>
          </div>
          <div className="space-y-3">
            {localPrefs.map((pref, idx) => (
              <div key={pref.type} className="rounded-xl p-4" style={{ background: G[50], border: `1px solid ${G[200]}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm capitalize" style={{ color: G[900] }}>{pref.type}</p>
                    <p className="text-xs" style={{ color: '#6B5C4A' }}>Frequency: {pref.frequency}</p>
                  </div>
                  <button onClick={() => {
                    const updated = localPrefs.map((p, i) => i === idx ? { ...p, enabled: !p.enabled } : p);
                    setLocalPrefs(updated); onNotificationPrefsChange(updated);
                  }} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    style={{ background: pref.enabled ? G[600] : G[200] }}>
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                      style={{ transform: pref.enabled ? 'translateX(22px)' : 'translateX(2px)' }} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['push', 'sms', 'email'] as const).map(ch => (
                    <label key={ch} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={pref.channels.includes(ch)}
                        onChange={e => {
                          const channels = e.target.checked ? [...pref.channels, ch] : pref.channels.filter(c => c !== ch);
                          const updated = localPrefs.map((p, i) => i === idx ? { ...p, channels } : p);
                          setLocalPrefs(updated); onNotificationPrefsChange(updated);
                        }} className="rounded" />
                      <span className="capitalize" style={{ color: '#6B7280' }}>{ch}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      {activeSection === 'calendar' && (
        <div style={cardStyle}>
          <div className="flex items-center gap-3 mb-4">
            <CalendarDays className="w-5 h-5" style={{ color: G[600] }} />
            <h2 className="text-base font-bold" style={{ color: G[900] }}>Calendar Integration</h2>
            <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>✨ Premium</span>
          </div>
          <div className="rounded-2xl p-8 text-center" style={{ background: G[100], border: `2px dashed ${G[400]}` }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: G[200] }}>
              <CalendarDays className="w-7 h-7" style={{ color: G[600] }} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{ color: G[900] }}>Coming Soon</h3>
            <p className="text-sm mb-4 max-w-xs mx-auto" style={{ color: G[600] }}>
              Sync school events, homework deadlines, and exams directly to your Google or Apple Calendar.
            </p>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                style={{ background: '#fff', border: `1px solid ${G[200]}`, color: G[700] }}>
                <Apple size={15} /> Apple Calendar
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                style={{ background: '#fff', border: `1px solid ${G[200]}`, color: G[700] }}>
                <CalendarDays size={15} /> Google Calendar
              </div>
            </div>
            <span className="inline-block px-4 py-1.5 text-xs font-bold rounded-full"
              style={{ background: G[200], color: G[700] }}>
              Premium Feature — Payment coming soon
            </span>
          </div>
        </div>
      )}

      {/* Translation */}
      {activeSection === 'translation' && (
        <div style={cardStyle}>
          <div className="flex items-center gap-3 mb-5">
            <Zap className="w-5 h-5" style={{ color: G[600] }} />
            <h2 className="text-base font-bold" style={{ color: G[900] }}>Translation</h2>
            <span className="ml-2 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: G[100], color: G[700], border: `1px solid ${G[200]}` }}>🧪 Test Mode</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: G[50], border: `1px solid ${G[200]}` }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: G[900] }}>Enable Translation</p>
                <p className="text-xs" style={{ color: '#6B5C4A' }}>Translate app content to your language</p>
              </div>
              <button onClick={() => onTranslationSettingsChange({ ...translationSettings, enabled: !translationSettings.enabled })}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ background: translationSettings.enabled ? G[600] : G[200] }}>
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{ transform: translationSettings.enabled ? 'translateX(22px)' : 'translateX(2px)' }} />
              </button>
            </div>
            {translationSettings.enabled && (
              <div className="p-4 rounded-xl" style={{ background: G[50], border: `1px solid ${G[200]}` }}>
                <p className="font-semibold text-sm mb-3" style={{ color: G[900] }}>Select Language</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { code:'hi', label:'हिंदी', sublabel:'Hindi' },
                    { code:'te', label:'తెలుగు', sublabel:'Telugu' },
                    { code:'kn', label:'ಕನ್ನಡ', sublabel:'Kannada' },
                    { code:'ta', label:'தமிழ்', sublabel:'Tamil' },
                    { code:'ml', label:'മലയാളം', sublabel:'Malayalam' },
                    { code:'gu', label:'ગુજરાતી', sublabel:'Gujarati' },
                    { code:'mr', label:'मराठी', sublabel:'Marathi' },
                    { code:'bn', label:'বাংলা', sublabel:'Bengali' },
                    { code:'pa', label:'ਪੰਜਾਬੀ', sublabel:'Punjabi' },
                    { code:'ur', label:'اردو', sublabel:'Urdu' },
                    { code:'ar', label:'العربية', sublabel:'Arabic' },
                    { code:'fr', label:'Français', sublabel:'French' },
                    { code:'es', label:'Español', sublabel:'Spanish' },
                    { code:'en', label:'English', sublabel:'Default' },
                  ].map(lang => {
                    const active = translationSettings.targetLanguage === lang.code;
                    return (
                      <button key={lang.code}
                        onClick={() => onTranslationSettingsChange({ ...translationSettings, targetLanguage: lang.code })}
                        className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                        style={{ background: active ? G[100] : '#fff', border: `2px solid ${active ? G[600] : G[200]}` }}>
                        <span className="text-lg leading-none">{lang.label}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: G[900] }}>{lang.sublabel}</p>
                          {active && <p className="text-[10px] font-medium" style={{ color: TEAL }}>✓ Active</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {translationSettings.enabled && translationSettings.targetLanguage !== 'en' && (
              <div className="p-4 rounded-xl" style={{ background: G[100], border: `1px solid ${G[200]}` }}>
                <p className="text-sm font-semibold mb-1" style={{ color: G[700] }}>✅ Translation Active</p>
                <p className="text-xs" style={{ color: '#6B5C4A' }}>Tab labels and key UI text are now translated. Dynamic content will be translated in the full version.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
