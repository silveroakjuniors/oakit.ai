'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, getApiBase } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  Loader2, CheckCircle2, AlertCircle, MessageSquare, Users, Megaphone,
  Settings, Zap, Send, ChevronRight, ChevronLeft, X, BarChart2, Phone,
  FileText, Plus, Trash2, RefreshCw, Wand2, Clock,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface WaConfig {
  phone_number_id: string;
  waba_id: string;
  business_phone: string | null;
  display_name: string | null;
  meta_app_id: string | null;
  webhook_verify_token: string | null;
  verified: boolean;
  connected_at: string | null;
  has_token: boolean;
}

interface Conversation {
  id: string;
  wa_phone: string;
  status: string;
  unread_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
  last_sender: string | null;
  parent_name: string;
  student_name: string | null;
  section_label: string | null;
  class_name: string | null;
  session_expires_at: string | null;
}

interface Message {
  id: string;
  direction: string;
  message_type: string;
  body: string | null;
  status: string;
  is_internal_note: boolean;
  sent_at: string;
  sent_by_name: string | null;
}

interface Template {
  id: string;
  name: string;
  display_name: string;
  category: string;
  language: string;
  status: string;
  body_text: string;
  variable_labels: string[];
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  created_at: string;
  template_name: string | null;
}

interface DashboardData {
  config: WaConfig | null;
  messages: { sent: number; received: number; delivered: number; read_count: number; failed: number; sent_today: number };
  conversations: { active: number; resolved: number };
  contacts: { total: number; opted_in: number };
  daily: { date: string; sent: number; received: number }[];
}

