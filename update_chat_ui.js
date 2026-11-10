const fs = require('fs');
let content = fs.readFileSync('components/chat-application.tsx', 'utf8');

if (!content.includes('Paperclip')) {
    content = content.replace(
      `import { Menu, BookOpen, Edit3, Code, Bot, User, Send, Loader2, Sparkles } from 'lucide-react';`,
      `import { Menu, BookOpen, Edit3, Code, Bot, User, Send, Loader2, Sparkles, Paperclip, X, File, Image as ImageIcon } from 'lucide-react';`
    );
}

// Add state for attachments
content = content.replace(
  `  const [input, setInput] = useState('');`,
  `  const [input, setInput] = useState('');\n  const [attachments, setAttachments] = useState<File[]>([]);\n  const fileInputRef = useRef<HTMLInputElement>(null);`
);

// Handle file selection
const handleFileChange = `
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };
`;

content = content.replace(
  `  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {`,
  handleFileChange + `\n  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {`
);

// Update handleSubmit to include attachments if we want (for now just clear them, next we implement base64)
content = content.replace(
  `const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };`,
  `const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input + (attachments.length > 0 ? '\\n[Attached ' + attachments.length + ' files]' : '') };`
);

content = content.replace(
  `setInput('');\n    setIsLoading(true);`,
  `setInput('');\n    setAttachments([]);\n    setIsLoading(true);`
);

// Add the file input and preview UI to the form
const formUI = `
            <form onSubmit={handleSubmit} className="relative flex flex-col bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-1.5 focus-within:ring-2 focus-within:ring-zinc-900 dark:focus-within:ring-zinc-100 transition-all">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 border-b border-zinc-200 dark:border-zinc-800">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs">
                      {file.type.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> : <File className="w-3.5 h-3.5 text-orange-500" />}
                      <span className="max-w-[100px] truncate text-zinc-700 dark:text-zinc-300 font-medium">{file.name}</span>
                      <button type="button" onClick={() => removeAttachment(idx)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mb-1 ml-1 w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-full transition-colors shrink-0"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  className="hidden" 
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
                <textarea
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={onKeyDown}
                  placeholder="Ask AbhiAI anything..."
                  disabled={isLoading}
                  className="flex-1 max-h-32 min-h-[44px] pl-2 pr-2 py-3 bg-transparent resize-none focus:outline-none text-[15px] text-zinc-900 dark:text-zinc-100 leading-relaxed disabled:opacity-50"
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={isLoading || (!input.trim() && attachments.length === 0)}
                  className="mb-1 mr-1 w-10 h-10 flex items-center justify-center bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-full transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                </button>
              </div>
            </form>
`;

content = content.replace(
  /<form onSubmit={handleSubmit}.*?<\/form>/s,
  formUI.trim()
);

fs.writeFileSync('components/chat-application.tsx', content);
