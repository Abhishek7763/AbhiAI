const fs = require('fs');
let content = fs.readFileSync('components/chat-application.tsx', 'utf8');

const base64Helper = `
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = (error) => reject(error);
    });
  };
`;

content = content.replace(
  `const handleSuggestionClick = (text: string) => {`,
  base64Helper + `\n  const handleSuggestionClick = (text: string) => {`
);

const handleSubmitReplace = `const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    
    setIsLoading(true);
    
    // Process attachments
    const processedAttachments = await Promise.all(
      attachments.map(async (file) => ({
        name: file.name,
        type: file.type,
        data: await fileToBase64(file)
      }))
    );

    const userMessage: any = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input,
      attachments: processedAttachments 
    };
    
    const newMessages = [...messages, userMessage];
    
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = createSession(newMessages);
    } else {
      updateSession(activeSessionId, newMessages);
    }

    setInput('');
    setAttachments([]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const assistantMessage: any = { id: Date.now().toString(), role: 'assistant', content: data.text };
      updateSession(activeSessionId, [...newMessages, assistantMessage]);
    } catch (err) {
      console.error(err);
      const errorMessage: any = { id: Date.now().toString(), role: 'assistant', content: "Error: Could not generate a response." };
      updateSession(activeSessionId, [...newMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };`;

content = content.replace(
  /const handleSubmit = async.*?finally \{\s*setIsLoading\(false\);\s*\}\s*\};/s,
  handleSubmitReplace
);

// We need to render the attachments in the chat history
const renderAttachments = `
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 mt-1">
                      {m.attachments.map((att: any, idx: number) => (
                        att.type.startsWith('image/') ? (
                          <img key={idx} src={\`data:\${att.type};base64,\${att.data}\`} alt={att.name} className="h-32 w-auto object-cover rounded-xl border border-zinc-200 dark:border-zinc-700" />
                        ) : (
                          <div key={idx} className="flex items-center gap-2 bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs">
                            <File className="w-4 h-4 text-zinc-500" />
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">{att.name}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>
`;

content = content.replace(
  /<p className="whitespace-pre-wrap text-\[15px\] leading-relaxed">\{m\.content\}<\/p>/g,
  renderAttachments
);

fs.writeFileSync('components/chat-application.tsx', content);
