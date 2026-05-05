/**
 * ChatPilot - AI Chat Widget
 * Groq-powered, multi-turn, markdown-capable chat widget
 * @version 2.0.0
 * @year 2025
 * @license MIT
 */

(function(window, document) {
  'use strict';

  // Phrases that trigger human handoff
  const HANDOFF_TRIGGERS = [
    'speak to a human', 'talk to a human', 'speak to someone', 'talk to someone',
    'real person', 'human agent', 'live agent', 'live chat', 'contact support',
    'speak to support', 'talk to support', 'human support', 'contact a person',
    'speak to the team', 'talk to the team', 'reach the team', 'contact team',
    'i need help from a person', 'connect me to a human', 'connect me with someone'
  ];

  // Configuration defaults
  const DEFAULTS = {
    apiKey: '',
    assistantName: 'Assistant',
    systemPrompt: 'You are a helpful, knowledgeable, and friendly AI assistant. You give clear, accurate, and thoughtful responses. You are concise but thorough — you never leave the user confused. You adapt your tone to match the conversation.',
    welcomeMessage: 'Hi there! How can I help you today?',
    data: '',
    theme: 'default',
    position: 'bottom-right',
    maxTokens: 1024,
    temperature: 0.7,
    model: 'llama-3.3-70b-versatile',
    provider: 'groq', // 'groq', 'openai', or 'gemini'
    autoOpen: false,
    showTypingIndicator: true,
    enableMarkdown: true,
    customCSS: '',
    // Human handoff via WhatsApp
    handoff: {
      enabled: false,
      whatsapp: '',           // e.g. '447911123456' (no + or spaces)
      prefillMessage: 'Hi! I was chatting with your AI assistant and would like to speak with someone from the team.',
      buttonLabel: 'Talk to a human',
      confirmMessage: "I've opened WhatsApp for you in a new tab — the team will be with you shortly. Is there anything else I can help with in the meantime? 😊"
    },
    onMessage: null,
    onError: null,
    onOpen: null,
    onClose: null,
    onHandoff: null
  };

  // Theme configurations
  const THEMES = {
    default: { icon: '💬', color: '#667eea' },
    dark: { icon: '🌙', color: '#06b6d4' },
    minimal: { icon: '•', color: '#333' },
    gradient: { icon: '✨', color: '#667eea' },
    rounded: { icon: '💭', color: '#4CAF50' },
    neon: { icon: '⚡', color: '#ff0080' },
    glass: { icon: '🔮', color: '#ffffff' },
    corporate: { icon: '💼', color: '#2c3e50' }
  };

  // API endpoints
  const API_ENDPOINTS = {
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    openai: 'https://api.openai.com/v1/chat/completions',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/models'
  };

  class ChatPilot {
    constructor(config) {
      this.config = this.mergeConfig(config);
      this.isOpen = false;
      this.isLoading = false;
      // OpenAI-format conversation history for multi-turn context
      this.conversationHistory = [];
      this.messageHistory = [];
      this.init();
    }

    mergeConfig(config) {
      return { ...DEFAULTS, ...config };
    }

    init() {
      try {
        this.injectStyles();
        this.createUI();
        this.bindEvents();
        this.setupMessageHandling();

        if (this.config.welcomeMessage) {
          this.addMessage('assistant', this.config.welcomeMessage);
        }

        if (this.config.autoOpen) {
          this.open();
        }

        // Dispatch ready event
        this.dispatchEvent('chatpilot:ready', { instance: this });
      } catch (error) {
        this.handleError('Initialization failed', error);
      }
    }

    injectStyles() {
      const baseStyle = document.createElement('style');
      baseStyle.textContent = this.getBaseStyles();
      document.head.appendChild(baseStyle);

      if (this.config.customCSS) {
        const customStyle = document.createElement('style');
        customStyle.textContent = this.config.customCSS;
        document.head.appendChild(customStyle);
      }
    }

    getBaseStyles() {
      return `
        #chatpilot-container *, #chatpilot-container *::before, #chatpilot-container *::after {
          box-sizing: border-box; margin: 0; padding: 0;
        }
        #chatpilot-container {
          position: fixed; bottom: 24px; right: 24px;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
          font-size: 14px; line-height: 1.5;
        }

        /* Bubble */
        #chatpilot-bubble {
          width: 58px; height: 58px; border-radius: 50%;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-size: 24px; cursor: pointer; user-select: none;
          box-shadow: 0 4px 20px rgba(99,102,241,0.45);
          border: 2px solid rgba(255,255,255,0.25);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        #chatpilot-bubble:hover { transform: translateY(-3px) scale(1.06); box-shadow: 0 8px 28px rgba(99,102,241,0.55); }
        #chatpilot-bubble:active { transform: scale(0.95); }

        /* Panel */
        #chatpilot-panel {
          position: absolute; bottom: 72px; right: 0;
          width: 370px; height: 520px;
          background: #ffffff; border-radius: 18px;
          box-shadow: 0 12px 48px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06);
          border: 1px solid rgba(0,0,0,0.06);
          display: none; flex-direction: column; overflow: hidden;
          animation: cp-slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1);
          transform-origin: bottom right;
        }
        #chatpilot-panel.open { display: flex; }
        @keyframes cp-slideUp {
          from { opacity: 0; transform: scale(0.88) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Header */
        .chat-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px; flex-shrink: 0;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        }
        .chat-header-left { display: flex; align-items: center; gap: 10px; }
        .chat-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(255,255,255,0.22);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; flex-shrink: 0;
        }
        .chat-header-info { display: flex; flex-direction: column; }
        .assistant-name { font-size: 15px; font-weight: 700; color: #fff; letter-spacing: 0.01em; }
        .assistant-status {
          font-size: 11px; color: rgba(255,255,255,0.78);
          display: flex; align-items: center; gap: 4px; margin-top: 2px;
        }
        .assistant-status::before {
          content: ''; display: inline-block;
          width: 6px; height: 6px; border-radius: 50%;
          background: #4ade80; flex-shrink: 0;
        }
        .close-button {
          background: rgba(255,255,255,0.18); border: none; color: #fff;
          width: 30px; height: 30px; border-radius: 50%;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 18px; line-height: 1; transition: background 0.2s; flex-shrink: 0;
        }
        .close-button:hover { background: rgba(255,255,255,0.3); }

        /* Messages */
        .chat-messages {
          flex: 1; overflow-y: auto; padding: 14px 12px;
          display: flex; flex-direction: column; gap: 6px;
          background: #f7f8fc; scroll-behavior: smooth;
        }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }

        /* Bubbles */
        .message {
          max-width: 82%; padding: 10px 14px; border-radius: 18px;
          word-break: break-word; font-size: 14px; line-height: 1.55;
          animation: cp-msgIn 0.2s ease;
        }
        @keyframes cp-msgIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .message.user {
          align-self: flex-end;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #fff; border-bottom-right-radius: 5px;
        }
        .message.assistant {
          align-self: flex-start;
          background: #ffffff; color: #1e1e2e;
          border: 1px solid #e8eaf0; border-bottom-left-radius: 5px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .message.error {
          align-self: flex-start;
          background: #fef2f2; color: #dc2626;
          border: 1px solid #fecaca; border-radius: 12px; font-size: 13px;
        }

        /* Markdown styles */
        .message.assistant strong { font-weight: 700; color: #4f46e5; }
        .message.assistant em { font-style: italic; color: #6b7280; }
        .message.assistant code {
          background: #eef0f8; border-radius: 4px;
          padding: 1px 6px; font-size: 12.5px;
          font-family: 'Fira Code','Courier New',monospace; color: #4f46e5;
        }
        .message.assistant pre {
          background: #1e1e2e; border-radius: 8px;
          padding: 10px 12px; overflow-x: auto; margin: 8px 0 2px; font-size: 12px;
        }
        .message.assistant pre code { background: none; color: #cdd6f4; padding: 0; }
        .message.assistant h1, .message.assistant h2, .message.assistant h3 {
          font-size: 14px; font-weight: 700; color: #1e1e2e; margin: 8px 0 4px;
        }
        .message.assistant ul, .message.assistant ol { padding-left: 18px; margin: 6px 0; }
        .message.assistant li { margin-bottom: 3px; }
        .message.assistant a { color: #6366f1; text-decoration: underline; text-underline-offset: 2px; }
        .message.assistant p { margin-bottom: 6px; }
        .message.assistant p:last-child { margin-bottom: 0; }

        /* Typing indicator */
        .typing-indicator {
          display: none; align-self: flex-start; align-items: center; gap: 5px;
          padding: 10px 14px; background: #ffffff;
          border: 1px solid #e8eaf0; border-radius: 18px; border-bottom-left-radius: 5px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .typing-indicator.show { display: flex; }
        .typing-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #a5b4fc;
          animation: cp-bounce 1.3s infinite ease-in-out;
        }
        .typing-dot:nth-child(1) { animation-delay: 0s; }
        .typing-dot:nth-child(2) { animation-delay: 0.18s; }
        .typing-dot:nth-child(3) { animation-delay: 0.36s; }
        @keyframes cp-bounce {
          0%,75%,100% { transform: scale(0.65); opacity: 0.45; }
          35%          { transform: scale(1.1);  opacity: 1; }
        }

        /* Handoff bar */
        .handoff-bar {
          padding: 8px 13px; background: #f7f8fc;
          border-top: 1px solid #eef0f5;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .handoff-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 999px; border: none;
          background: #fff; color: #25D366;
          border: 1.5px solid #25D366;
          font-size: 12.5px; font-weight: 600; font-family: inherit;
          cursor: pointer; transition: background 0.2s, color 0.2s;
          line-height: 1;
        }
        .handoff-btn:hover { background: #25D366; color: #fff; }
        .handoff-btn svg { flex-shrink: 0; }

        /* Input */
        .chat-input-container {
          padding: 11px 13px; background: #ffffff;
          border-top: 1px solid #eef0f5;
          display: flex; align-items: center; gap: 8px; flex-shrink: 0;
        }
        #chat-input {
          flex: 1; padding: 10px 14px;
          border: 1.5px solid #e2e5f0; border-radius: 24px;
          font-size: 14px; font-family: inherit; outline: none;
          background: #f7f8fc; color: #1e1e2e;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        #chat-input:focus {
          border-color: #6366f1; background: #fff;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        #chat-input::placeholder { color: #9ca3af; }
        #send-button {
          width: 38px; height: 38px; border-radius: 50%; border: none;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #fff; display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; font-size: 17px; line-height: 1;
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
          box-shadow: 0 3px 10px rgba(99,102,241,0.4);
        }
        #send-button:hover:not(:disabled) { transform: scale(1.08); box-shadow: 0 5px 16px rgba(99,102,241,0.5); }
        #send-button:active:not(:disabled) { transform: scale(0.94); }
        #send-button:disabled { opacity: 0.38; cursor: not-allowed; box-shadow: none; }

        @media (max-width: 480px) {
          #chatpilot-container { bottom: 16px; right: 16px; }
          #chatpilot-panel { width: calc(100vw - 32px); height: 70vh; right: 0; border-radius: 16px; }
        }
      `;
    }

    getThemeURL() {
      // For CDN deployment, use absolute URLs
      const baseURL = this.config.cdnBase || 'https://cdn.jsdelivr.net/npm/chatpilot@1.1.0';
      return `${baseURL}/styles/themes/${this.config.theme}.css`;
    }

    createUI() {
      // Create container
      const container = document.createElement('div');
      container.id = 'chatpilot-container';
      document.body.appendChild(container);

      // Create bubble
    const bubble = document.createElement('div');
    bubble.id = 'chatpilot-bubble';
      bubble.innerHTML = THEMES[this.config.theme]?.icon || '💬';
      container.appendChild(bubble);

      // Create panel
    const panel = document.createElement('div');
    panel.id = 'chatpilot-panel';
    panel.innerHTML = `
        <div class="chat-header">
          <div class="chat-header-left">
            <div class="chat-avatar">${THEMES[this.config.theme]?.icon || '🤖'}</div>
            <div class="chat-header-info">
              <span class="assistant-name">${this.config.assistantName}</span>
              <span class="assistant-status">Online</span>
            </div>
          </div>
          <button class="close-button" id="close-button">&#x2715;</button>
        </div>
        <div class="chat-messages" id="chat-messages">
          <div class="typing-indicator" id="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
        ${this.config.handoff?.enabled && this.config.handoff?.whatsapp ? `
        <div class="handoff-bar">
          <button class="handoff-btn" id="handoff-btn" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            ${this.config.handoff.buttonLabel || 'Talk to a human'}
          </button>
        </div>` : ''}
        <div class="chat-input-container">
          <input
            id="chat-input"
            type="text"
            placeholder="Type a message..."
            autocomplete="off"
            maxlength="1000"
          />
          <button id="send-button" type="button" title="Send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      `;
      container.appendChild(panel);

      // Store references
      this.container = container;
      this.bubble = bubble;
      this.panel = panel;
      this.messagesContainer = panel.querySelector('#chat-messages');
      this.input = panel.querySelector('#chat-input');
      this.sendButton = panel.querySelector('#send-button');
      this.typingIndicator = panel.querySelector('#typing-indicator');
      this.closeButton = panel.querySelector('#close-button');
    }

    bindEvents() {
      // Bubble click
      this.bubble.addEventListener('click', () => this.toggle());

      // Close button
      const closeButton = this.panel.querySelector('#close-button');
      closeButton.addEventListener('click', () => this.close());

      // Handoff button
      const handoffBtn = this.panel.querySelector('#handoff-btn');
      if (handoffBtn) {
        handoffBtn.addEventListener('click', () => this.triggerHandoff());
      }

      // Input events
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      this.input.addEventListener('input', () => {
        this.sendButton.disabled = !this.input.value.trim();
      });

      // Send button
      this.sendButton.addEventListener('click', () => this.sendMessage());

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!this.container.contains(e.target) && this.isOpen) {
          this.close();
        }
      });

      // Handle escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
      }
    });
    }

    setupMessageHandling() {
      // Initialize send button state
      this.sendButton.disabled = true;
    }

    async sendMessage() {
      const message = this.input.value.trim();
      if (!message || this.isLoading) return;

      // Check for handoff trigger phrases before sending to AI
      if (this.config.handoff?.enabled && this.config.handoff?.whatsapp) {
        const lower = message.toLowerCase();
        const isHandoffRequest = HANDOFF_TRIGGERS.some(t => lower.includes(t));
        if (isHandoffRequest) {
          this.input.value = '';
          this.sendButton.disabled = true;
          this.addMessage('user', message);
          this.triggerHandoff();
          return;
        }
      }

      try {
        this.isLoading = true;
        this.input.value = '';
        this.sendButton.disabled = true;

        // Add user message
        this.addMessage('user', message);

        // Show typing indicator
        if (this.config.showTypingIndicator) {
          this.showTypingIndicator();
        }

        // Get AI response
        const response = await this.callLLM(message);

        // Hide typing indicator
        this.hideTypingIndicator();

        // Add AI response
        this.addMessage('assistant', response);

        // Call onMessage callback
        if (this.config.onMessage) {
          this.config.onMessage(message, response);
        }

      } catch (error) {
        this.hideTypingIndicator();
        this.addMessage('error', 'Sorry, I encountered an error. Please try again.');
        this.handleError('Message sending failed', error);
      } finally {
        this.isLoading = false;
        this.input.focus();
      }
    }

    triggerHandoff() {
      const { whatsapp, prefillMessage, confirmMessage } = this.config.handoff;

      // Build WhatsApp URL
      const encoded = encodeURIComponent(prefillMessage || '');
      const url = `https://wa.me/${whatsapp.replace(/\D/g, '')}${encoded ? '?text=' + encoded : ''}`;

      // Open WhatsApp in new tab — user stays in widget
      window.open(url, '_blank', 'noopener,noreferrer');

      // Show confirm message in widget
      const msg = confirmMessage || "I've opened WhatsApp for you in a new tab — the team will be with you shortly. Is there anything else I can help with in the meantime? 😊";
      this.addMessage('assistant', msg);

      // Fire callback if provided
      if (this.config.onHandoff) {
        this.config.onHandoff({ whatsapp, url });
      }

      this.dispatchEvent('chatpilot:handoff', { whatsapp, url });
      this.input.focus();
    }

    async callLLM(userMessage) {
      // Push the new user turn into history
      this.conversationHistory.push({ role: 'user', content: userMessage });

      let reply;
      if (this.config.provider === 'gemini') {
        reply = await this.callGemini(userMessage);
      } else {
        // groq and openai both use the OpenAI-compatible messages format
        reply = await this.callOpenAICompat(this.config.provider);
      }

      // Store assistant reply in history for future turns
      this.conversationHistory.push({ role: 'assistant', content: reply });
      return reply;
    }

    buildMessages() {
      const system = [
        this.config.systemPrompt,
        this.config.data ? `\n\nAdditional context:\n${this.config.data}` : ''
      ].join('');

      return [
        { role: 'system', content: system },
        ...this.conversationHistory
      ];
    }

    async callOpenAICompat(provider) {
      const endpoint = provider === 'groq' ? API_ENDPOINTS.groq : API_ENDPOINTS.openai;
      const defaultModel = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model || defaultModel,
          messages: this.buildMessages(),
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`${provider} API error ${response.status}: ${err?.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || 'No response received';
    }

    async callGemini(userMessage) {
      const model = this.config.model || 'gemini-1.5-flash';
      const response = await fetch(
        `${API_ENDPOINTS.gemini}/${model}:generateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: this.config.systemPrompt + (this.config.data ? `\n\nContext:\n${this.config.data}` : '') }]
            },
            contents: this.conversationHistory.map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            })),
            generationConfig: {
              maxOutputTokens: this.config.maxTokens,
              temperature: this.config.temperature
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No response received';
    }

    addMessage(type, content) {
      const messageEl = document.createElement('div');
      messageEl.className = `message ${type}`;
      
      if (this.config.enableMarkdown && type === 'assistant') {
        messageEl.innerHTML = this.parseMarkdown(content);
      } else {
        messageEl.textContent = content;
      }

      this.messagesContainer.appendChild(messageEl);
      this.scrollToBottom();

      // Store in history
      this.messageHistory.push({ type, content, timestamp: Date.now() });
    }

    parseMarkdown(text) {
      // Escape HTML first to prevent XSS
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      return escaped
        // Code blocks (must come before inline code)
        .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Unordered lists
        .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
        // Numbered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // Line breaks (after block elements are processed)
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    }

    showTypingIndicator() {
      this.typingIndicator.classList.add('show');
      this.scrollToBottom();
    }

    hideTypingIndicator() {
      this.typingIndicator.classList.remove('show');
    }

    scrollToBottom() {
      setTimeout(() => {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }, 100);
    }

    open() {
      if (this.isOpen) return;
      
      this.isOpen = true;
      this.panel.classList.add('open');
      this.input.focus();
      
      if (this.config.onOpen) {
        this.config.onOpen();
      }
      
      this.dispatchEvent('chatpilot:open');
    }

    close() {
      if (!this.isOpen) return;
      
      this.isOpen = false;
      this.panel.classList.remove('open');
      
      if (this.config.onClose) {
        this.config.onClose();
      }
      
      this.dispatchEvent('chatpilot:close');
    }

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    handleError(message, error) {
      console.error(`ChatPilot Error: ${message}`, error);
      
      if (this.config.onError) {
        this.config.onError(error);
      }
      
      this.dispatchEvent('chatpilot:error', { error, message });
    }

    dispatchEvent(name, detail = {}) {
      const event = new CustomEvent(name, { 
        detail: { ...detail, instance: this },
        bubbles: true 
      });
      document.dispatchEvent(event);
    }

    // Public API methods
    destroy() {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.dispatchEvent('chatpilot:destroy');
    }

    updateConfig(newConfig) {
      this.config = this.mergeConfig(newConfig);
      // Re-initialize with new config
      this.destroy();
      this.init();
    }

    getMessageHistory() {
      return [...this.messageHistory];
    }

    clearHistory() {
      this.messageHistory = [];
      this.conversationHistory = [];
      this.messagesContainer.innerHTML = `
        <div class="typing-indicator" id="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
      this.typingIndicator = this.messagesContainer.querySelector('#typing-indicator');
      if (this.config.welcomeMessage) {
        this.addMessage('assistant', this.config.welcomeMessage);
      }
    }
  }

  // Global ChatPilot object
  window.ChatPilot = {
    init: function(config) {
      return new ChatPilot(config);
    },

    create: function(config) {
      return new ChatPilot(config);
    },

    version: '2.0.0',
    defaults: DEFAULTS,
    themes: Object.keys(THEMES),
    providers: ['groq', 'openai', 'gemini'],

    // Groq model suggestions
    groqModels: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it'
    ]
  };

})(window, document);
