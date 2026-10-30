import zlib from 'node:zlib';
import mammoth from 'mammoth';
import PDFDocument from 'pdfkit';
import { getSkillTokens, type SkillDescriptor } from './recommendation.ts';

export interface ResumeExtractedData {
  skillsFound: string[];
  educationLines: string[];
  projectSections: string[];
  certificationLines: string[];
  wordCount: number;
  hasQuantifiedMetrics: boolean;
  actionVerbsFound: string[];
}

export interface ResumeSuggestionItem {
  type: 'KEYWORDS' | 'IMPACT' | 'SECTIONS' | 'CLARITY';
  text: string;
  source: 'RULE' | 'AI';
}

export interface DeterministicResumeAnalysis {
  extracted: ResumeExtractedData;
  keywordMatchPct: number | null;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: ResumeSuggestionItem[];
}

const ACTION_VERBS = [
  'engineered',
  'architected',
  'built',
  'designed',
  'optimized',
  'reduced',
  'automated',
  'implemented',
  'deployed',
  'scaled',
  'migrated',
  'led',
  'spearheaded',
  'refactored',
  'benchmarked',
];

/**
 * Safe, bounded PDF text extractor without external native binaries or pdf-parse debug bugs.
 * Decompresses FlateDecode streams (up to 4 MB cap) and extracts PDF text operators (Tj / TJ).
 */
export function extractTextFromPdfBuffer(buffer: Buffer): string {
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('PDF exceeds maximum 5 MB extraction limit.');
  }

  const rawLatin1 = buffer.toString('latin1');
  const chunks: string[] = [];

  const decodePdfLiteral = (s: string) =>
    s
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');

  const collectTextOperators = (content: string) => {
    // Match (literal) Tj
    const tjRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(content)) !== null) {
      chunks.push(decodePdfLiteral(m[1]));
    }
    // Match [(literal) -12 (literal)] TJ
    const arrayTjRegex = /\[([^\]]{1,4000})\]\s*TJ/g;
    while ((m = arrayTjRegex.exec(content)) !== null) {
      const inner = m[1];
      const litRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
      let litMatch: RegExpExecArray | null;
      const parts: string[] = [];
      while ((litMatch = litRegex.exec(inner)) !== null) {
        parts.push(decodePdfLiteral(litMatch[1]));
      }
      if (parts.length > 0) chunks.push(parts.join(''));
    }
  };

  collectTextOperators(rawLatin1);

  // Decompress FlateDecode streams safely with maxOutputLength
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let sm: RegExpExecArray | null;
  let streamCount = 0;
  while ((sm = streamRegex.exec(rawLatin1)) !== null && streamCount < 80) {
    streamCount++;
    try {
      const compressed = Buffer.from(sm[1], 'latin1');
      const inflated = zlib.inflateSync(compressed, { maxOutputLength: 1024 * 1024 });
      collectTextOperators(inflated.toString('latin1'));
    } catch {
      // Non-Flate stream or font binary stream; safely skip
    }
  }

  return chunks
    .join(' ')
    .replace(/[^\x20-\x7E\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractResumeText(buffer: Buffer, mimeType: string): Promise<string> {
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType.includes('wordprocessingml')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || '').trim();
  }
  if (mimeType === 'application/pdf') {
    const text = extractTextFromPdfBuffer(buffer);
    return text;
  }
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf8').slice(0, 50_000).trim();
  }
  throw new Error('Unsupported resume document format. Please upload a PDF or DOCX file.');
}

/**
 * Part I — Deterministic Resume Analysis & Job Description Keyword Coverage
 * Note: Computes transparent keyword match score — never claims "ATS score guarantees selection".
 */
