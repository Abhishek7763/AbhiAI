const fs = require('fs');
const content = fs.readFileSync('components/chat-application.tsx', 'utf8');

let newContent = content.replace(
  `import ModelSelector from './chat/model-selector';`,
  `import ModelSelector from './chat/model-selector';\nimport { useChatHistory, Message } from '@/hooks/use-chat-history';`
);

newContent = newContent.replace(
  `  const [messages, setMessages] = useState<any[]>([]);\n  const [input, setInput] = useState('');`,
  `  const [input, setInput] = useState('');\n  const {\n    sessions,\n    currentSessionId,\n    currentMessages: messages,\n    setCurrentSessionId,\n    createSession,\n    updateSession,\n    deleteSession,\n    startNewChat\n  } = useChatHistory();`
);

newContent = newContent.replace(
  `const newMessages = [...messages, { id: Date.now().toString(), role: 'user', content: input }];\n    setMessages(newMessages);\n    setInput('');\n    setIsLoading(true);`,
  `const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };\n    const newMessages = [...messages, userMessage];\n    \n    let activeSessionId = currentSessionId;\n    if (!activeSessionId) {\n      activeSessionId = createSession(newMessages);\n    } else {\n      updateSession(activeSessionId, newMessages);\n    }\n\n    setInput('');\n    setIsLoading(true);`
);

newContent = newContent.replace(
  `setMessages([...newMessages, { id: Date.now().toString(), role: 'assistant', content: data.text }]);`,
  `const assistantMessage: Message = { id: Date.now().toString(), role: 'assistant', content: data.text };\n      updateSession(activeSessionId, [...newMessages, assistantMessage]);`
);

newContent = newContent.replace(
  `setMessages([...newMessages, { id: Date.now().toString(), role: 'assistant', content: "Error: Could not generate a response. Make sure the API key is valid." }]);`,
  `const errorMessage: Message = { id: Date.now().toString(), role: 'assistant', content: "Error: Could not generate a response. Make sure the API key is valid." };\n      updateSession(activeSessionId, [...newMessages, errorMessage]);`
);

newContent = newContent.replace(
  `<Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />`,
  `<Sidebar \n        isOpen={sidebarOpen} \n        onClose={() => setSidebarOpen(false)} \n        sessions={sessions}\n        currentSessionId={currentSessionId}\n        onSelectSession={setCurrentSessionId}\n        onNewChat={startNewChat}\n        onDeleteSession={deleteSession}\n      />`
);

fs.writeFileSync('components/chat-application.tsx', newContent);
console.log('updated');
