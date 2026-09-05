# Phase 16 — Document Support

Status: **Implemented on `improve/abhiai-stability`; completion requires Verify CI success.**

## Scope from the master plan

- PDF
- TXT
- Markdown
- DOCX
- CSV where practical
- File validation
- Temporary/request-scoped handling and cleanup
- Safe document analysis

Acceptance criterion: **Documents can be analyzed safely.**

## Delivered

### Supported document paths

- **PDF**: remains Gemini-native when available so page layout, tables, diagrams, and embedded images are preserved. A conservative text fallback remains for non-Gemini execution.
- **TXT / Markdown / CSV**: decoded as UTF-8 server-side and injected into bounded document context.
- **DOCX**: real server-side extraction from the DOCX ZIP package, including the main document plus headers, footers, footnotes, and endnotes when present.
- Existing text/code formats remain supported (JSON, JS/TS, Python, SQL, HTML, CSS, YAML, XML, etc.).
- Legacy `.doc` receives a clear conversion message instead of pretending extraction succeeded.

### Safety controls

- Maximum 4 inline attachments per chat message.
- Maximum ~2 MB per attachment.
- Maximum ~2.8 MB combined attachment payload.
- PDF and DOCX magic/signature checks to reject obvious extension/MIME spoofing.
- DOCX central-directory validation.
- DOCX ZIP entry-count limit.
- DOCX expanded XML byte limit.
- ZIP compression-ratio guard against decompression bombs.
- Bounded extracted document context (30,000 characters per document).
- Large documents are explicitly truncated for safe context length rather than blindly forwarded.
- Request-scoped decoded buffers are best-effort zero-filled after extraction; this module does not persist uploaded document bytes.
- No new public upload-storage endpoint is introduced.

### Routing behavior

- PDF stays on Gemini-native routing because generic text extraction loses layout/visual information.
- DOCX/TXT/MD/CSV are extracted into text and can be analyzed by the normal AbhiAI smart-routing/failover pool.
- Existing web search, streaming, image support, failover, usage logging, security guards, and runtime health behavior remain unchanged.

## Automated coverage

`tests/document-extractor.test.mts` verifies:

1. UTF-8 text/Markdown extraction.
2. DOCX ZIP + WordprocessingML extraction.
3. DOCX signature spoof rejection.
4. PDF signature spoof rejection.
5. Single-file size protection.

## Completion gate

Phase 16 is complete when the repository Verify workflow succeeds on the Phase 16 commit:

1. TypeScript typecheck
2. ESLint
3. Node tests
4. Next.js production build

No production `main` merge is part of this phase.
