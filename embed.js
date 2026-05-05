/**
 * ChatPilot – drop this snippet into any website's <body> to add the Groq-powered chat widget.
 * Replace YOUR_GROQ_API_KEY and customise the config below.
 *
 * Get a free Groq key: https://console.groq.com
 */
(function () {
  var script = document.createElement('script');
  // Point this at wherever you host ChatPilot.js (CDN, same server, etc.)
  script.src = 'https://YOUR_DOMAIN/chat-ai/src/ChatPilot.js';
  script.onload = function () {
    window.ChatPilot.init({
      // --- Required ---
      apiKey: 'YOUR_GROQ_API_KEY',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',

      // --- Personality ---
      assistantName: 'Aria',
      systemPrompt: [
        'You are Aria, the AI assistant for [YOUR SITE NAME].',
        'You are helpful, knowledgeable, and friendly.',
        'You answer questions about [YOUR SITE / PRODUCT] and general topics.',
        'Keep responses concise but thorough. Use markdown when it helps clarity.',
      ].join(' '),
      welcomeMessage: "Hi! I'm Aria. What can I help you with today?",

      // --- Context about your site (optional) ---
      data: '',

      // --- UI ---
      theme: 'gradient',       // default | dark | minimal | gradient | rounded | neon | glass | corporate
      position: 'bottom-right',
      enableMarkdown: true,
      showTypingIndicator: true,
      autoOpen: false,

      // --- Tuning ---
      maxTokens: 1024,
      temperature: 0.7,

      // --- Callbacks (optional) ---
      onMessage: function (userMsg, botReply) {
        // e.g. log to analytics
      },
      onError: function (err) {
        console.error('[ChatPilot]', err);
      }
    });
  };
  document.body.appendChild(script);
})();