export function analyzeResumeDeterministically(
  rawText: string,
  catalogueSkills: SkillDescriptor[],
  jobDescription?: string | null
): DeterministicResumeAnalysis {
  const cleanText = rawText.slice(0, 40_000);
  const lower = cleanText.toLowerCase();
  const lines = cleanText
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const skillsFound: string[] = [];
  for (const skill of catalogueSkills) {
    for (const token of getSkillTokens(skill)) {
      if (!token) continue;
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[^a-z0-9+#])${escaped}($|[^a-z0-9+#])`, 'i');
      if (re.test(lower)) {
        skillsFound.push(skill.name);
        break;
      }
    }
  }

  const educationLines = lines.filter((l) =>
    /\b(b\.?tech|b\.?e\.?|bachelor|cgpa|gpa|university|institute|college|class xii|12th|10th)\b/i.test(
      l
    )
  );
  const projectSections = lines.filter((l) =>
    /\b(project|built|engineered|architected|developed|github|deployed|latency|throughput)\b/i.test(
      l
    )
  );
  const certificationLines = lines.filter((l) =>
    /\b(certified|certification|certificate|aws|oracle|hackerrank|coursera|udemy|specialization)\b/i.test(
      l
    )
  );

  const words = cleanText.split(/\s+/).filter(Boolean);
  const hasQuantifiedMetrics = /\b(\d+%|\d+x|\d+\+|\d+\s*(ms|sec|users|requests|jobs|lpa))\b/i.test(
    cleanText
  );
  const actionVerbsFound = ACTION_VERBS.filter((v) =>
    new RegExp(`\\b${v}\\b`, 'i').test(lower)
  );

  let keywordMatchPct: number | null = null;
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  if (jobDescription && jobDescription.trim().length > 0) {
    const jdLower = jobDescription.toLowerCase();
    // Extract skills mentioned in JD + salient technical tokens
    const targetSkills: string[] = [];
    for (const skill of catalogueSkills) {
      for (const token of getSkillTokens(skill)) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(^|[^a-z0-9+#])${escaped}($|[^a-z0-9+#])`, 'i').test(jdLower)) {
          targetSkills.push(skill.name);
          break;
        }
      }
    }

    const benchmarkKeywords =
      targetSkills.length > 0
        ? Array.from(new Set(targetSkills))
        : Array.from(
            new Set(
              jdLower
                .split(/[^a-z0-9+#.]+/)
                .filter(
                  (w) =>
                    w.length >= 4 &&
                    ![
                      'with',
                      'from',
                      'that',
                      'this',
                      'have',
                      'will',
                      'your',
                      'role',
                      'team',
                      'work',
                      'must',
                      'good',
                      'candidate',
                      'engineering',
                    ].includes(w)
                )
                .slice(0, 15)
            )
          );

    if (benchmarkKeywords.length > 0) {
      for (const kw of benchmarkKeywords) {
        const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(^|[^a-z0-9+#])${escaped}($|[^a-z0-9+#])`, 'i').test(lower)) {
          matchedKeywords.push(kw);
        } else {
          missingKeywords.push(kw);
        }
      }
      keywordMatchPct = Math.round((matchedKeywords.length / benchmarkKeywords.length) * 100);
    } else {
      keywordMatchPct = 100;
    }
  }

  const suggestions: ResumeSuggestionItem[] = [];
  if (missingKeywords.length > 0) {
    suggestions.push({
      type: 'KEYWORDS',
      text: `Consider incorporating verified projects or coursework covering missing job description keywords: ${missingKeywords
        .slice(0, 5)
        .join(', ')}.`,
      source: 'RULE',
    });
  }
  if (!hasQuantifiedMetrics) {
    suggestions.push({
      type: 'IMPACT',
      text: 'Quantify engineering outcomes in project bullets (e.g., latency reduction %, throughput req/sec, test coverage %, or users served).',
      source: 'RULE',
    });
  }
  if (actionVerbsFound.length < 3) {
    suggestions.push({
      type: 'CLARITY',
      text: 'Start bullet points with strong engineering action verbs such as Engineered, Optimized, Architected, Automated, or Benchmarked.',
      source: 'RULE',
    });
  }
  if (educationLines.length === 0) {
    suggestions.push({
      type: 'SECTIONS',
      text: 'Include a clear Education section listing degree, branch, graduation year, and current CGPA.',
      source: 'RULE',
    });
  }
  if (projectSections.length < 2) {
    suggestions.push({
      type: 'SECTIONS',
      text: 'Highlight at least 2 end-to-end technical projects with explicit tech stacks and GitHub/live repository links.',
      source: 'RULE',
    });
  }
  if (suggestions.length === 0) {
    suggestions.push({
      type: 'CLARITY',
      text: 'Solid deterministic keyword and section structure. Tailor your top summary bullet to match each specific campus role.',
      source: 'RULE',
    });
  }

  return {
    extracted: {
      skillsFound,
      educationLines: educationLines.slice(0, 6),
      projectSections: projectSections.slice(0, 8),
      certificationLines: certificationLines.slice(0, 6),
      wordCount: words.length,
      hasQuantifiedMetrics,
      actionVerbsFound,
    },
    keywordMatchPct,
    matchedKeywords,
    missingKeywords,
    suggestions,
  };
}

/**
 * Generates a clean, multi-template PDF resume buffer using `pdfkit`.
 */
export async function generateResumePdfBuffer(params: {
  template: string;
  fullName: string;
  email: string;
  phone?: string | null;
  college?: string | null;
  degree?: string | null;
  department?: string | null;
  graduationYear?: number | null;
  cgpa?: number | string | null;
  summary?: string | null;
  skills: string[];
  projects: { title: string; role?: string | null; technologies?: string[]; description?: string | null; githubUrl?: string | null }[];
  internships: { company: string; role: string; description?: string | null }[];
  certifications: { name: string; issuer: string }[];
  achievements: { title: string; description?: string | null }[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const accentColor =
      params.template === 'modern'
        ? '#1d4ed8'
        : params.template === 'minimal'
        ? '#0f172a'
        : '#1e293b';

    // Header
    doc.fillColor(accentColor).fontSize(20).font('Helvetica-Bold').text(params.fullName);
    const contactParts = [
      params.email,
      params.phone,
      params.college
        ? `${params.college} (${params.degree || 'B.Tech'} ${params.department || ''})`
        : null,
    ].filter(Boolean);
    doc
      .moveDown(0.2)
      .fillColor('#475569')
      .fontSize(9.5)
      .font('Helvetica')
      .text(contactParts.join('  |  '));

    const addSectionHeader = (title: string) => {
      doc.moveDown(0.8);
      doc.fillColor(accentColor).fontSize(11).font('Helvetica-Bold').text(title.toUpperCase());
      const y = doc.y + 2;
      doc.moveTo(48, y).lineTo(547, y).strokeColor('#cbd5e1').lineWidth(0.75).stroke();
      doc.moveDown(0.4);
    };

    if (params.summary) {
      addSectionHeader('Summary');
      doc.fillColor('#1e293b').fontSize(9.5).font('Helvetica').text(params.summary);
    }

    addSectionHeader('Education');
    doc
      .fillColor('#0f172a')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(
        `${params.degree || 'B.Tech'} in ${params.department || 'Engineering'} — ${
          params.college || 'Engineering Institute'
        }`
      );
    doc
      .fillColor('#334155')
      .fontSize(9.5)
      .font('Helvetica')
      .text(
        `Graduation Batch: ${params.graduationYear || '2025'}   |   CGPA: ${
          params.cgpa ?? 'N/A'
        }`
      );

    if (params.skills.length > 0) {
      addSectionHeader('Technical Skills');
      doc.fillColor('#1e293b').fontSize(9.5).font('Helvetica').text(params.skills.join(' • '));
    }

    if (params.projects.length > 0) {
      addSectionHeader('Engineering Projects');
      for (const p of params.projects) {
        doc
          .fillColor('#0f172a')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(
            `${p.title}${p.technologies?.length ? ` (${p.technologies.join(', ')})` : ''}`
          );
        if (p.description) {
          doc.fillColor('#334155').fontSize(9.5).font('Helvetica').text(`• ${p.description}`);
        }
        if (p.githubUrl) {
          doc.fillColor('#475569').fontSize(8.5).font('Helvetica').text(`  Repo: ${p.githubUrl}`);
        }
        doc.moveDown(0.3);
      }
    }

    if (params.internships.length > 0) {
      addSectionHeader('Internships & Experience');
      for (const intern of params.internships) {
        doc
          .fillColor('#0f172a')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`${intern.role} — ${intern.company}`);
        if (intern.description) {
          doc
            .fillColor('#334155')
            .fontSize(9.5)
            .font('Helvetica')
            .text(`• ${intern.description}`);
        }
        doc.moveDown(0.3);
      }
    }

    if (params.certifications.length > 0) {
      addSectionHeader('Certifications');
      for (const cert of params.certifications) {
        doc
          .fillColor('#1e293b')
          .fontSize(9.5)
          .font('Helvetica')
          .text(`• ${cert.name} (${cert.issuer})`);
      }
    }

    if (params.achievements.length > 0) {
      addSectionHeader('Achievements');
      for (const ach of params.achievements) {
        doc
          .fillColor('#1e293b')
          .fontSize(9.5)
          .font('Helvetica')
          .text(`• ${ach.title}${ach.description ? ` — ${ach.description}` : ''}`);
      }
    }

    doc.end();
  });
}
