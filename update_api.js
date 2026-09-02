const fs = require('fs');
let content = fs.readFileSync('app/api/chat/route.ts', 'utf8');

const target = `      const contents = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));`;

const replacement = `      const contents = messages.map((m: any) => {
        const parts: any[] = [];
        if (m.content) {
          parts.push({ text: m.content });
        }
        if (m.attachments && m.attachments.length > 0) {
          for (const att of m.attachments) {
            parts.push({
              inlineData: {
                data: att.data,
                mimeType: att.type
              }
            });
          }
        }
        if (parts.length === 0) {
           parts.push({ text: " " });
        }
        return {
          role: m.role === 'user' ? 'user' : 'model',
          parts
        };
      });`;

content = content.replace(target, replacement);
fs.writeFileSync('app/api/chat/route.ts', content);
