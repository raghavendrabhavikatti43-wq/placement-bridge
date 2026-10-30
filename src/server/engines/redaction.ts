/**
 * Part I — PII Redaction & Prompt-Injection Delimiter Defense
 * Strips emails, phone numbers, URLs, and student full name/first name from untrusted text
 * before sending any context to Gemini.
 */
export function redactPiiFromText(
  input: string,
  extraNamesToRedact: (string | null | undefined)[] = []
): string {
  if (!input) return '';
  let out = input;

  // Strip email addresses
  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

  // Strip URLs
  out = out.replace(/https?:\/\/[^\s)>\]]+/gi, '[URL_REDACTED]');

  // Strip Indian / international phone numbers (10-15 digits with optional +country/spaces/hyphens)
  out = out.replace(/(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,13}\d/g, '[PHONE_REDACTED]');

  // Strip explicit names (full name + individual parts >= 3 chars)
  for (const rawName of extraNamesToRedact) {
    if (!rawName || !rawName.trim()) continue;
    const parts = [rawName.trim(), ...rawName.trim().split(/\s+/)].filter((p) => p.length >= 3);
    for (const part of parts) {
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '[CANDIDATE]');
    }
  }

  return out;
}

/**
 * Wraps untrusted user text inside strict delimiters to mitigate prompt injection.
 */
export function wrapUntrustedBlock(label: string, content: string, maxChars = 3000): string {
  const clipped = content.slice(0, maxChars).replace(/<\/?UNTRUSTED_[A-Z_]+>/gi, '');
  const safeLabel = label.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return `<UNTRUSTED_${safeLabel}>\n${clipped}\n</UNTRUSTED_${safeLabel}>`;
}

export function getCgpaBand(cgpa?: number | null): string {
  if (cgpa === null || cgpa === undefined || Number.isNaN(Number(cgpa))) return 'Not provided';
  const val = Number(cgpa);
  if (val >= 9.0) return '9.0 - 10.0';
  if (val >= 8.5) return '8.5 - 8.99';
  if (val >= 8.0) return '8.0 - 8.49';
  if (val >= 7.5) return '7.5 - 7.99';
  if (val >= 7.0) return '7.0 - 7.49';
  if (val >= 6.0) return '6.0 - 6.99';
  return 'Below 6.0';
}