type Tab = 'setup' | 'dashboard' | 'inbox' | 'contacts' | 'campaigns' | 'templates' | 'automations';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4">
      <p className="text-xs text-neutral-500 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-neutral-800'}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminWhatsAppPage() {
  const token = getToken() || '';
  const [tab, setTab] = useState<Tab>('setup');
  const [config, setConfig] = useState<WaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [moduleError, setModuleError] = useState('');

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await apiGet<WaConfig>('/api/v1/admin/whatsapp/config', token);
      setConfig(data);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('403') || msg.toLowerCase().includes('not enabled')) {
        setModuleError('WhatsApp module is not enabled for your school. Contact your Franchise Admin or Super Admin to activate it.');
      } else {
        setModuleError('');
      }
    } finally { setLoading(false); }
  }

  useEffect(() => { loadConfig(); }, []);

  const TABS: { id: Tab; label: string; Icon: any }[] = [
    { id: 'setup',       label: 'Setup',       Icon: Settings },
    { id: 'dashboard',   label: 'Dashboard',   Icon: BarChart2 },
    { id: 'inbox',       label: 'Inbox',       Icon: MessageSquare },
    { id: 'contacts',    label: 'Contacts',    Icon: Users },
    { id: 'campaigns',   label: 'Campaigns',   Icon: Megaphone },
    { id: 'templates',   label: 'Templates',   Icon: FileText },
    { id: 'automations', label: 'Automations', Icon: Zap },
  ];

  if (loading) return (
    <div className="flex justify-center items-center min-h-96">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (moduleError) return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-primary mb-2">WhatsApp Business</h1>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 mb-1">Module not enabled</p>
          <p className="text-xs text-amber-700">{moduleError}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-green-500 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">WhatsApp Business</h1>
          <p className="text-xs text-neutral-500">
            {config?.verified ? `Connected — ${config.display_name || config.business_phone}` : 'Not connected'}
          </p>
        </div>
        {config?.verified && <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full"><CheckCircle2 className="w-3 h-3"/>Connected</span>}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto bg-neutral-100 rounded-xl p-1 mb-6 no-scrollbar">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <t.Icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'setup'       && <SetupTab token={token} config={config} onSaved={loadConfig} />}
      {tab === 'dashboard'   && <DashboardTab token={token} />}
      {tab === 'inbox'       && <InboxTab token={token} />}
      {tab === 'contacts'    && <ContactsTab token={token} />}
      {tab === 'campaigns'   && <CampaignsTab token={token} />}
      {tab === 'templates'   && <TemplatesTab token={token} />}
      {tab === 'automations' && <AutomationsTab token={token} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP TAB
// ═══════════════════════════════════════════════════════════════════════════════
function SetupTab({ token, config, onSaved }: { token: string; config: WaConfig | null; onSaved: () => void }) {
  const isConnected = !!(config?.has_token && config?.verified);
  const [editMode, setEditMode]       = useState(!isConnected);
  const [fields, setFields] = useState({
    access_token: '', phone_number_id: '', waba_id: '', business_phone: '',
    display_name: '', meta_app_id: '', meta_app_secret: '', webhook_verify_token: '',
  });
  const [saving, setSaving]           = useState(false);
  const [testing, setTesting]         = useState(false);
  const [msg, setMsg]                 = useState('');
  const [msgIsError, setMsgIsError]   = useState(false);
  const [testResult, setTestResult]   = useState<any>(null);
  const [testPhone, setTestPhone]     = useState('');
  const [testMsg, setTestMsg]         = useState(
    'Hello! This is a test message from Silver Oak Juniors via Oakit.ai.\n\nYour WhatsApp Business integration is working perfectly.\n\nWe will use this channel to keep you updated about your child\'s school activities, attendance, and important announcements.\n\nWelcome aboard! - Team Silver Oak Juniors'
  );
  const [sending, setSending]         = useState(false);
  const [sendResult, setSendResult]   = useState('');
  const [sendIsError, setSendIsError] = useState(false);

  useEffect(() => {
    setEditMode(!isConnected);
    if (config) {
      setFields(f => ({
        ...f,
        phone_number_id:    config.phone_number_id || '',
        waba_id:            config.waba_id || '',
        business_phone:     config.business_phone || '',
        display_name:       config.display_name || '',
        meta_app_id:        config.meta_app_id || '',
        webhook_verify_token: config.webhook_verify_token || '',
      }));
    }
  }, [config, isConnected]);

  async function save() {
    setSaving(true); setMsg(''); setMsgIsError(false);
    try {
      const payload: any = { ...fields };
      if (!payload.access_token)    delete payload.access_token;
      if (!payload.meta_app_secret) delete payload.meta_app_secret;
      await apiPut('/api/v1/admin/whatsapp/config', payload, token);
      setMsg('Configuration saved successfully.');
      setMsgIsError(false);
      onSaved(); setEditMode(false);
    } catch (e: any) { setMsg(e?.message || 'Save failed'); setMsgIsError(true); }
    finally { setSaving(false); }
  }

  async function test() {
    setTesting(true); setTestResult(null);
    try {
      const r = await apiPost<any>('/api/v1/admin/whatsapp/config/test', {}, token);
      setTestResult(r);
      if (r.success) onSaved();
    } catch (e: any) { setTestResult({ success: false, error: e?.message }); }
    finally { setTesting(false); }
  }

  async function disconnect() {
    if (!confirm('Disconnect WhatsApp? Teachers will not be able to send messages until reconnected.')) return;
    try {
      await fetch(`${getApiBase()}/api/v1/admin/whatsapp/config`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setMsg('Disconnected'); setMsgIsError(false); onSaved(); setEditMode(true);
    } catch (e: any) { setMsg(e?.message || 'Failed'); setMsgIsError(true); }
  }

  async function sendTestMessage() {
    if (!testPhone.trim()) { setSendResult('Enter a phone number first'); setSendIsError(true); return; }
    setSending(true); setSendResult(''); setSendIsError(false);
    try {
      const r = await apiPost<any>('/api/v1/admin/whatsapp/config/test-message', { to_phone: testPhone.trim(), message: testMsg.trim() }, token);
      if (r.success) { setSendResult('Message sent successfully. Check the WhatsApp app on that number.'); setSendIsError(false); }
      else { setSendResult(r.error || 'Send failed'); setSendIsError(true); }
    } catch (e: any) { setSendResult(e?.message || 'Send failed'); setSendIsError(true); }
    finally { setSending(false); }
  }

  const FIELDS = [
    { key: 'access_token',         label: 'Access Token (Permanent)',          placeholder: config?.has_token ? 'Leave blank to keep existing' : 'EAAxxxxxxxx...', type: 'password' },
    { key: 'phone_number_id',      label: 'Phone Number ID',                   placeholder: '123456789012345' },
    { key: 'waba_id',              label: 'WhatsApp Business Account ID',      placeholder: '123456789012345' },
    { key: 'business_phone',       label: 'Business Phone (E.164)',            placeholder: '+919876543210' },
    { key: 'display_name',         label: 'Business Display Name',            placeholder: 'Silver Oak Juniors' },
    { key: 'meta_app_id',          label: 'Meta App ID',                       placeholder: '1031468xxxxxxx' },
    { key: 'meta_app_secret',      label: 'Meta App Secret',                   placeholder: config?.has_token ? 'Leave blank to keep existing' : 'xxxxxxxxxxxxxxxxxx', type: 'password' },
    { key: 'webhook_verify_token', label: 'Webhook Verify Token (any string)', placeholder: 'oakit-wa-webhook-2024' },
  ];

  return (
    <div className="max-w-xl space-y-5">

      {/* Connected banner */}
      {isConnected && !editMode && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-green-600"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-green-800">WhatsApp Business Connected</p>
            <p className="text-xs text-green-600 mt-0.5">{config?.display_name || 'SilverOakJuniors'} &nbsp;&middot;&nbsp; {config?.business_phone || config?.phone_number_id}</p>
          </div>
          <button onClick={() => setEditMode(true)}
            className="px-3 py-1.5 rounded-xl border border-green-300 text-green-700 text-xs font-semibold hover:bg-green-100 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Edit Config
          </button>
        </div>
      )}

      {/* Edit disclaimer */}
      {isConnected && editMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>
          <div>
            <p className="text-xs font-bold text-amber-800">Editing live configuration</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              Changing these credentials will immediately affect WhatsApp messaging for the entire school. Wrong values will stop all WhatsApp communication until corrected. Only change what is necessary.
            </p>
          </div>
        </div>
      )}

      {/* Setup instructions — only for new setup */}
      {!isConnected && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
          <p className="font-semibold mb-2">Setup instructions</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs text-blue-700">
            <li>Go to <a href="https://business.facebook.com" target="_blank" className="underline font-medium">business.facebook.com</a> and create a Meta Business Account.</li>
            <li>Add a WhatsApp Business Account (WABA) and verify your business phone number.</li>
            <li>In Meta Developer Console, create an app and add the WhatsApp product.</li>
            <li>Generate a permanent access token (System User with WhatsApp Business Management permission).</li>
            <li>Copy the Phone Number ID and WABA ID from the WhatsApp configuration panel.</li>
            <li>Set Webhook URL to: <code className="bg-blue-100 px-1 rounded text-blue-900">https://oakit.silveroakjuniors.in/api/v1/whatsapp/webhook</code></li>
            <li>Use your Webhook Verify Token when registering the webhook in Meta.</li>
            <li>Subscribe to: <code className="bg-blue-100 px-1 rounded text-blue-900">messages</code> webhook field.</li>
          </ol>
        </div>
      )}

      {/* Credential fields — shown when editing or not connected */}
      {(editMode || !isConnected) && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-bold text-neutral-800 mb-1">{isConnected ? 'Update Credentials' : 'Connect WhatsApp Business'}</p>
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">{f.label}</label>
              <input type={(f as any).type || 'text'} placeholder={f.placeholder}
                value={(fields as any)[f.key]} onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={save} disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : null}{saving ? 'Saving...' : 'Save & Connect'}
            </button>
            <button onClick={test} disabled={testing}
              className="px-4 py-2 rounded-xl border border-neutral-300 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50 flex items-center gap-2">
              {testing ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>}{testing ? 'Testing...' : 'Test Connection'}
            </button>
            {isConnected && <button onClick={() => setEditMode(false)} className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 text-sm font-semibold hover:bg-neutral-50">Cancel</button>}
            {isConnected && <button onClick={disconnect} className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50">Disconnect</button>}
          </div>
          {msg && <p className={`text-sm font-medium px-3 py-2 rounded-xl ${msgIsError ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{msg}</p>}
          {testResult && (
            <div className={`text-sm px-4 py-2.5 rounded-xl border ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              {testResult.success ? `Connected — ${testResult.display_phone_number || testResult.verified_name} · Quality: ${testResult.quality_rating || 'N/A'}` : testResult.error}
            </div>
          )}
        </div>
      )}

      {/* Blurred config summary when connected and not editing */}
      {isConnected && !editMode && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute inset-0 backdrop-blur-[3px] bg-white/50 z-10 flex flex-col items-center justify-center gap-2">
            <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
            <p className="text-xs font-semibold text-neutral-500">Credentials hidden for security</p>
            <button onClick={() => setEditMode(true)} className="text-xs text-primary underline font-medium">Click Edit Config to view or change</button>
          </div>
          <div className="space-y-2 select-none pointer-events-none">
            {FIELDS.map(f => (
              <div key={f.key} className="flex items-center justify-between py-1">
                <span className="text-xs text-neutral-400 font-medium">{f.label}</span>
                <span className="text-xs text-neutral-200 font-mono tracking-widest">{'•'.repeat(14)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Message Panel — only when connected */}
      {isConnected && (
        <div className="rounded-2xl overflow-hidden border border-green-200 shadow-sm">
          <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Send Test Message</p>
              <p className="text-xs text-white/80">Verify your integration end-to-end by sending a real message</p>
            </div>
          </div>
          <div className="bg-white p-5 space-y-3">
            <TestMessagePanel token={token} />
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST MESSAGE PANEL (standalone reusable component)
// ═══════════════════════════════════════════════════════════════════════════════
function TestMessagePanel({ token }: { token: string }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [phone, setPhone]       = useState('919008166252');
  const [selectedName, setSelectedName] = useState('Oakit Super Admin');
  const [msg, setMsg]           = useState(
    'Hello! Greetings from Silver Oak Juniors.\n\nThis is a test message from our new WhatsApp Business channel powered by Oakit.ai.\n\nWe will be using this channel to send you:\n- Daily attendance updates\n- Homework notifications\n- School announcements\n- Fee reminders\n- And much more!\n\nThank you for being part of the Silver Oak Juniors family.\n\n- Team Silver Oak Juniors'
  );
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState('');
  const [isError, setIsError]   = useState(false);

  useEffect(() => {
    apiGet<any[]>('/api/v1/admin/whatsapp/contacts', token).then(d => setContacts(d || [])).catch(() => {});
  }, [token]);

  function pickContact(c: any) {
    const p = c.whatsapp_phone || c.phone || c.mobile || '';
    setPhone(p.replace(/[^0-9]/g, ''));
    setSelectedName(c.name);
  }

  async function send() {
    if (!phone.trim()) { setResult('Enter a phone number'); setIsError(true); return; }
    setSending(true); setResult(''); setIsError(false);
    try {
      const r = await apiPost<any>('/api/v1/admin/whatsapp/config/test-message', { to_phone: phone.trim(), message: msg.trim() }, token);
      if (r.success) { setResult('Message sent to ' + (selectedName || phone) + '. Check the WhatsApp app.'); setIsError(false); }
      else { setResult(r.error || 'Send failed'); setIsError(true); }
    } catch (e: any) { setResult(e?.message || 'Send failed'); setIsError(true); }
    finally { setSending(false); }
  }

  const roleLabel = (r: string) =>
    r === 'super_admin' ? 'Oakit' : r === 'principal' ? 'Principal' : r === 'teacher' ? 'Teacher' : r === 'admin' ? 'Admin' : r === 'staff' ? 'Staff' : 'Parent';

  const roleColor = (r: string) =>
    r === 'super_admin' ? 'bg-purple-100 text-purple-700' : r === 'principal' ? 'bg-blue-100 text-blue-700' : r === 'teacher' ? 'bg-emerald-100 text-emerald-700' : r === 'admin' ? 'bg-primary/10 text-primary' : 'bg-neutral-100 text-neutral-500';

  return (
    <div className="space-y-3">
      {/* Quick pick from staff list */}
      {contacts.length > 0 && (
        <div>
          <label className="text-xs font-bold text-neutral-700 mb-2 block">Quick Pick — Staff, Teachers, Principal</label>
          <div className="max-h-36 overflow-y-auto flex flex-col gap-1 border border-green-100 rounded-xl p-2 bg-green-50/30">
            {contacts.slice(0, 30).map((c, i) => {
              const p = (c.whatsapp_phone || c.phone || c.mobile || '').replace(/[^0-9]/g, '');
              const isSelected = p === phone;
              return (
                <button key={i} onClick={() => pickContact(c)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors text-xs ${isSelected ? 'bg-green-100 border border-green-300' : 'hover:bg-green-100/60'}`}>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${roleColor(c.contact_role)}`}>{roleLabel(c.contact_role)}</span>
                  <span className="font-semibold text-neutral-800 truncate">{c.name}</span>
                  <span className="text-neutral-400 ml-auto shrink-0">{p}</span>
                  {isSelected && <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0"/>}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">Scroll to see all. Click to select.</p>
        </div>
      )}

      {/* Manual phone input */}
      <div>
        <label className="text-xs font-bold text-neutral-700 mb-1 block">
          Recipient Phone <span className="font-normal text-neutral-400">(digits only, with country code)</span>
        </label>
        <div className="flex gap-2">
          <input type="tel" value={phone} onChange={e => { setPhone(e.target.value.replace(/[^0-9]/g, '')); setSelectedName(''); }}
            placeholder="919876543210"
            className="flex-1 px-3 py-2.5 rounded-xl border border-green-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/30"/>
          {selectedName && <span className="flex items-center px-2 text-xs text-green-700 bg-green-100 rounded-xl font-medium whitespace-nowrap">{selectedName}</span>}
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="text-xs font-bold text-neutral-700 mb-1 block">Message</label>
        <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={6}
          className="w-full px-3 py-2.5 rounded-xl border border-green-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400/30 leading-relaxed"/>
        <p className="text-[10px] text-neutral-400 mt-1">{msg.length} characters</p>
      </div>

      <button onClick={send} disabled={sending || !phone.trim()}
        className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
        {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>}
        {sending ? 'Sending...' : 'Send Test Message'}
      </button>

      {result && (
        <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${isError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
          {isError ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5"/>}
          {result}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTab({ token }: { token: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DashboardData>('/api/v1/admin/whatsapp/dashboard', token)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary"/></div>;
  if (!data) return <p className="text-sm text-neutral-400">Could not load dashboard</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Sent" value={data.messages.sent} />
        <StatCard label="Received" value={data.messages.received} />
        <StatCard label="Delivered" value={data.messages.delivered} color="text-emerald-600" />
        <StatCard label="Read" value={data.messages.read_count} color="text-blue-600" />
        <StatCard label="Failed" value={data.messages.failed} color="text-red-500" />
        <StatCard label="Sent Today" value={data.messages.sent_today} sub="today" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Active Conversations" value={data.conversations.active} />
        <StatCard label="Resolved" value={data.conversations.resolved} />
        <StatCard label="Total Contacts" value={data.contacts.total} />
        <StatCard label="WhatsApp Opted In" value={data.contacts.opted_in} color="text-green-600"
          sub={`${data.contacts.total > 0 ? Math.round(data.contacts.opted_in / data.contacts.total * 100) : 0}% of parents`} />
      </div>

      {/* Daily chart (simple bar) */}
      {data.daily.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Messages — Last 30 Days</p>
          <div className="flex items-end gap-1 h-24">
            {data.daily.map((d, i) => {
              const max = Math.max(...data.daily.map(x => x.sent + x.received), 1);
              const h = Math.round(((d.sent + d.received) / max) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.sent} sent, ${d.received} received`}>
                  <div className="w-full bg-primary/20 rounded-t" style={{ height: `${h}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-neutral-400">{data.daily[0]?.date}</span>
            <span className="text-[10px] text-neutral-400">{data.daily[data.daily.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INBOX TAB
// ═══════════════════════════════════════════════════════════════════════════════
function InboxTab({ token }: { token: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected]           = useState<Conversation | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);
  const [replyText, setReplyText]         = useState('');
  const [isNote, setIsNote]               = useState(false);
  const [search, setSearch]               = useState('');
  const [filterStatus, setFilterStatus]  = useState('open');
  const [aiGenerating, setAiGenerating]  = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: filterStatus });
      if (search) params.set('search', search);
      const data = await apiGet<Conversation[]>(`/api/v1/admin/whatsapp/conversations?${params}`, token);
      setConversations(data || []);
    } catch { setConversations([]); }
    finally { setLoading(false); }
  }, [filterStatus, search, token]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  async function openConversation(conv: Conversation) {
    setSelected(conv);
    setMessages([]);
    try {
      const msgs = await apiGet<Message[]>(`/api/v1/admin/whatsapp/conversations/${conv.id}/messages`, token);
      setMessages(msgs || []);
      // Update unread in list
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    } catch { setMessages([]); }
  }

  async function sendReply() {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    try {
      const res = await apiPost(`/api/v1/admin/whatsapp/conversations/${selected.id}/send`, {
        message: replyText.trim(),
        is_internal_note: isNote,
      }, token);
      setReplyText('');
      // Reload messages
      const msgs = await apiGet<Message[]>(`/api/v1/admin/whatsapp/conversations/${selected.id}/messages`, token);
      setMessages(msgs || []);
    } catch (e: any) { alert(e?.message || 'Send failed'); }
    finally { setSending(false); }
  }

  async function generateAiReply() {
    if (!selected) return;
    const lastParentMsg = [...messages].reverse().find(m => m.direction === 'inbound');
    if (!lastParentMsg?.body) { alert('No parent message to reply to'); return; }
    setAiGenerating(true);
    try {
      const r = await apiPost<{ message: string }>('/api/v1/admin/whatsapp/ai/generate-message', {
        instruction: `Reply to this parent message professionally: "${lastParentMsg.body}"`,
        audience: selected.parent_name,
        message_type: 'reply',
      }, token);
      setReplyText(r.message);
    } catch (e: any) { alert(e?.message || 'AI generation failed'); }
    finally { setAiGenerating(false); }
  }

  async function markResolved() {
    if (!selected) return;
    await apiPatch(`/api/v1/admin/whatsapp/conversations/${selected.id}/status`, { status: 'resolved' }, token).catch(() => {});
    setSelected(null);
    loadConversations();
  }

  const inSession = selected?.session_expires_at && new Date(selected.session_expires_at) > new Date();

  if (selected) return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-2xl">
      {/* Conversation header */}
      <div className="flex items-center gap-3 p-3 border-b border-neutral-100 bg-white rounded-t-2xl">
        <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-neutral-100">
          <ChevronLeft className="w-5 h-5 text-neutral-600"/>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-neutral-800 truncate">{selected.parent_name}</p>
          <p className="text-xs text-neutral-500">{selected.wa_phone} · {selected.student_name || 'No student'}</p>
        </div>
        <div className="flex gap-2">
          {!inSession && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5"><Clock className="w-2.5 h-2.5"/>Session expired</span>}
          <button onClick={markResolved} className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold">Mark Resolved</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2.5 text-sm ${
              msg.is_internal_note ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : msg.direction === 'outbound' ? 'bg-primary text-white'
              : 'bg-white border border-neutral-200 text-neutral-800'
            }`}>
              {msg.is_internal_note && <p className="text-[10px] font-bold mb-1 opacity-70">Internal note</p>}
              <p className="leading-relaxed">{msg.body}</p>
              <p className={`text-[10px] mt-1 opacity-60 text-right`}>
                {new Date(msg.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                {msg.direction === 'outbound' && ` · ${msg.status}`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      <div className="p-3 bg-white border-t border-neutral-100 rounded-b-2xl">
        {!inSession && (
          <p className="text-xs text-amber-600 mb-2 bg-amber-50 px-3 py-1.5 rounded-lg">
            Session expired — use an approved template to message this parent.
          </p>
        )}
        <div className="flex gap-2 mb-2">
          <button onClick={() => setIsNote(false)} className={`text-xs px-2 py-1 rounded-lg font-semibold ${!isNote ? 'bg-primary text-white' : 'border border-neutral-200 text-neutral-600'}`}>Reply</button>
          <button onClick={() => setIsNote(true)} className={`text-xs px-2 py-1 rounded-lg font-semibold ${isNote ? 'bg-amber-500 text-white' : 'border border-neutral-200 text-neutral-600'}`}>Internal Note</button>
        </div>
        <div className="flex gap-2">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder={isNote ? 'Internal note (not sent to parent)...' : 'Type a message...'}
            rows={2}
            className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex flex-col gap-1.5">
            <button onClick={sendReply} disabled={sending || !replyText.trim()}
              className="p-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
            </button>
            <button onClick={generateAiReply} disabled={aiGenerating} title="AI reply suggestion"
              className="p-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..."
          className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none">
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="waiting">Waiting</option>
        </select>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary"/></div>
      : conversations.length === 0 ? <p className="text-sm text-neutral-400 text-center py-10">No conversations found</p>
      : conversations.map(conv => (
        <button key={conv.id} onClick={() => openConversation(conv)}
          className="w-full text-left bg-white border border-neutral-200 rounded-2xl p-4 hover:shadow-md transition-shadow flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-green-700 font-bold text-sm">
            {conv.parent_name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-sm font-semibold text-neutral-800 truncate">{conv.parent_name}</p>
              {conv.last_message_at && <span className="text-[10px] text-neutral-400 shrink-0 ml-2">{new Date(conv.last_message_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
            <p className="text-xs text-neutral-500 truncate">{conv.last_message_text || 'No messages yet'}</p>
            {conv.student_name && <p className="text-[10px] text-neutral-400">{conv.student_name} · {conv.class_name}</p>}
          </div>
          {conv.unread_count > 0 && <span className="w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{conv.unread_count}</span>}
          <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0"/>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACTS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ContactsTab({ token }: { token: string }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOptIn, setFilterOptIn] = useState('');

  useEffect(() => {
    const params = filterOptIn ? `?opted_in=${filterOptIn}` : '';
    setLoading(true);
    apiGet<any[]>(`/api/v1/admin/whatsapp/contacts${params}`, token)
      .then(d => setContacts(d || [])).catch(() => setContacts([])).finally(() => setLoading(false));
  }, [filterOptIn, token]);

  async function toggleOptIn(parentId: string, current: boolean) {
    await apiPatch(`/api/v1/admin/whatsapp/contacts/${parentId}/opt-in`, { opt_in: !current }, token).catch(() => {});
    const params = filterOptIn ? `?opted_in=${filterOptIn}` : '';
    apiGet<any[]>(`/api/v1/admin/whatsapp/contacts${params}`, token).then(d => setContacts(d || [])).catch(() => {});
  }

  const optedIn  = contacts.filter(c => c.whatsapp_opt_in).length;
  const notIn    = contacts.filter(c => !c.whatsapp_opt_in).length;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
          <p className="text-xl font-bold text-green-700">{optedIn}</p>
          <p className="text-xs text-green-600 font-semibold">Opted In</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
          <p className="text-xl font-bold text-red-600">{notIn}</p>
          <p className="text-xs text-red-500 font-semibold">Not Opted In</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['', 'true', 'false'] as const).map(v => (
          <button key={v} onClick={() => setFilterOptIn(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filterOptIn === v ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-200'}`}>
            {v === '' ? 'All' : v === 'true' ? 'Opted In' : 'Not Opted In'}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary"/></div>
      : (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-neutral-50 border-b border-neutral-100">
              <th className="text-left px-4 py-3 font-semibold text-neutral-500">Parent</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-500">Student / Class</th>
              <th className="text-left px-4 py-3 font-semibold text-neutral-500">Mobile</th>
              <th className="text-center px-4 py-3 font-semibold text-neutral-500">WhatsApp</th>
            </tr></thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{c.name}</td>
                  <td className="px-4 py-3 text-neutral-500">{c.student_name || '—'} {c.class_name ? `· ${c.class_name}` : ''}</td>
                  <td className="px-4 py-3 text-neutral-500">{c.mobile}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleOptIn(c.id, c.whatsapp_opt_in)}
                      className={`text-[10px] font-semibold px-2 py-1 rounded-full ${c.whatsapp_opt_in ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                      {c.whatsapp_opt_in ? 'Opted In' : 'Not Opted In'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function CampaignsTab({ token }: { token: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', target_type: 'all', message_body: '', description: '' });
  const [msg, setMsg] = useState('');

  function load() {
    setLoading(true);
    apiGet<Campaign[]>('/api/v1/admin/whatsapp/campaigns', token)
      .then(d => setCampaigns(d || [])).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setCreating(true); setMsg('');
    try {
      await apiPost('/api/v1/admin/whatsapp/campaigns', form, token);
      setMsg('Campaign created'); setForm({ name: '', target_type: 'all', message_body: '', description: '' });
      load();
    } catch (e: any) { setMsg(e?.message || 'Failed'); }
    finally { setCreating(false); }
  }

  async function send(id: string, name: string) {
    if (!confirm(`Send campaign "${name}" now? This will message all opted-in recipients.`)) return;
    setSending(id);
    try {
      const r = await apiPost<any>(`/api/v1/admin/whatsapp/campaigns/${id}/send`, {}, token);
      alert(r.message);
      load();
    } catch (e: any) { alert(e?.message || 'Failed'); }
    finally { setSending(null); }
  }

  const statusColor = (s: string) =>
    s === 'completed' ? 'text-emerald-700 bg-emerald-100'
    : s === 'running' ? 'text-blue-700 bg-blue-100'
    : s === 'failed' ? 'text-red-700 bg-red-100'
    : 'text-neutral-600 bg-neutral-100';

  return (
    <div className="max-w-2xl space-y-5">
      {/* Create form */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-bold text-neutral-800">New Campaign</p>
        <input placeholder="Campaign name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
          className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
        <select value={form.target_type} onChange={e => setForm(f => ({...f, target_type: e.target.value}))}
          className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none">
          <option value="all">All Parents</option>
          <option value="class">Specific Class</option>
          <option value="section">Specific Section</option>
          <option value="custom">Custom Selection</option>
        </select>
        <textarea placeholder="Message (plain text — only usable within 24h session window; use a template for new outreach)"
          value={form.message_body} onChange={e => setForm(f => ({...f, message_body: e.target.value}))}
          rows={3} className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"/>
        <button onClick={create} disabled={creating || !form.name.trim()}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
          {creating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>} Create Campaign
        </button>
        {msg && <p className={`text-sm ${msg.includes('Failed') ? 'text-red-500' : 'text-emerald-600'}`}>{msg}</p>}
      </div>

      {/* Campaign list */}
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary"/></div>
      : campaigns.map(c => (
        <div key={c.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-neutral-800">{c.name}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusColor(c.status)}`}>{c.status}</span>
          </div>
          <div className="flex gap-3 text-xs text-neutral-500 mb-3">
            <span>{c.total_recipients} recipients</span>
            <span>{c.sent_count} sent</span>
            <span>{c.delivered_count} delivered</span>
            <span>{c.read_count} read</span>
            {c.failed_count > 0 && <span className="text-red-500">{c.failed_count} failed</span>}
          </div>
          {['draft', 'scheduled', 'failed'].includes(c.status) && (
            <button onClick={() => send(c.id, c.name)} disabled={sending === c.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 disabled:opacity-50">
              {sending === c.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3"/>} Send Now
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function TemplatesTab({ token }: { token: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', display_name: '', category: 'UTILITY', body_text: '', language: 'en' });
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [msg, setMsg] = useState('');

  function load() {
    setLoading(true);
    apiGet<Template[]>('/api/v1/admin/whatsapp/templates', token)
      .then(d => setTemplates(d || [])).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function sync() {
    setSyncing(true); setMsg('');
    try {
      const r = await apiPost<any>('/api/v1/admin/whatsapp/templates/sync', {}, token);
      setMsg(r.message || `Synced ${r.synced} template(s) from Meta`);
      load();
    } catch (e: any) { setMsg(e?.message || 'Sync failed'); }
    finally { setSyncing(false); }
  }

  async function create() {
    setCreating(true); setMsg('');
    try {
      await apiPost('/api/v1/admin/whatsapp/templates', form, token);
      setMsg('Template saved — submit for Meta approval from your Meta Business dashboard.');
      setForm({ name: '', display_name: '', category: 'UTILITY', body_text: '', language: 'en' });
      load();
    } catch (e: any) { setMsg(e?.message || 'Failed'); }
    finally { setCreating(false); }
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete template "${name}"?`)) return;
    await apiDelete(`/api/v1/admin/whatsapp/templates/${id}`, token).catch(() => {});
    load();
  }

  const statusColor = (s: string) =>
    s === 'approved' ? 'text-emerald-700 bg-emerald-100'
    : s === 'rejected' ? 'text-red-700 bg-red-100'
    : 'text-amber-700 bg-amber-100';

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
        Templates must be approved by Meta before use. Create them here, then register and submit them for approval in your Meta Business Manager. Use <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code> for dynamic variables.
      </div>

      {/* Sync from Meta button */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-neutral-800">{templates.length} template(s)</p>
        <button onClick={sync} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <RefreshCw className="w-3.5 h-3.5"/>}
          {syncing ? 'Syncing from Meta...' : 'Sync from Meta'}
        </button>
      </div>
      {msg && <p className="text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-2 rounded-xl">{msg}</p>}

      <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-bold text-neutral-800">New Template</p>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Template name (lowercase_underscore)" value={form.name}
            onChange={e => setForm(f => ({...f, name: e.target.value.toLowerCase().replace(/\s+/g,'_')}))}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
          <input placeholder="Display name (readable)" value={form.display_name}
            onChange={e => setForm(f => ({...f, display_name: e.target.value}))}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none">
            <option value="UTILITY">Utility (transactional)</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>
          <input placeholder="Language code (en, hi...)" value={form.language}
            onChange={e => setForm(f => ({...f, language: e.target.value}))}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none"/>
        </div>
        <textarea placeholder="Template body text. Use {{1}}, {{2}} for variables e.g. Dear {{1}}, your child {{2}} was absent today."
          value={form.body_text} onChange={e => setForm(f => ({...f, body_text: e.target.value}))}
          rows={4} className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"/>
        <button onClick={create} disabled={creating || !form.name || !form.body_text}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
          {creating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>} Save Template
        </button>
        {msg && <p className={`text-sm ${msg.includes('Failed') ? 'text-red-500' : 'text-emerald-600'}`}>{msg}</p>}
      </div>

      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary"/></div>
      : templates.map(t => (
        <div key={t.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-bold text-neutral-800">{t.display_name}</p>
              <p className="text-xs text-neutral-400 font-mono">{t.name} · {t.category} · {t.language || 'en'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusColor(t.status)}`}>{t.status}</span>
              <button onClick={() => del(t.id, t.display_name)} className="p-1 rounded-lg hover:bg-red-50 text-red-400">
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>
          <p className="text-xs text-neutral-600 bg-neutral-50 rounded-lg p-2.5 font-mono leading-relaxed">{t.body_text}</p>
          {t.variable_labels?.length > 0 && (
            <p className="text-[10px] text-neutral-400 mt-1">Variables: {t.variable_labels.join(', ')}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AutomationsTab({ token }: { token: string }) {
  const [automations, setAutomations] = useState<any[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', trigger_type: 'attendance_absent', template_id: '', delay_minutes: 0 });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      apiGet<any[]>('/api/v1/admin/whatsapp/automations', token),
      apiGet<Template[]>('/api/v1/admin/whatsapp/templates', token),
    ]).then(([a, t]) => { setAutomations(a || []); setTemplates((t || []).filter(x => x.status === 'approved')); })
      .catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setCreating(true); setMsg('');
    try {
      await apiPost('/api/v1/admin/whatsapp/automations', form, token);
      setMsg('Automation saved'); load();
    } catch (e: any) { setMsg(e?.message || 'Failed'); }
    finally { setCreating(false); }
  }

  async function toggle(id: string, current: boolean) {
    await apiPatch(`/api/v1/admin/whatsapp/automations/${id}`, { is_active: !current }, token).catch(() => {});
    load();
  }

  async function del(id: string) {
    if (!confirm('Delete this automation?')) return;
    await apiDelete(`/api/v1/admin/whatsapp/automations/${id}`, token).catch(() => {});
    load();
  }

  const TRIGGERS = [
    { value: 'attendance_absent',  label: 'Student Absent' },
    { value: 'attendance_late',    label: 'Student Late Arrival' },
    { value: 'fee_paid',           label: 'Fee Payment Received' },
    { value: 'fee_overdue',        label: 'Fee Overdue Reminder' },
    { value: 'student_birthday',   label: 'Student Birthday Wish' },
    { value: 'holiday_announced',  label: 'Holiday Announcement' },
    { value: 'event_reminder',     label: 'School Event Reminder' },
    { value: 'ptm_reminder',       label: 'Parent-Teacher Meeting Reminder' },
    { value: 'school_closure',     label: 'School Closure Notice' },
    { value: 'student_admitted',   label: 'New Student Admission' },
    { value: 'custom',             label: 'Custom Trigger' },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
        Automations send WhatsApp messages automatically when school events occur. Each automation requires an approved Meta template. The automation fires when the matching event is triggered in Oakit (e.g. when a teacher marks a student absent).
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-bold text-neutral-800">New Automation</p>
        <input placeholder="Automation name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
          className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"/>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.trigger_type} onChange={e => setForm(f => ({...f, trigger_type: e.target.value}))}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none">
            {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={form.template_id} onChange={e => setForm(f => ({...f, template_id: e.target.value}))}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none">
            <option value="">Select approved template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-600 font-semibold whitespace-nowrap">Send delay (minutes):</label>
          <input type="number" min={0} max={1440} value={form.delay_minutes}
            onChange={e => setForm(f => ({...f, delay_minutes: Number(e.target.value)}))}
            className="w-20 px-3 py-1.5 rounded-xl border border-neutral-200 text-sm focus:outline-none"/>
        </div>
        <button onClick={create} disabled={creating || !form.name || !form.template_id}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
          {creating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>} Save Automation
        </button>
        {msg && <p className={`text-sm ${msg.includes('Failed') ? 'text-red-500' : 'text-emerald-600'}`}>{msg}</p>}
      </div>

      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary"/></div>
      : automations.map(a => (
        <div key={a.id} className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-neutral-800">{a.name}</p>
            <p className="text-xs text-neutral-500">{TRIGGERS.find(t => t.value === a.trigger_type)?.label || a.trigger_type}
              {a.template_name ? ` · Template: ${a.template_name}` : ' · No template'}
              {a.delay_minutes > 0 ? ` · ${a.delay_minutes}m delay` : ''}
            </p>
          </div>
          <button onClick={() => toggle(a.id, a.is_active)}
            className={`w-11 h-6 rounded-full relative transition-colors ${a.is_active ? 'bg-green-500' : 'bg-neutral-300'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${a.is_active ? 'left-6' : 'left-1'}`}/>
          </button>
          <button onClick={() => del(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      ))}
    </div>
  );
}
