import { inflateRawSync } from 'node:zlib';

/**
 * AbhiAI document helpers.
 *
 * - Text/code/CSV/Markdown files are decoded server-side.
 * - DOCX is parsed directly from its ZIP container without third-party packages.
 * - PDFs are sent natively to Gemini when possible so layout, tables, diagrams,
 *   and embedded images remain usable. A conservative text fallback exists for
 *   non-Gemini providers.
 * - Attachments are request-scoped only. Decoded buffers are zero-filled after
 *   extraction as best-effort cleanup and are never persisted by this module.
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

const MAX_DOC_CHARS = 30_000;
const MAX_DOCX_XML_BYTES = 5_000_000;
const MAX_DOCX_ENTRIES = 512;
const MAX_ZIP_COMPRESSION_RATIO = 120;
const MAX_INLINE_ATTACHMENTS = 4;
const MAX_SINGLE_ATTACHMENT_BYTES = 2_000_000;
export const MAX_INLINE_ATTACHMENT_BYTES = 2_800_000;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function lowerName(name: string) {
  return (name || '').toLowerCase();
}

function extensionOf(name: string) {
  const normalized = lowerName(name);
  const index = normalized.lastIndexOf('.');
  return index >= 0 ? normalized.slice(index) : '';
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

export function isDocxAttachment(file: Pick<AttachmentPayload, 'name' | 'type'>) {
  const type = (file.type || '').toLowerCase();
  return type === DOCX_MIME || lowerName(file.name).endsWith('.docx');
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

function isTextLike(file: Pick<AttachmentPayload, 'name' | 'type'>) {
  const type = (file.type || '').toLowerCase();
  const name = lowerName(file.name);
  return (
    type.startsWith('text/') ||
    type.includes('json') ||
    type.includes('javascript') ||
    type.includes('typescript') ||
    type.includes('csv') ||
    type.includes('xml') ||
    ['.txt', '.md', '.csv', '.json', '.ts', '.tsx', '.js', '.jsx', '.py', '.sql', '.html', '.css', '.yaml', '.yml', '.env', '.xml'].some((ext) => name.endsWith(ext))
  );
}

function isLegacyWordBinary(file: Pick<AttachmentPayload, 'name' | 'type'>) {
  const type = (file.type || '').toLowerCase();
  return lowerName(file.name).endsWith('.doc') || type.includes('msword');
}

function isSupportedAttachment(file: Pick<AttachmentPayload, 'name' | 'type'>) {
  return isImageAttachment(file) || isPdfAttachment(file) || isDocxAttachment(file) || isTextLike(file) || isLegacyWordBinary(file);
}

function hasPdfSignature(buffer: Buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function hasZipSignature(buffer: Buffer) {
  if (buffer.length < 4) return false;
  const signature = buffer.readUInt32LE(0);
  return signature === 0x04034b50 || signature === 0x06054b50 || signature === 0x08074b50;
}

function decodeForSignature(file: AttachmentPayload) {
  try {
    const base64 = normalizeAttachmentBase64(file.data);
    if (!base64) return Buffer.alloc(0);
    return Buffer.from(base64.slice(0, 256), 'base64');
  } catch {
    return Buffer.alloc(0);
  }
}

export function validateInlineAttachments(attachments: AttachmentPayload[] | undefined) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  if (attachments.length > MAX_INLINE_ATTACHMENTS) {
    return `Too many attachments in one message. Attach up to ${MAX_INLINE_ATTACHMENTS} files at a time.`;
  }

  let totalBytes = 0;

  for (const attachment of attachments) {
    if (!attachment.name || !attachment.data) {
      return 'Each attachment must include a file name and file data.';
    }

    if (!isSupportedAttachment(attachment)) {
      const extension = extensionOf(attachment.name) || 'unknown';
      return `Unsupported attachment format (${extension}). Use PDF, DOCX, TXT, Markdown, CSV, common code/text files, or images.`;
    }

    const bytes = estimateAttachmentBytes(attachment);
    totalBytes += bytes;

    if (bytes <= 0) {
      return `${attachment.name} is empty or could not be decoded.`;
    }

    if (bytes > MAX_SINGLE_ATTACHMENT_BYTES) {
      return `${attachment.name} is too large for inline analysis. Keep each file under about ${Math.floor(MAX_SINGLE_ATTACHMENT_BYTES / 1_000_000)} MB.`;
    }

    if (isPdfAttachment(attachment) || isDocxAttachment(attachment)) {
      const signature = decodeForSignature(attachment);
      const valid = isPdfAttachment(attachment) ? hasPdfSignature(signature) : hasZipSignature(signature);
      signature.fill(0);
      if (!valid) {
        return `${attachment.name} does not look like a valid ${isPdfAttachment(attachment) ? 'PDF' : 'DOCX'} file.`;
      }
    }
  }

  if (totalBytes > MAX_INLINE_ATTACHMENT_BYTES) {
    return `Attachments are too large for inline chat. Keep the combined file size under about ${Math.floor(MAX_INLINE_ATTACHMENT_BYTES / 1_000_000)} MB.`;
  }

  return null;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function wordXmlToText(xml: string) {
  const normalized = xml
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:tc>/gi, '\t')
    .replace(/<\/w:tr>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  return decodeXmlEntities(normalized)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function listZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) throw new Error('DOCX ZIP directory was not found.');

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries > MAX_DOCX_ENTRIES) {
    throw new Error('DOCX contains too many ZIP entries.');
  }

  const entries: ZipEntry[] = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('DOCX ZIP directory is malformed.');
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + fileNameLength;

    if (nameEnd > buffer.length) throw new Error('DOCX ZIP entry name is malformed.');

    entries.push({
      name: buffer.subarray(nameStart, nameEnd).toString('utf-8'),
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    cursor = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function inflateZipEntry(buffer: Buffer, entry: ZipEntry) {
  if (entry.uncompressedSize > MAX_DOCX_XML_BYTES) {
    throw new Error(`DOCX entry ${entry.name} is too large to analyze safely.`);
  }

  if (
    entry.compressedSize > 0 &&
    entry.uncompressedSize > 200_000 &&
    entry.uncompressedSize / entry.compressedSize > MAX_ZIP_COMPRESSION_RATIO
  ) {
    throw new Error(`DOCX entry ${entry.name} has an unsafe compression ratio.`);
  }

  const localOffset = entry.localHeaderOffset;
  if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error(`DOCX entry ${entry.name} has an invalid local header.`);
  }

  const fileNameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataStart < 0 || dataEnd > buffer.length) {
    throw new Error(`DOCX entry ${entry.name} data is truncated.`);
  }

  const compressed = buffer.subarray(dataStart, dataEnd);
  let inflated: Buffer;

  if (entry.compressionMethod === 0) {
    inflated = Buffer.from(compressed);
  } else if (entry.compressionMethod === 8) {
    inflated = inflateRawSync(compressed, { maxOutputLength: MAX_DOCX_XML_BYTES });
  } else {
    throw new Error(`DOCX uses unsupported ZIP compression method ${entry.compressionMethod}.`);
  }

  if (inflated.length > MAX_DOCX_XML_BYTES) {
    inflated.fill(0);
    throw new Error(`DOCX entry ${entry.name} expands beyond the safe analysis limit.`);
  }

  return inflated;
}

function extractDocxText(buffer: Buffer) {
  const entries = listZipEntries(buffer);
  const desired = entries.filter((entry) =>
    /^word\/(document|footnotes|endnotes|header\d+|footer\d+)\.xml$/i.test(entry.name),
  );

  if (!desired.some((entry) => entry.name.toLowerCase() === 'word/document.xml')) {
    throw new Error('DOCX document.xml entry was not found.');
  }

  const blocks: string[] = [];
  for (const entry of desired) {
    const inflated = inflateZipEntry(buffer, entry);
    try {
      const text = wordXmlToText(inflated.toString('utf-8'));
      if (text) blocks.push(text);
    } finally {
      inflated.fill(0);
    }
  }

  const result = blocks.join('\n\n').trim();
  if (!result) throw new Error('DOCX did not contain readable text.');
  return result;
}

export function extractDocumentText(file: AttachmentPayload): ExtractedDocument {
  const { name, type } = file;
  let extracted = '';
  let buffer: Buffer | null = null;

  try {
    buffer = Buffer.from(normalizeAttachmentBase64(file.data), 'base64');

    if (isTextLike(file)) {
      extracted = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    } else if (isDocxAttachment(file)) {
      extracted = extractDocxText(buffer);
    } else if (isPdfAttachment(file)) {
      // Fallback for non-Gemini providers only. Gemini receives original PDF bytes natively.
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
    } else if (isLegacyWordBinary(file)) {
      extracted = '[Legacy .doc files are not analyzed directly. Save or export this document as DOCX, PDF, TXT, or Markdown and attach it again.]';
    } else {
      extracted = '[This attachment format is not text-extractable yet.]';
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    extracted = `[Error extracting document content: ${message}]`;
  } finally {
    buffer?.fill(0);
  }

  const isTruncated = extracted.length > MAX_DOC_CHARS;
  const truncatedText = isTruncated
    ? `${extracted.slice(0, MAX_DOC_CHARS)}\n... [Document truncated for safe context length]`
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
