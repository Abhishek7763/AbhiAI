/**
 * AbhiAI local document helpers.
 * Text/code files are extracted server-side. PDFs are sent natively to Gemini
 * when possible so document layout, tables, diagrams, and images remain usable.
 */

export interface AttachmentPayload {
  name: string;
  type: string;
  data: string;
}

export interface ExtractedDocument {
  name: string;
  mimeType: string;
  text: string;
  charCount: number;
  isTruncated: boolean;
}

const MAX_DOC_CHARS = 30000;
export const MAX_INLINE_ATTACHMENT_BYTES = 2_800_000;

function lowerName(name: string) {
  return (name || '').toLowerCase();
}

export function normalizeAttachmentBase64(data: string) {
  if (!data) return '';
  const commaIndex = data.indexOf(',');
  return data.startsWith('data:') && commaIndex >= 0 ? data.slice(commaIndex + 1) : data;
}

export function isImageAttachment(file: Pick<AttachmentPayload, 'name' | 'type'>) {
  return (file.type || '').toLowerCase().startsWith('image/');
}

export function isPdfAttachment(file: Pick<AttachmentPayload, 'name' | 'type'>) {
  const type = (file.type || '').toLowerCase();
  return type.includes('pdf') || lowerName(file.name).endsWith('.pdf');
}

export function isGeminiNativeAttachment(file: Pick<AttachmentPayload, 'name' | 'type'>) {
  return isImageAttachment(file) || isPdfAttachment(file);
}

export function estimateAttachmentBytes(file: Pick<AttachmentPayload, 'data'>) {
  const base64 = normalizeAttachmentBase64(file.data).replace(/\s/g, '');
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function validateInlineAttachments(attachments: AttachmentPayload[] | undefined) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  const totalBytes = attachments.reduce((sum, attachment) => sum + estimateAttachmentBytes(attachment), 0);
  if (totalBytes > MAX_INLINE_ATTACHMENT_BYTES) {
    return `Attachments are too large for inline chat. Keep the combined file size under about ${Math.floor(MAX_INLINE_ATTACHMENT_BYTES / 1_000_000)} MB.`;
  }

  return null;
}

function isTextLike(file: AttachmentPayload) {
  const type = (file.type || '').toLowerCase();
  const name = lowerName(file.name);
  return (
    type.startsWith('text/') ||
    type.includes('json') ||
    type.includes('javascript') ||
    type.includes('typescript') ||
    type.includes('csv') ||
    ['.txt', '.md', '.csv', '.json', '.ts', '.tsx', '.js', '.py', '.sql', '.html', '.css', '.yaml', '.yml', '.env', '.xml'].some((ext) => name.endsWith(ext))
  );
}

function isOfficeBinary(file: AttachmentPayload) {
  const name = lowerName(file.name);
  const type = (file.type || '').toLowerCase();
  return name.endsWith('.doc') || name.endsWith('.docx') || type.includes('wordprocessingml') || type.includes('msword');
}

export function extractDocumentText(file: AttachmentPayload): ExtractedDocument {
  const { name, type } = file;
  let extracted = '';

  try {
    const buffer = Buffer.from(normalizeAttachmentBase64(file.data), 'base64');

    if (isTextLike(file)) {
      extracted = buffer.toString('utf-8');
    } else if (isPdfAttachment(file)) {
      // Fallback for non-Gemini providers only. Gemini receives the original PDF bytes natively.
      const rawPdf = buffer.toString('binary');
      const textMatches = rawPdf.match(/\((?:[^\\()]+|\\.)*\)\s*Tj|\[(?:[^[\]]*|\((?:[^\\()]+|\\.)*\))*\]\s*TJ/g);

      if (textMatches?.length) {
        const textParts: string[] = [];
        for (const token of textMatches) {
          const literalMatches = token.match(/\(([^)]+)\)/g);
          if (!literalMatches) continue;
          for (const literal of literalMatches) {
            const cleaned = literal.slice(1, -1).replace(/\\([()\\])/g, '$1');
            if (cleaned.trim()) textParts.push(cleaned);
          }
        }
        extracted = textParts.join(' ');
      }

      if (!extracted.trim()) {
        extracted = '[PDF text could not be reliably extracted for this provider. Use a Gemini-backed AbhiAI model for native PDF understanding.]';
      }
    } else if (isOfficeBinary(file)) {
      extracted = '[DOC/DOCX binary extraction is not enabled yet. Convert this file to PDF or plain text for reliable document understanding.]';
    } else {
      extracted = '[This attachment format is not text-extractable yet.]';
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    extracted = `[Error extracting document content: ${message}]`;
  }

  const isTruncated = extracted.length > MAX_DOC_CHARS;
  const truncatedText = isTruncated
    ? `${extracted.slice(0, MAX_DOC_CHARS)}\n... [Document truncated for length]`
    : extracted;

  return {
    name,
    mimeType: type,
    text: truncatedText,
    charCount: truncatedText.length,
    isTruncated,
  };
}

export function formatDocumentsForPrompt(
  attachments: AttachmentPayload[] | undefined,
  options: { skipNativePdf?: boolean } = {},
): string {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';

  const docAttachments = attachments.filter((attachment) => {
    if (isImageAttachment(attachment)) return false;
    if (options.skipNativePdf && isPdfAttachment(attachment)) return false;
    return true;
  });

  if (docAttachments.length === 0) return '';

  const docBlocks = docAttachments.map((doc) => {
    const extracted = extractDocumentText(doc);
    return `--- ATTACHED DOCUMENT: ${extracted.name} (${extracted.mimeType || 'unknown'}) ---\n${extracted.text}\n--- END OF DOCUMENT: ${extracted.name} ---`;
  });

  return `\n\n[USER ATTACHED DOCUMENTS]:\n${docBlocks.join('\n\n')}`;
}
