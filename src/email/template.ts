import { readFileSync } from 'fs';
import { join } from 'path';

export function renderTemplate(name: string, vars: Record<string, string>): string {
  const filePath = join(__dirname, '../../templates', name);
  const html = readFileSync(filePath, 'utf-8');
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    html,
  );
}
