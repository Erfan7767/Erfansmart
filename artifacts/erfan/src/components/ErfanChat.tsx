import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useCreateChatCompletion } from '@workspace/api-client-react';
import { Send, Trash2, X } from 'lucide-react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type StoredChat = { messages: ChatMessage[]; model?: string };
const STORAGE_KEY = 'erfan-chat-history-v1';
const MAX_HISTORY = 12;

function readStoredChat(): StoredChat {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { messages: [] };
    const parsed = JSON.parse(stored) as StoredChat;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter((item): item is ChatMessage =>
          item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string',
        ).slice(-MAX_HISTORY)
      : [];
    return { messages, model: typeof parsed.model === 'string' ? parsed.model : undefined };
  } catch {
    return { messages: [] };
  }
}

export default function ErfanChat() {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStoredChat().messages);
  const [model, setModel] = useState<string | undefined>(() => readStoredChat().model);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const mutation = useCreateChatCompletion();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pending = mutation.isPending;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, model }));
    } catch {
      // Chat remains usable if browser storage is unavailable or full.
    }
  }, [messages, model]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, pending, error]);

  const requestReply = async (history: ChatMessage[]) => {
    setError('');
    try {
      const result = await mutation.mutateAsync({ data: { messages: history.slice(-MAX_HISTORY) } });
      setModel(result.model);
      setMessages((current) => [...current, { role: 'assistant' as const, content: result.reply }].slice(-MAX_HISTORY));
    } catch {
      setError('The reply could not be generated. Your message is still here; try again.');
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;
    const next = [...messages, { role: 'user' as const, content }].slice(-MAX_HISTORY);
    setMessages(next);
    setDraft('');
    await requestReply(next);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const retry = () => {
    if (!pending && messages.length) void requestReply(messages);
  };

  const clearHistory = () => {
    if (pending) return;
    setMessages([]);
    setModel(undefined);
    setError('');
    setDraft('');
  };

  if (!open) {
    return (
      <button className="chat-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open Erfan chat" data-testid="button-open-chat">
        <span className="chat-mark" aria-hidden="true" />
        <span>Open chat</span>
      </button>
    );
  }

  return (
    <section className="chat-dock" aria-labelledby="chat-heading" data-testid="panel-erfan-chat">
      <header className="chat-head">
        <span className="chat-mark" aria-hidden="true" />
        <div className="chat-title">
          <strong id="chat-heading">Erfan chat</strong>
          <span>Personal AI command space</span>
        </div>
        <div className="chat-head-actions">
          <button
            className="chat-icon-button"
            type="button"
            onClick={clearHistory}
            disabled={pending || messages.length === 0}
            aria-label="Clear chat history"
            title="Clear chat history"
            data-testid="button-clear-chat"
          ><Trash2 size={14} aria-hidden="true" /></button>
          <button className="chat-icon-button" type="button" onClick={() => setOpen(false)} aria-label="Minimize chat" data-testid="button-minimize-chat">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="chat-notice" data-testid="text-chat-privacy">
        Messages are sent to <strong>LLM7.io</strong> to generate a reply. Do not send passwords, secrets, or sensitive personal information.
      </div>
      <div className="chat-provider" data-testid="status-chat-provider">
        <span className="chat-provider-dot" aria-hidden="true" />
        <span>Provider: <em>LLM7.io</em></span>
        <span aria-hidden="true">/</span>
        <span>Model: <em>{model || 'gpt-oss:20b'}</em></span>
      </div>

      <div className="chat-transcript" ref={transcriptRef} role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 && !pending ? (
          <div className="chat-empty" data-testid="state-chat-empty">
            <span className="chat-empty-kicker">A clear place to think</span>
            <h2>What would you like to work through?</h2>
            <p>Ask a question or share a thought. Replies are conversational only; no connected tools or actions are available here.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <article className={`chat-message ${message.role}`} key={`${index}-${message.role}`} data-testid={`message-chat-${index}`}>
              <span className="chat-role">{message.role === 'user' ? 'You' : 'Erfan'}</span>
              <div className="chat-bubble">{message.content}</div>
            </article>
          ))
        )}
        {pending && <div className="chat-pending" role="status" data-testid="status-chat-loading"><span className="chat-pulse" />Generating a reply</div>}
      </div>

      {error && (
        <div className="chat-error" role="alert" data-testid="status-chat-error">
          {error}<button type="button" onClick={retry} disabled={pending} data-testid="button-retry-chat">Retry</button>
        </div>
      )}

      <form className="chat-compose" onSubmit={submit}>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          aria-label="Message Erfan"
          rows={1}
          maxLength={4000}
          disabled={pending}
          data-testid="input-chat-message"
        />
        <button className="chat-send" type="submit" aria-label="Send message" disabled={pending || !draft.trim()} data-testid="button-send-chat">
          {pending ? <span className="chat-pulse" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
        </button>
      </form>
      <div className="chat-footnote" data-testid="text-chat-local-history">
        Recent history stays in this browser · Enter to send · Shift + Enter for a new line
      </div>
    </section>
  );
}
