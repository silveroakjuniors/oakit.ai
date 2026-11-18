'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlatformConfig {
  platform: string;
  enabled: boolean;
  connected: boolean;
  token_expires_at: string | null;
  page_id: string | null;
  account_id: string | null;
  handle: string | null;
  connected_at: string | null;
}

interface TestResult {
  success: boolean;
  account_name?: string;
  followers?: number;
  error?: string;
  help?: string;
}

// ── Platform metadata ─────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, {
  label: string;
  color: string;
  bg: string;
  icon: string;
  cost: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}> = {
  instagram: {
    label: 'Instagram',
    color: 'text-pink-700',
    bg: 'bg-pink-50 border-pink-200',
    icon: '📸',
    cost: 'Free — Meta Graph API has no publishing fees',
    fields: [
      { key: 'access_token', label: 'Page Access Token (Long-lived)', placeholder: 'EAAxxxxxxxx...', type: 'password' },
      { key: 'account_id', label: 'Instagram Business Account ID', placeholder: '17841400000000000' },
      { key: 'page_id', label: 'Facebook Page ID', placeholder: '123456789' },
      { key: 'handle', label: 'Instagram Handle', placeholder: '@silveroakjuniors' },
    ],
  },
  facebook: {
    label: 'Facebook',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: '📘',
    cost: 'Free — Meta Graph API has no publishing fees',
    fields: [
      { key: 'access_token', label: 'Page Access Token (Long-lived)', placeholder: 'EAAxxxxxxxx...', type: 'password' },
      { key: 'page_id', label: 'Facebook Page ID', placeholder: '123456789' },
      { key: 'handle', label: 'Facebook Page Name', placeholder: 'Silver Oak Juniors' },
    ],
  },
  youtube: {
    label: 'YouTube Shorts',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    icon: '▶️',
    cost: 'Free — 10,000 quota units/day (each upload ≈ 1,600 units = ~6 uploads/day)',
    fields: [
      { key: 'access_token', label: 'OAuth Access Token', placeholder: 'ya29.xxxxxxxx', type: 'password' },
      { key: 'page_id', label: 'YouTube Channel ID', placeholder: 'UCxxxxxxxxxxxxxxxx' },
      { key: 'handle', label: 'Channel Handle', placeholder: '@silveroakjuniors' },
    ],
  },
  twitter: {
    label: 'Twitter / X',
    color: 'text-neutral-700',
    bg: 'bg-neutral-50 border-neutral-200',
    icon: '🐦',
    cost: 'Basic tier required: $100/month — Free tier does NOT allow posting',
    fields: [
      { key: 'access_token', label: 'Bearer Token (OAuth 2.0)', placeholder: 'AAAAAAAAAAAAAAAAAAAAAxxxxxx', type: 'password' },
      { key: 'handle', label: 'Twitter Handle', placeholder: '@silveroakjuniors' },
    ],
  },
  linkedin: {
    label: 'LinkedIn',
    color: 'text-blue-800',
    bg: 'bg-sky-50 border-sky-200',
    icon: '💼',
    cost: 'Free for personal profile posting — Company page requires Partner Program (complex)',
    fields: [
      { key: 'access_token', label: 'OAuth Access Token', placeholder: 'AQxxxxxxxx', type: 'password' },
      { key: 'account_id', label: 'LinkedIn Person ID (URN)', placeholder: 'xxxxxxxx' },
      { key: 'handle', label: 'LinkedIn Profile Name', placeholder: 'Principal Name' },
    ],
  },
};

