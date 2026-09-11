/**
 * Chatbot Controller: chat.js
 * Interactive Chatbot Widget, Token Streaming Reader, Markdown Parser & Voice Input
 * ================================================================================= */

const STARTER_PROMPTS = [
  "What are your strongest skills?",
  "Are you open to relocation?",
  "What is your notice period?",
  "Tell me about a challenging project you solved",
  "What roles are you looking for?"
];

const STORAGE_KEY = 'ankeeth_chat_session_history';

// State container
const state = {
  isOpen: false,
  isStreaming: false,
  isListening: false,
  messages: [], // Array of { role: 'user' | 'assistant', content: string }
  recognition: null,
};

/**
 * Escapes HTML entities to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Safe markdown parser for streamed bot responses
 * Handles [links](url), [emails](mailto:...), **bold**, *italic*, and linebreaks
 */
export function parseMarkdown(markdownText) {
  if (!markdownText) return '';

  // 1. Escape raw HTML first
  let html = escapeHtml(markdownText);

  // 2. Parse Markdown Links: [Link Text](https://... or mailto:... or /...)
  // Only allow http, https, mailto, and relative site paths for safety
  html = html.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^\s\)]+)\)/g, (match, label, url) => {
    const isMail = url.startsWith('mailto:');
    const targetAttr = isMail ? '' : ' target="_blank" rel="noopener noreferrer"';
    return `<a href="${url}"${targetAttr}>${label}</a>`;
  });

  // 3. Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 4. Italic: *text*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 5. Linebreaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

/**
 * Loads conversation history from tab's sessionStorage
 */
function loadSessionHistory() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        state.messages = parsed;
      }
    }
  } catch (err) {
    console.warn('Unable to load chat history from sessionStorage:', err);
  }
}

/**
 * Persists conversation history to tab's sessionStorage
 */
function saveSessionHistory() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages));
  } catch (err) {
    console.warn('Unable to save chat history to sessionStorage:', err);
  }
}

/**
 * Clears conversation history
 */
function clearSessionHistory() {
  state.messages = [];
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Unable to clear chat history:', err);
  }
  renderMessages();
}

/**
 * Mounts chat widget markup into container
 */
function mountChatWidget(container) {
  container.innerHTML = `
    <!-- Floating Launcher Button -->
    <button id="chat-launcher-btn" class="chat-launcher" aria-label="Chat with Ankeeth AI" aria-expanded="false" title="Chat with Ankeeth AI">
      <div class="chat-launcher-icon-open">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <div class="chat-launcher-icon-close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>
      <span class="chat-launcher-badge" aria-hidden="true"></span>
    </button>

    <!-- Chat Window Drawer -->
    <section id="chat-window" class="chat-window" aria-label="Interactive AI Assistant" role="dialog" aria-modal="true" aria-hidden="true">
      <!-- Header -->
      <header class="chat-header">
        <div class="chat-header-left">
          <div class="chat-avatar-wrapper">
            <img src="/assets/placeholder-avatar.svg" alt="Ankeeth V" class="chat-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <span class="chat-avatar-fallback" style="display:none;">AV</span>
            <span class="chat-status-dot" title="Online"></span>
          </div>
          <div class="chat-header-info">
            <span class="chat-header-title">Ask Ankeeth AI</span>
            <span class="chat-header-subtitle">
              <span>●</span> Online • Powered by LLaMA 3.3
            </span>
          </div>
        </div>
        <div class="chat-header-actions">
          <button id="chat-clear-btn" class="chat-action-btn" title="Reset conversation" aria-label="Reset conversation">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </button>
          <button id="chat-close-btn" class="chat-action-btn" title="Close chat" aria-label="Close chat">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </header>

      <!-- Messages Stream Area -->
      <div id="chat-messages" class="chat-messages" role="log" aria-live="polite">
        <!-- Rendered dynamically -->
      </div>

      <!-- Input Bar -->
      <form id="chat-form" class="chat-input-bar">
        <input
          type="text"
          id="chat-input"
          class="chat-input-field"
          placeholder="Ask about skills, experience, projects..."
          autocomplete="off"
          maxlength="500"
          aria-label="Message for Ankeeth AI"
        />
        <button
          type="button"
          id="chat-mic-btn"
          class="chat-mic-btn"
          title="Voice input (Speech to text)"
          aria-label="Toggle voice input"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </button>
        <button
          type="submit"
          id="chat-send-btn"
          class="chat-send-btn"
          title="Send message"
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </section>
  `;
}

