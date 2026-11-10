const fs = require('fs');
let content = fs.readFileSync('hooks/use-chat-history.ts', 'utf8');

content = content.replace(
  `export interface Message {`,
  `export interface Attachment {\n  name: string;\n  type: string;\n  data: string;\n}\n\nexport interface Message {`
);

content = content.replace(
  `  content: string;\n}`,
  `  content: string;\n  attachments?: Attachment[];\n}`
);

fs.writeFileSync('hooks/use-chat-history.ts', content);
