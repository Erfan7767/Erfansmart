import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useCreateChatCompletion } from '@workspace/api-client-react';
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX, X } from 'lucide-react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type StoredChat = { messages: ChatMessage[]; model?: string };
type BrowserSpeechResult = { isFinal: boolean; [index: number]: { transcript: string } };
type BrowserSpeechEvent = { resultIndex: number; results: ArrayLike<BrowserSpeechResult> };
type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};
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
  const [voiceError, setVoiceError] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(false);
  const mutation = useCreateChatCompletion();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const draftBeforeVoiceRef = useRef('');
  const finalTranscriptRef = useRef('');
  const voiceRepliesRef = useRef(false);
  const pending = mutation.isPending;
  const browserWindow = typeof window === 'undefined' ? null : window as SpeechWindow;
  const SpeechRecognitionConstructor = browserWindow?.SpeechRecognition ?? browserWindow?.webkitSpeechRecognition;
  const speechPlaybackAvailable = Boolean(
    browserWindow
      && 'speechSynthesis' in browserWindow
      && typeof SpeechSynthesisUtterance !== 'undefined',
  );

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

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  const cancelVoiceInput = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
    recognitionRef.current = null;
    setListening(false);
  };

  const startVoiceInput = () => {
    if (!SpeechRecognitionConstructor) {
      setVoiceError('Live speech recognition is not supported in this browser. You can still type your message.');
      return;
    }
    if (pending || listening || recognitionRef.current) return;

    setVoiceError('');
    finalTranscriptRef.current = '';
    draftBeforeVoiceRef.current = draft.trim();
    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? '';
        if (result?.isFinal) finalTranscriptRef.current += `${finalTranscriptRef.current ? ' ' : ''}${transcript.trim()}`;
        else interim += transcript;
      }
      const nextDraft = [
        draftBeforeVoiceRef.current,
        finalTranscriptRef.current,
        interim.trim(),
      ].filter(Boolean).join(' ');
      setDraft(nextDraft);
    };
    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone permission was denied. Allow microphone access or type your message.',
        'service-not-allowed': 'The browser speech service is unavailable. You can still type your message.',
        'no-speech': 'No speech was detected. Try again or type your message.',
        'audio-capture': 'No microphone was found. Connect a microphone or type your message.',
        network: 'The browser speech service could not connect. You can still type your message.',
      };
      setVoiceError(messages[event.error] ?? 'Voice input stopped unexpectedly. You can still type your message.');
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      const spokenMessage = [draftBeforeVoiceRef.current, finalTranscriptRef.current]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (finalTranscriptRef.current.trim() && spokenMessage) {
        setDraft(spokenMessage);
        void sendMessage(spokenMessage);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      if (speechPlaybackAvailable) {
        voiceRepliesRef.current = true;
        setVoiceRepliesEnabled(true);
      }
      window.speechSynthesis?.cancel();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceError('The microphone could not start. Check browser permissions and try again.');
    }
  };

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const speakReply = (content: string) => {
    if (!speechPlaybackAvailable || typeof window === 'undefined') {
      setVoiceError('Spoken replies are not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = /[\u0600-\u06ff]/i.test(content) ? 'ar' : (navigator.language || 'en-US');
    utterance.onerror = () => setVoiceError('The spoken reply could not be played. The text reply is still available.');
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoiceReplies = () => {
    const nextEnabled = !voiceRepliesEnabled;
    voiceRepliesRef.current = nextEnabled;
    setVoiceRepliesEnabled(nextEnabled);
    setVoiceError('');
    if (!nextEnabled) window.speechSynthesis?.cancel();
  };

  const requestReply = async (history: ChatMessage[]) => {
    setError('');
    try {
      const result = await mutation.mutateAsync({ data: { messages: history.slice(-MAX_HISTORY) } });
      setModel(result.model);
      setMessages((current) => [...current, { role: 'assistant' as const, content: result.reply }].slice(-MAX_HISTORY));
      if (voiceRepliesRef.current) speakReply(result.reply);
    } catch {
      setError('The reply could not be generated. Your message is still here; try again.');
    }
  };

  const sendMessage = async (content: string) => {
    if (!content || pending) return;
    const next = [...messages, { role: 'user' as const, content }].slice(-MAX_HISTORY);
    setMessages(next);
    setDraft('');
    await requestReply(next);
    inputRef.current?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (listening) return;
    const content = draft.trim();
    await sendMessage(content);
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
    cancelVoiceInput();
    window.speechSynthesis?.cancel();
    setMessages([]);
    setModel(undefined);
    setError('');
    setDraft('');
  };

  const minimizeChat = () => {
    cancelVoiceInput();
    window.speechSynthesis?.cancel();
    setOpen(false);
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
            onClick={toggleVoiceReplies}
            disabled={!speechPlaybackAvailable}
            aria-label={voiceRepliesEnabled ? 'Turn off spoken replies' : 'Turn on spoken replies'}
            aria-pressed={voiceRepliesEnabled}
            title={speechPlaybackAvailable ? (voiceRepliesEnabled ? 'Spoken replies on' : 'Spoken replies off') : 'Spoken replies are not supported'}
            data-testid="button-toggle-spoken-replies"
          >{voiceRepliesEnabled ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}</button>
          <button
            className="chat-icon-button"
            type="button"
            onClick={clearHistory}
            disabled={pending || messages.length === 0}
            aria-label="Clear chat history"
            title="Clear chat history"
            data-testid="button-clear-chat"
          ><Trash2 size={14} aria-hidden="true" /></button>
          <button className="chat-icon-button" type="button" onClick={minimizeChat} aria-label="Minimize chat" data-testid="button-minimize-chat">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="chat-notice" data-testid="text-chat-privacy">
        Messages are sent to <strong>LLM7.io</strong> to generate a reply. Do not send passwords, secrets, or sensitive personal information.
        <span className="chat-voice-privacy">Your browser's speech service processes microphone input. Erfan receives the transcript and sends only text to LLM7.io; this app does not record or store audio.</span>
      </div>
      <div className="chat-provider" data-testid="status-chat-provider">
        <span className="chat-provider-dot" aria-hidden="true" />
        <span>Provider: <em>LLM7.io</em></span>
        <span aria-hidden="true">/</span>
        <span>Model: <em>{model || 'gpt-oss:20b'}</em></span>
        <span>App cap: <em>20/min shared</em></span>
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
      {voiceError && <div className="chat-voice-error" role="status" data-testid="status-chat-voice-error">{voiceError}</div>}

      <form className="chat-compose" onSubmit={submit}>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setVoiceError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          aria-label="Message Erfan"
          rows={1}
          maxLength={4000}
          disabled={pending}
          data-testid="input-chat-message"
        />
        <button
          className={`chat-voice-button${listening ? ' listening' : ''}`}
          type="button"
          onClick={listening ? stopVoiceInput : startVoiceInput}
          disabled={pending}
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          aria-pressed={listening}
          title={listening ? 'Stop listening and send this voice turn' : 'Speak; your message sends automatically after a pause'}
          data-testid="button-chat-microphone"
        >{listening ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}</button>
        <button className="chat-send" type="submit" aria-label="Send message" disabled={pending || listening || !draft.trim()} data-testid="button-send-chat">
          {pending ? <span className="chat-pulse" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
        </button>
      </form>
      <div className="chat-footnote" data-testid="text-chat-local-history">
        {listening ? 'Listening — live transcript appears above and sends after a pause' : 'History stays in this browser · Enter to send · Shift + Enter for a new line'}
      </div>
    </section>
  );
}
