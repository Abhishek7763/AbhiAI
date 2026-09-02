/**
 * AbhiAI Document & Attachment Extractor (Phase 16 - Document Support)
 * Extracts textual content from TXT, MD, CSV, JSON, Source Code, and PDF files.
 */

export interface ExtractedDocument {
  name: string;
  mimeType: string;
  text: string;
  charCount: number;
  isTruncated: boolean;
}

const MAX_DOC_CHARS = 30000; // Safe token limit for fast inference

export function extractDocumentText(file: { name: string; type: string; data: string }): ExtractedDocument {
  const { name, type, data } = file;
  let extracted = '';
  
  try {
    // Decode base64 to binary buffer/string
    const buffer = Buffer.from(data, 'base64');

    if (
      type.startsWith('text/') ||
      type.includes('json') ||
      type.includes('javascript') ||
      type.includes('typescript') ||
      type.includes('csv') ||
      name.endsWith('.txt') ||
      name.endsWith('.md') ||
      name.endsWith('.csv') ||
      name.endsWith('.json') ||
      name.endsWith('.ts') ||
      name.endsWith('.tsx') ||
      name.endsWith('.js') ||
      name.endsWith('.py') ||
      name.endsWith('.sql') ||
      name.endsWith('.html') ||
      name.endsWith('.css') ||
      name.endsWith('.yaml') ||
      name.endsWith('.yml') ||
      name.endsWith('.env') ||
      name.endsWith('.xml')
    ) {
      extracted = buffer.toString('utf-8');
    } else if (type.includes('pdf') || name.endsWith('.pdf')) {
      // Basic text stream extractor from PDF raw buffer
      const rawPdf = buffer.toString('binary');
      // Extract text inside PDF stream objects between BT (Begin Text) and ET (End Text) or Tj/TJ tokens
      const textMatches = rawPdf.match(/\((?:[^\\()]+|\\.)*\)\s*Tj|\[(?:[^[\]]*|\((?:[^\\()]+|\\.)*\))*\]\s*TJ/g);
      
      if (textMatches && textMatches.length > 0) {
        const textParts: string[] = [];
        for (const token of textMatches) {
          const literalMatches = token.match(/\(([^)]+)\)/g);
          if (literalMatches) {
            for (const lm of literalMatches) {
              const cleaned = lm.slice(1, -1).replace(/\\([()\\])/g, '$1');
              if (cleaned.trim()) textParts.push(cleaned);
            }
          }
        }
        extracted = textParts.join(' ');
      } else {
        // Fallback: extract readable ascii strings
        const asciiOnly = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
        const cleanedLines = asciiOnly.split('\n').filter(l => l.trim().length > 3).slice(0, 500);
        extracted = cleanedLines.join('\n');
      }
    } else {
      // General text fallback
      extracted = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    }
  } catch (err: any) {
    extracted = `[Error extracting document content: ${err?.message || 'Unknown error'}]`;
  }

  const isTruncated = extracted.length > MAX_DOC_CHARS;
  const truncatedText = isTruncated ? extracted.slice(0, MAX_DOC_CHARS) + '\n... [Document truncated for length]' : extracted;

  return {
    name,
    mimeType: type,
    text: truncatedText,
    charCount: truncatedText.length,
    isTruncated
  };
}

export function formatDocumentsForPrompt(attachments: Array<{ name: string; type: string; data: string }>): string {
  if (!attachments || attachments.length === 0) return '';
  
  const docAttachments = attachments.filter(a => !a.type.startsWith('image/'));
  if (docAttachments.length === 0) return '';

  const docBlocks = docAttachments.map(doc => {
    const extracted = extractDocumentText(doc);
    return `--- ATTACHED DOCUMENT: ${extracted.name} (${extracted.mimeType}) ---\n${extracted.text}\n--- END OF DOCUMENT: ${extracted.name} ---`;
  });

  return `\n\n[USER ATTACHED DOCUMENTS]:\n` + docBlocks.join('\n\n');
}