/**
 * Scroll chat messages container smoothly to the bottom
 */
function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Renders all messages and welcome card / starters if empty
 */
function renderMessages() {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  messagesEl.innerHTML = '';

  // 1. Welcome Card
  const welcomeCard = document.createElement('div');
  welcomeCard.className = 'chat-welcome-card';
  welcomeCard.innerHTML = `
    <h3 class="chat-welcome-greeting">Hello! I'm Ankeeth's AI Assistant.</h3>
    <p class="chat-welcome-desc">
      Ask me anything about Ankeeth's technical skills, professional experience, data analytics projects, or availability.
    </p>
    <div class="chat-starters">
      <span class="chat-starters-label">Suggested Questions:</span>
      <div class="chat-starters-grid" id="chat-starters-container"></div>
    </div>
  `;
  messagesEl.appendChild(welcomeCard);

  // Render starter chips
  const startersGrid = welcomeCard.querySelector('#chat-starters-container');
  STARTER_PROMPTS.forEach((prompt) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chat-chip';
    chip.textContent = prompt;
    chip.addEventListener('click', () => {
      handleUserSubmit(prompt);
    });
    startersGrid.appendChild(chip);
  });

  // 2. Render previous messages
  state.messages.forEach((msg) => {
    appendMessageBubble(msg.role, msg.content, false);
  });

  scrollToBottom();
}

/**
 * Appends a message bubble to DOM
 */
