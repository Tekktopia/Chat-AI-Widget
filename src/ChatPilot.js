/**
 * ChatPilot - AI Chat Widget
 * Groq-powered, multi-turn, markdown-capable chat widget
 * @version 2.0.0
 * @year 2025
 * @license MIT
 */

(function(window, document) {
  'use strict';

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
    onMessage: null,
    onError: null,
    onOpen: null,
    onClose: null
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
      // Inject base styles
      const baseStyle = document.createElement('style');
      baseStyle.textContent = this.getBaseStyles();
      document.head.appendChild(baseStyle);

      // Inject theme styles
      const themeStyle = document.createElement('link');
      themeStyle.rel = 'stylesheet';
      themeStyle.href = this.getThemeURL();
      document.head.appendChild(themeStyle);

      // Inject custom CSS if provided
      if (this.config.customCSS) {
        const customStyle = document.createElement('style');
        customStyle.textContent = this.config.customCSS;
        document.head.appendChild(customStyle);
      }
    }

    getBaseStyles() {
      return `
        #chatpilot-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.4;
        }
        
        #chatpilot-bubble {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          font-size: 24px;
        }
        
        #chatpilot-panel {
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 350px;
          max-height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          display: none;
          flex-direction: column;
          overflow: hidden;
        }
        
        #chatpilot-panel.open {
          display: flex;
        }
        
        .chat-header {
          padding: 16px 20px;
          font-weight: 600;
          border-bottom: 1px solid #e1e5e9;
        }
        
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          max-height: 300px;
        }
        
        .message {
          margin-bottom: 12px;
          padding: 8px 12px;
          border-radius: 8px;
          word-wrap: break-word;
        }
        
        .message.user {
          background: #f0f0f0;
          margin-left: 20px;
        }
        
        .message.assistant {
          background: #e3f2fd;
          margin-right: 20px;
        }
        
        .message.error {
          background: #ffebee;
          color: #c62828;
        }
        
        .typing-indicator {
          display: none;
          padding: 10px 14px;
          background: #f0f4ff;
          border-radius: 8px;
          margin-right: 20px;
          margin-bottom: 8px;
          gap: 4px;
          align-items: center;
        }

        .typing-indicator.show {
          display: flex;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #667eea;
          animation: chatpilot-bounce 1.2s infinite ease-in-out;
        }
        .typing-dot:nth-child(1) { animation-delay: 0s; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes chatpilot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1; }
        }

        .message.assistant pre {
          background: #f4f4f8;
          border-radius: 6px;
          padding: 8px 10px;
          overflow-x: auto;
          font-size: 12px;
          margin: 6px 0 0;
        }
        .message.assistant code {
          background: #eef0f8;
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 12px;
        }
        .message.assistant pre code {
          background: none;
          padding: 0;
        }
        .message.assistant h1,.message.assistant h2,.message.assistant h3 {
          margin: 6px 0 2px;
          font-size: 14px;
        }
        .message.assistant ul { padding-left: 16px; margin: 4px 0; }
        .message.assistant a { color: #667eea; }
        
        .chat-input-container {
          padding: 16px 20px;
          border-top: 1px solid #e1e5e9;
          display: flex;
          gap: 8px;
        }
        
        #chat-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #ddd;
          border-radius: 8px;
          outline: none;
          font-size: 14px;
        }
        
        #send-button {
          padding: 12px 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s ease;
        }
        
        #send-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .error-message {
          color: #c62828;
          font-size: 12px;
          margin-top: 4px;
        }
        
        @media (max-width: 480px) {
          #chatpilot-panel {
            width: calc(100vw - 40px);
            right: -10px;
          }
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
          <span class="assistant-name">${this.config.assistantName}</span>
          <button class="close-button" id="close-button">×</button>
        </div>
        <div class="chat-messages" id="chat-messages">
          <div class="typing-indicator" id="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
        <div class="chat-input-container">
          <input 
            id="chat-input" 
            type="text" 
            placeholder="Ask me anything..." 
            autocomplete="off"
            maxlength="1000"
          />
          <button id="send-button" type="button">Send</button>
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
