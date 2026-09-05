import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import {
  extractDocumentText,
  validateInlineAttachments,
  type AttachmentPayload,
} from '../lib/files/document-extractor.ts';

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeSingleEntryZip(name: string, content: string) {
  const nameBytes = Buffer.from(name);
  const raw = Buffer.from(content);
  const compressed = deflateRawSync(raw);
  const crc = crc32(raw);

  const local = Buffer.alloc(30 + nameBytes.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  nameBytes.copy(local, 30);

  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  nameBytes.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length + compressed.length, 16);

  return Buffer.concat([local, compressed, central, eocd]);
}

function attachment(name: string, type: string, bytes: Buffer): AttachmentPayload {
  return { name, type, data: bytes.toString('base64') };
}

test('TXT, Markdown and CSV-style text decode as UTF-8', () => {
  const txt = attachment('notes.md', 'text/markdown', Buffer.from('# Heading\nhello,world'));
  const extracted = extractDocumentText(txt);
  assert.match(extracted.text, /Heading/);
  assert.match(extracted.text, /hello,world/);
  assert.equal(extracted.isTruncated, false);
});

test('DOCX text is extracted from word/document.xml', () => {
  const xml = '<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Hello DOCX</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell B</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
  const zip = makeSingleEntryZip('word/document.xml', xml);
  const docx = attachment('sample.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip);

  assert.equal(validateInlineAttachments([docx]), null);
  const extracted = extractDocumentText(docx);
  assert.match(extracted.text, /Hello DOCX/);
  assert.match(extracted.text, /Cell A/);
  assert.match(extracted.text, /Cell B/);
});

test('spoofed DOCX payload is rejected by file signature validation', () => {
  const fake = attachment('fake.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from('not a zip file'));
  assert.match(validateInlineAttachments([fake]) || '', /does not look like a valid DOCX/i);
});

test('spoofed PDF payload is rejected by file signature validation', () => {
  const fake = attachment('fake.pdf', 'application/pdf', Buffer.from('not a pdf'));
  assert.match(validateInlineAttachments([fake]) || '', /does not look like a valid PDF/i);
});

test('oversized single attachment is rejected before model context construction', () => {
  const huge = attachment('huge.txt', 'text/plain', Buffer.alloc(2_050_000, 97));
  assert.match(validateInlineAttachments([huge]) || '', /too large for inline analysis/i);
});