// ── Setup guides ──────────────────────────────────────────────────────────────
const SETUP_GUIDES: Record<string, { step: string; detail: string }[]> = {
  instagram: [
    { step: 'Convert Instagram to Professional', detail: 'Open Instagram app → Settings → Account → Switch to Professional Account → Choose "Business" → Connect to your Facebook Page.' },
    { step: 'Create a Meta Developer App', detail: 'Go to developers.facebook.com → My Apps → Create App → Choose "Business" → Fill in app name and email.' },
    { step: 'Add Instagram Graph API product', detail: 'In your app dashboard → Add Product → Instagram Graph API → Set Up. Also add "Facebook Login".' },
    { step: 'Generate a Long-Lived Page Access Token', detail: 'Go to Graph API Explorer (developers.facebook.com/tools/explorer) → Select your app → Generate Access Token → Add permissions: instagram_basic, instagram_content_publish, pages_read_engagement, pages_manage_posts → Exchange for long-lived token (60 days).' },
    { step: 'Get your Instagram Business Account ID', detail: 'In Graph Explorer query GET /me/accounts → find your page ID → query GET /{page-id}?fields=instagram_business_account → note the Instagram Business Account ID.' },
    { step: 'Enter credentials above and click Test Connection', detail: 'Paste the long-lived token, Instagram Business Account ID, and Facebook Page ID. Oakit will warn you 7 days before expiry.' },
  ],
  facebook: [
    { step: 'You need a Facebook Page (not personal profile)', detail: 'Go to facebook.com/pages/create → Choose "Business or Brand" → fill in your school details.' },
    { step: 'Create a Meta Developer App (same as Instagram setup)', detail: 'Go to developers.facebook.com → My Apps → Create App → Business type.' },
    { step: 'Generate a Page Access Token', detail: 'Graph API Explorer → select your app → Generate Access Token → add permission: pages_manage_posts, pages_read_engagement → Exchange for long-lived token.' },
    { step: 'Get your Page ID', detail: 'Go to your Facebook Page → About section → scroll to "Page ID" or query GET /me/accounts in Graph Explorer.' },
    { step: 'Enter credentials and Test Connection', detail: 'Paste the long-lived token and Page ID above, then click Test.' },
  ],
  youtube: [
    { step: 'Create a Google Cloud Project', detail: 'Go to console.cloud.google.com → New Project → name it "Oakit Social Publisher" → note the Project ID.' },
    { step: 'Enable YouTube Data API v3', detail: 'APIs & Services → Library → search "YouTube Data API v3" → Enable.' },
    { step: 'Create OAuth 2.0 Credentials', detail: 'APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application → Add redirect URI: https://oakit.silveroakjuniors.in/api/v1/admin/social-media/oauth/youtube/callback → Download JSON.' },
    { step: 'Configure OAuth Consent Screen', detail: 'APIs & Services → OAuth consent screen → External → App name: Oakit Publisher → Add scope: youtube.upload → Add your email as test user.' },
    { step: 'Authorize and get Access Token', detail: 'Enter Client ID and Client Secret, then click "Connect YouTube Account" — you\'ll be redirected to Google sign-in. Oakit stores the refresh token and auto-renews.' },
    { step: 'Important: Videos must be ≤60 seconds and 9:16 vertical for Shorts', detail: 'Oakit automatically adds #Shorts to the caption. Keep videos portrait orientation.' },
  ],
  twitter: [
    { step: 'Important: Basic tier ($100/month) is required', detail: 'The Free tier of Twitter API does NOT allow posting. You need at minimum Basic tier. Go to developer.twitter.com → Subscription → Basic.' },
    { step: 'Apply for a Twitter Developer Account', detail: 'Go to developer.twitter.com → Sign up → Sign in with the school\'s Twitter account → Fill in use case form.' },
    { step: 'Create a Project and App', detail: 'Developer Portal → Projects & Apps → New Project → "Oakit Publisher" → Add App under the project.' },
    { step: 'Enable OAuth and get tokens', detail: 'App settings → User authentication settings → App permissions: "Read and Write" → App type: "Web App" → Callback URL: https://oakit.silveroakjuniors.in/api/v1/admin/social-media/oauth/twitter/callback.' },
    { step: 'Generate Bearer Token', detail: 'Keys and Tokens → Authentication Tokens → Generate Access Token and Secret. Note API Key, API Key Secret, Access Token, Access Token Secret.' },
    { step: 'Enter Bearer Token above and Test', detail: 'Paste the Bearer Token. Oakit will verify the connection.' },
  ],
  linkedin: [
    { step: 'Note: Posts go to personal profile (not company page)', detail: 'LinkedIn company page posting requires Partner Program approval which is very difficult. Personal profile posting is free and immediate.' },
    { step: 'Create a LinkedIn Developer App', detail: 'Go to developer.linkedin.com → Create App → App name: "Oakit Publisher" → Select your school LinkedIn page → Accept agreement.' },
    { step: 'Request "Share on LinkedIn" product', detail: 'In your app → Products tab → Request access to "Share on LinkedIn". This grants w_member_social and r_liteprofile scopes (usually auto-approved).' },
    { step: 'Configure OAuth redirect URL', detail: 'App → Auth tab → Authorized redirect URLs → Add: https://oakit.silveroakjuniors.in/api/v1/admin/social-media/oauth/linkedin/callback → Note Client ID and Client Secret.' },
    { step: 'Connect LinkedIn Account in Oakit', detail: 'Enter Client ID and Client Secret, then click "Connect LinkedIn Account". Sign in with the principal\'s LinkedIn account.' },
    { step: 'Token lifespan: 60 days (access), 1 year (refresh)', detail: 'Oakit auto-refreshes tokens. You\'ll be prompted to reconnect after 1 year.' },
  ],
};

