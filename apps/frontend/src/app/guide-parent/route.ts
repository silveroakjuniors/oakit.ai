import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// Parent guide is accessible to all authenticated roles
// (parents need it, but admin/teacher staff may also want to review it)
const ALLOWED_ROLES = ['parent', 'teacher', 'principal', 'admin'];

function getRoleFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return decoded.role?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.cookies.get('oakit_token')?.value ?? null;
}

function deniedPage(message: string): NextResponse {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Access Denied</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;margin:0}
.box{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:40px 48px;text-align:center;max-width:400px}
h1{color:#1B4332;font-size:20px;margin-bottom:8px}p{color:#6b7280;font-size:14px;margin-bottom:24px}
a{background:#1B4332;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600}</style>
</head><body><div class="box">
<h1>Access Restricted</h1>
<p>${message}</p>
<a href="https://oakit.silveroakjuniors.in">Return to Oakit</a>
</div></body></html>`;
  return new NextResponse(html, { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const token = extractToken(req);
  const role = getRoleFromToken(token);

  if (!role) return deniedPage('Please log in to Oakit to view this guide.');
  if (!ALLOWED_ROLES.includes(role)) {
    return deniedPage('Please log in with your Oakit account to access this guide.');
  }

  const filePath = path.join(process.cwd(), 'public', 'guide-parent.html');
  const html = fs.readFileSync(filePath, 'utf-8');
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