function appendMessageBubble(role, content, shouldScroll = true) {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return null;

  const row = document.createElement('div');
  row.className = `chat-msg-row ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';

  if (role === 'user') {
    bubble.textContent = content;
  } else {
    bubble.innerHTML = parseMarkdown(content);
  }

  row.appendChild(bubble);
  messagesEl.appendChild(row);

  if (shouldScroll) {
    scrollToBottom();
  }

  return bubble;
}

/**
 * Appends typing indicator
 */
function showTypingIndicator() {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return null;

  const row = document.createElement('div');
  row.className = 'chat-msg-row assistant chat-typing-wrapper';
  row.id = 'chat-typing-row';

  const indicator = document.createElement('div');
  indicator.className = 'chat-typing-indicator';
  indicator.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;

  row.appendChild(indicator);
  messagesEl.appendChild(row);
  scrollToBottom();

  return row;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('chat-typing-row');
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Sends a message and consumes the SSE streaming response
 */
async function handleUserSubmit(text) {
  if (!text || !text.trim() || state.isStreaming) return;

  const userText = text.trim();
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');

  if (inputEl) inputEl.value = '';
  if (sendBtn) sendBtn.disabled = true;

  // 1. Add user message
  state.messages.push({ role: 'user', content: userText });
  appendMessageBubble('user', userText);
  saveSessionHistory();

  // 2. Show typing indicator
  state.isStreaming = true;
  showTypingIndicator();

  // Prepare history payload (last 6 messages excluding current)
  const historyPayload = state.messages.slice(0, -1).slice(-6);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userText,
        history: historyPayload,
      }),
    });

    removeTypingIndicator();

    if (!response.ok) {
      let errorMessage = 'Unable to complete request. Please try again.';
      try {
        const errData = await response.json();
        if (errData.error) {
          errorMessage = errData.error;
        }
      } catch (_) {}

      // Rate limit or error bubble
      const errorBubble = appendMessageBubble('assistant', errorMessage);
      state.messages.push({ role: 'assistant', content: errorMessage });
      saveSessionHistory();
      return;
    }

    // 3. Prepare streaming response bubble
    const messagesEl = document.getElementById('chat-messages');
    const row = document.createElement('div');
    row.className = 'chat-msg-row assistant';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    row.appendChild(bubble);
    messagesEl.appendChild(row);

    let accumulatedText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.replace(/^data:\s*/, '');
        if (dataStr === '[DONE]') {
          break;
        }

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.content) {
            accumulatedText += parsed.content;
            bubble.innerHTML = parseMarkdown(accumulatedText) + '<span class="typing-cursor"></span>';
            scrollToBottom();
          } else if (parsed.error) {
            accumulatedText += `\n*${parsed.error}*`;
            bubble.innerHTML = parseMarkdown(accumulatedText);
          }
        } catch (_) {
          // In case raw string was pushed
          if (dataStr) {
            accumulatedText += dataStr;
            bubble.innerHTML = parseMarkdown(accumulatedText) + '<span class="typing-cursor"></span>';
            scrollToBottom();
          }
        }
      }
    }

    // Finalize bubble without cursor
    bubble.innerHTML = parseMarkdown(accumulatedText);
    state.messages.push({ role: 'assistant', content: accumulatedText });
    saveSessionHistory();
    scrollToBottom();

  } catch (err) {
    console.error('Chat stream error:', err);
    removeTypingIndicator();
    const fallbackMsg = "I'm having trouble connecting right now. Please check your connection or reach Ankeeth directly at [ankeeth.v@gmail.com](mailto:ankeeth.v@gmail.com).";
    appendMessageBubble('assistant', fallbackMsg);
    state.messages.push({ role: 'assistant', content: fallbackMsg });
    saveSessionHistory();
  } finally {
    state.isStreaming = false;
    if (sendBtn) sendBtn.disabled = false;
    if (inputEl) inputEl.focus();
  }
}

/**
 * Initializes Web Speech API voice input
 */
function initSpeechRecognition() {
  const micBtn = document.getElementById('chat-mic-btn');
  const inputEl = document.getElementById('chat-input');
  if (!micBtn || !inputEl) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title = 'Voice input not supported in this browser';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  state.recognition = recognition;

  recognition.onstart = () => {
    state.isListening = true;
    micBtn.classList.add('is-recording');
    micBtn.setAttribute('aria-pressed', 'true');
    inputEl.setAttribute('placeholder', 'Listening... Speak now');
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    inputEl.value = transcript;
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    stopListening();
  };

  recognition.onend = () => {
    stopListening();
  };

  function stopListening() {
    state.isListening = false;
    micBtn.classList.remove('is-recording');
    micBtn.setAttribute('aria-pressed', 'false');
    inputEl.setAttribute('placeholder', 'Ask about skills, experience, projects...');
  }

  micBtn.addEventListener('click', () => {
    if (state.isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.warn('Speech recognition start failed:', err);
      }
    }
  });
}

/**
 * Toggles Chat Window Drawer
 */
export function toggleChat(forceOpen) {
  const windowEl = document.getElementById('chat-window');
  const launcherBtn = document.getElementById('chat-launcher-btn');
  const inputEl = document.getElementById('chat-input');

  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !state.isOpen;
  state.isOpen = shouldOpen;

  if (windowEl && launcherBtn) {
    if (shouldOpen) {
      windowEl.classList.add('is-open');
      windowEl.setAttribute('aria-hidden', 'false');
      launcherBtn.classList.add('is-active');
      launcherBtn.setAttribute('aria-expanded', 'true');
      scrollToBottom();
      setTimeout(() => {
        if (inputEl) inputEl.focus();
      }, 150);
    } else {
      windowEl.classList.remove('is-open');
      windowEl.setAttribute('aria-hidden', 'true');
      launcherBtn.classList.remove('is-active');
      launcherBtn.setAttribute('aria-expanded', 'false');
      if (state.isListening && state.recognition) {
        state.recognition.stop();
      }
    }
  }
}

/**
 * Main Chat Initializer
 */
export function initChat() {
  const root = document.getElementById('chat-widget-root');
  if (!root) {
    console.warn('#chat-widget-root container missing from DOM');
    return;
  }

  // 1. Mount HTML
  mountChatWidget(root);

  // 2. Load and render session messages
  loadSessionHistory();
  renderMessages();

  // 3. Setup Events
  const launcherBtn = document.getElementById('chat-launcher-btn');
  const closeBtn = document.getElementById('chat-close-btn');
  const clearBtn = document.getElementById('chat-clear-btn');
  const form = document.getElementById('chat-form');
  const inputEl = document.getElementById('chat-input');

  if (launcherBtn) {
    launcherBtn.addEventListener('click', () => toggleChat());
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => toggleChat(false));
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Reset chat history?')) {
        clearSessionHistory();
      }
    });
  }

  if (form && inputEl) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleUserSubmit(inputEl.value);
    });
  }

  // Keyboard shortcut: Escape to close chat
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isOpen) {
      toggleChat(false);
    }
  });

  // 4. Initialize Speech Recognition
  initSpeechRecognition();
}