// ── PlatformConfigCard component ──────────────────────────────────────────────
function PlatformConfigCard({
  config,
  token,
  onSaved,
}: {
  config: PlatformConfig;
  token: string;
  onSaved: () => void;
}) {
  const meta = PLATFORM_META[config.platform];
  const guide = SETUP_GUIDES[config.platform] || [];

  const [expanded, setExpanded]       = useState(false);
  const [showGuide, setShowGuide]     = useState(false);
  const [fields, setFields]           = useState<Record<string, string>>({});
  const [saving, setSaving]           = useState(false);
  const [testing, setTesting]         = useState(false);
  const [testResult, setTestResult]   = useState<TestResult | null>(null);
  const [msg, setMsg]                 = useState('');

  // Pre-populate non-sensitive fields when opening edit mode
  function toggleExpanded() {
    if (!expanded && config.connected) {
      // Seed form with saved non-sensitive values so user sees what's already stored.
      // access_token is intentionally NOT returned by the API (security) — user only
      // needs to re-enter it if they want to change it.
      setFields({
        page_id:    config.page_id    || '',
        account_id: config.account_id || '',
        handle:     config.handle     || '',
      });
    }
    if (!expanded) setMsg('');
    setExpanded(v => !v);
  }

  // Connection status
  const isExpired = config.token_expires_at && new Date(config.token_expires_at) < new Date();
  const expiresSoon = config.token_expires_at && !isExpired
    && (new Date(config.token_expires_at).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000;

  async function save() {
    setSaving(true); setMsg('');
    try {
      // Only include access_token in payload if the user actually typed a new one
      const payload: Record<string, any> = { enabled: true };
      for (const [k, v] of Object.entries(fields)) {
        if (k === 'access_token' && !v.trim()) continue; // keep existing token
        if (v.trim()) payload[k] = v.trim();
      }
      await apiPut(`/api/v1/admin/social-media/config/${config.platform}`, payload, token);
      setMsg('Saved');
      onSaved();
      setExpanded(false);
    } catch (e: any) {
      const msg = e?.message || 'Save failed';
      if (msg.toLowerCase().includes('not enabled')) {
        setMsg('Module not enabled — run migration 114 and set social_media_enabled=true in Supabase');
      } else if (msg.toLowerCase().includes('encryption') || msg.toLowerCase().includes('credential_encryption')) {
        setMsg('Server config error: CREDENTIAL_ENCRYPTION_KEY not set on API server');
      } else {
        setMsg(msg);
      }
    }
    finally { setSaving(false); }
  }

  async function testConnection() {
    setTesting(true); setTestResult(null);
    try {
      const r = await apiPost<TestResult>(
        `/api/v1/admin/social-media/config/${config.platform}/test`,
        {},
        token,
      );
      setTestResult(r);
    } catch (e: any) {
      const msg = e?.message || 'Test failed';
      let help: string | undefined;
      if (msg.toLowerCase().includes('no credentials')) {
        help = 'Save your credentials first using "Save & Connect", then test.';
      } else if (msg.toLowerCase().includes('not enabled')) {
        help = 'Run migration 114 in Supabase and set social_media_enabled=true for your school.';
      } else if (msg.includes('401') || msg.includes('403')) {
        help = 'Your token may have expired or permissions are insufficient. Please reconnect.';
      }
      setTestResult({ success: false, error: msg, help });
    }
    finally { setTesting(false); }
  }

  async function disconnect() {
    if (!confirm(`Disconnect ${meta.label}? You will need to reconnect to publish to this platform.`)) return;
    try {
      await apiDelete(`/api/v1/admin/social-media/config/${config.platform}`, token);
      onSaved();
    } catch (e: any) {
      setMsg(e?.message || 'Disconnect failed');
    }
  }

  return (
    <div className={`rounded-2xl border ${meta.bg} overflow-hidden`}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3">
        <span className="text-2xl">{meta.icon}</span>
        <div className="flex-1">
          <p className={`font-bold text-sm ${meta.color}`}>{meta.label}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{meta.cost}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          {config.connected && !isExpired && !expiresSoon && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          )}
          {expiresSoon && (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" /> Expires soon
            </span>
          )}
          {isExpired && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full">
              <XCircle className="w-3 h-3" /> Token expired
            </span>
          )}
          {!config.connected && (
            <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2 py-1 rounded-full">
              Not connected
            </span>
          )}
          {/* Test button — show when connected OR when credentials are filled in the form */}
          {(config.connected || Object.values(fields).some(v => v?.trim())) && (
            <button
              onClick={testConnection}
              disabled={testing}
              className="text-xs font-medium px-3 py-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Test'}
            </button>
          )}
          {/* Expand/Setup */}
          <button
            onClick={toggleExpanded}
            className="text-xs font-medium px-3 py-1.5 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 transition-colors"
          >
            {expanded ? 'Close' : config.connected ? 'Edit' : 'Set up'}
          </button>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`mx-5 mb-3 px-4 py-2.5 rounded-xl text-sm ${testResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {testResult.success
            ? `Connected — ${testResult.account_name}${testResult.followers ? ` (${testResult.followers.toLocaleString()} followers)` : ''}`
            : `${testResult.error}${testResult.help ? ` — ${testResult.help}` : ''}`}
        </div>
      )}

      {/* Expanded setup form */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-neutral-200/50 pt-4">
          {/* Setup guide toggle */}
          <button
            onClick={() => setShowGuide(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-primary mb-3 hover:underline"
          >
            {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showGuide ? 'Hide' : 'Show'} step-by-step setup guide
            <ExternalLink className="w-3.5 h-3.5 opacity-50" />
          </button>

          {showGuide && (
            <ol className="mb-4 space-y-3 bg-white rounded-xl border border-neutral-200 p-4">
              {guide.map((g, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">{g.step}</p>
                    <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{g.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Credential fields */}
          <div className="flex flex-col gap-3">
            {meta.fields.map(f => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-neutral-600 mb-1 block">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  placeholder={
                    f.key === 'access_token' && config.connected
                      ? 'Leave blank to keep existing token'
                      : f.placeholder
                  }
                  value={fields[f.key] || ''}
                  onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                />
                {f.key === 'access_token' && config.connected && !fields[f.key] && (
                  <p className="text-[11px] text-neutral-400 mt-1">Token already saved — enter a new one only if you want to replace it</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save & Connect'}
            </button>
            <button
              onClick={testConnection}
              disabled={testing}
              className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            {config.connected && (
              <button
                onClick={disconnect}
                className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
              >
                Disconnect
              </button>
            )}
            {msg && <span className={`text-sm self-center ${msg === 'Saved' ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Approval Queue ────────────────────────────────────────────────────────────
function ApprovalQueue({ token }: { token: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<any[]>('/api/v1/admin/social-media/posts?status=pending_approval', token);
      setPosts(data || []);
    } catch { setPosts([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    try {
      await apiPost(`/api/v1/admin/social-media/posts/${id}/approve`, {}, token);
      setActionMsg('Approved — publishing started');
      load();
    } catch (e: any) { setActionMsg(e?.message || 'Failed'); }
  }

  async function reject(id: string) {
    const reason = prompt('Rejection reason (required):');
    if (!reason?.trim()) return;
    try {
      await apiPost(`/api/v1/admin/social-media/posts/${id}/reject`, { reason }, token);
      setActionMsg('Post rejected');
      load();
    } catch (e: any) { setActionMsg(e?.message || 'Failed'); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col gap-4">
      {actionMsg && <p className="text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">{actionMsg}</p>}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No pending posts</p>
        </div>
      ) : (
        posts.map(post => (
          <div key={post.id} className="bg-white border border-neutral-200 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-neutral-800">{post.teacher_name}</p>
                <p className="text-xs text-neutral-400">{new Date(post.submitted_at).toLocaleString('en-IN')}</p>
              </div>
              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-1 rounded-full capitalize">
                {post.media_type?.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-neutral-700 mb-2 leading-relaxed">{post.ai_caption || post.raw_caption}</p>
            {post.hashtags?.length > 0 && (
              <p className="text-xs text-primary mb-3">{post.hashtags.slice(0, 10).join(' ')}</p>
            )}
            <div className="flex gap-1 mb-4">
              {post.platforms?.map((p: any) => (
                <span key={p.platform} className="text-[10px] font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full capitalize">{p.platform}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => approve(post.id)} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
                Approve & Publish
              </button>
              <button onClick={() => reject(post.id)} className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Post History ──────────────────────────────────────────────────────────────
function PostHistory({ token }: { token: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<any[]>('/api/v1/admin/social-media/posts', token)
      .then(d => setPosts((d || []).filter(p => p.status !== 'pending_approval')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => s === 'published' ? 'text-emerald-700 bg-emerald-100'
    : s === 'failed' ? 'text-red-700 bg-red-100'
    : s === 'partially_published' ? 'text-amber-700 bg-amber-100'
    : 'text-neutral-600 bg-neutral-100';

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col gap-3">
      {posts.length === 0 ? <p className="text-sm text-neutral-400 text-center py-10">No posts yet</p> : posts.map(post => (
        <div key={post.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-neutral-800">{post.teacher_name}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(post.status)}`}>
              {post.status?.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mb-2">{new Date(post.submitted_at).toLocaleDateString('en-IN')}</p>
          <p className="text-sm text-neutral-600 line-clamp-2">{post.final_caption || post.ai_caption || post.raw_caption}</p>
          <div className="flex gap-1 mt-2">
            {post.platforms?.map((p: any) => (
              <span key={p.platform} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize
                ${p.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : p.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-500'}`}>
                {p.platform} {p.status === 'posted' ? '' : p.status === 'failed' ? '(failed)' : ''}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SocialMediaAdminPage() {
  const token = getToken() || '';
  const [tab, setTab] = useState<'config' | 'queue' | 'history'>('config');
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [moduleError, setModuleError] = useState('');

  async function load() {
    setLoading(true);
    setModuleError('');
    try {
      const [cfg, posts] = await Promise.all([
        apiGet<PlatformConfig[]>('/api/v1/admin/social-media/config', token),
        apiGet<any[]>('/api/v1/admin/social-media/posts?status=pending_approval', token).catch(() => []),
      ]);
      setConfigs(cfg || []);
      setPendingCount((posts || []).length);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('403') || msg.toLowerCase().includes('not enabled')) {
        setModuleError('Social media module is not enabled for your school. Run migration 114 in Supabase, then run: UPDATE schools SET social_media_enabled = true WHERE id = \'your-school-id\';');
      } else {
        setModuleError(`Failed to load: ${msg}`);
      }
      setConfigs([]);
    }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold text-primary mb-2">Social Media Publisher</h1>
      <p className="text-sm text-neutral-500 mb-6">Connect your school's social media accounts and manage teacher content submissions.</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-neutral-100 rounded-xl p-1 w-fit">
        {(['config', 'queue', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${tab === t ? 'bg-white text-primary shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            {t === 'config' ? 'Platform Setup'
              : t === 'queue' ? <>Approval Queue {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{pendingCount}</span>}</>
              : 'Post History'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : moduleError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800 mb-1">Module setup required</p>
              <p className="text-xs text-red-700 leading-relaxed">{moduleError}</p>
            </div>
          </div>
        </div>
      ) : tab === 'config' ? (
        <div className="flex flex-col gap-4">
          {configs.map(cfg => (
            <PlatformConfigCard key={cfg.platform} config={cfg} token={token} onSaved={load} />
          ))}
        </div>
      ) : tab === 'queue' ? (
        <ApprovalQueue token={token} />
      ) : (
        <PostHistory token={token} />
      )}
    </div>
  );
}
