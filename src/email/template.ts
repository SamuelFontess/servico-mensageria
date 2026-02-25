import { readFileSync } from 'fs';
import { join } from 'path';

const ALLOWED_TEMPLATES = new Set(['family-invite.html', 'forgot-password.html']);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function renderTemplate(name: string, vars: Record<string, string>): string {
  if (!ALLOWED_TEMPLATES.has(name)) {
    throw new Error(`Template not allowed: ${name}`);
  }

  const filePath = join(__dirname, '../../templates', name);
  const html = readFileSync(filePath, 'utf-8');

  return Object.entries(vars).reduce((acc, [key, value]) => {
    // URLs (campos que terminam em "Link") não são escapadas — são construídas internamente
    const safeValue = key.endsWith('Link') ? value : escapeHtml(value);
    return acc.replaceAll(`{{${key}}}`, safeValue);
  }, html);
}
