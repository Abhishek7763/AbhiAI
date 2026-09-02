const fs = require('fs');
let content = fs.readFileSync('components/chat-application.tsx', 'utf8');

// Add selected model state
content = content.replace(
  `const [attachments, setAttachments] = useState<File[]>([]);`,
  `const [attachments, setAttachments] = useState<File[]>([]);\n  const [selectedModel, setSelectedModel] = useState<string>('');`
);

// Add to fetch payload
content = content.replace(
  `body: JSON.stringify({ messages: newMessages })`,
  `body: JSON.stringify({ messages: newMessages, modelAlias: selectedModel })`
);

// Update ModelSelector prop
content = content.replace(
  `<ModelSelector />`,
  `<ModelSelector onModelSelect={setSelectedModel} />`
);

fs.writeFileSync('components/chat-application.tsx', content);
