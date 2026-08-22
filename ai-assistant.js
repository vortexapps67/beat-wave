(function() {
    // 1. Inject Styles (AI Chatbot + Cookie Consent Banner)
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
        #beatwave-ai-container {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 99999;
            font-family: 'Plus Jakarta Sans', sans-serif;
        }
        #beatwave-ai-btn {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00d2ff, #b300ff);
            border: none;
            color: #ffffff;
            font-size: 22px;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(179, 0, 255, 0.4), inset 0 1px 2px rgba(255,255,255,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #beatwave-ai-btn:hover {
            transform: scale(1.1) rotate(10deg);
            box-shadow: 0 15px 35px rgba(0, 210, 255, 0.6);
        }
        #beatwave-ai-btn:active {
            transform: scale(0.95);
        }
        .ai-btn-glow {
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00d2ff, #b300ff);
            z-index: -1;
            opacity: 0.5;
            filter: blur(8px);
            animation: aiPulse 2.5s infinite alternate;
        }
        @keyframes aiPulse {
            0% { transform: scale(1); opacity: 0.3; }
            100% { transform: scale(1.15); opacity: 0.7; }
        }
        
        #beatwave-ai-window {
            position: absolute;
            bottom: 75px;
            right: 0;
            width: 380px;
            height: 520px;
            background: rgba(14, 15, 17, 0.85);
            backdrop-filter: blur(30px);
            -webkit-backdrop-filter: blur(30px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 28px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255,255,255,0.05);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            transform-origin: bottom right;
        }
        #beatwave-ai-window.chat-hidden {
            opacity: 0;
            transform: scale(0.85) translateY(20px);
            pointer-events: none;
        }
        
        body.light-theme #beatwave-ai-window {
            background: rgba(255, 255, 255, 0.85);
            border: 1px solid rgba(0, 0, 0, 0.08);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
        }

        .chat-header {
            padding: 20px 24px;
            background: rgba(255, 255, 255, 0.03);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        body.light-theme .chat-header {
            background: rgba(0, 0, 0, 0.02);
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }
        .chat-header-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .ai-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00d2ff, #b300ff);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 16px;
        }
        .chat-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 800;
            color: #fff;
            letter-spacing: -0.3px;
        }
        body.light-theme .chat-header h3 {
            color: #121316;
        }
        .ai-status {
            font-size: 10px;
            color: #88888b;
            display: flex;
            align-items: center;
            gap: 5px;
            font-weight: 600;
            margin-top: 2px;
        }
        .status-dot {
            width: 6px;
            height: 6px;
            background: #00ff88;
            border-radius: 50%;
            display: inline-block;
            box-shadow: 0 0 6px #00ff88;
        }
        #chat-close-btn {
            background: none;
            border: none;
            color: #88888b;
            font-size: 24px;
            cursor: pointer;
            transition: color 0.3s;
        }
        #chat-close-btn:hover {
            color: #ff3b3b;
        }
        
        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 14px;
            scroll-behavior: smooth;
        }
        .chat-messages::-webkit-scrollbar {
            width: 4px;
        }
        .chat-messages::-webkit-scrollbar-track {
            background: transparent;
        }
        .chat-messages::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }
        body.light-theme .chat-messages::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.1);
        }

        .chat-bubble {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 20px;
            font-size: 13.5px;
            line-height: 1.5;
            word-wrap: break-word;
        }
        .ai-bubble {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.9);
            border-top-left-radius: 4px;
            align-self: flex-start;
        }
        body.light-theme .ai-bubble {
            background: rgba(0, 0, 0, 0.03);
            border: 1px solid rgba(0, 0, 0, 0.04);
            color: #121316;
        }
        .user-bubble {
            background: linear-gradient(135deg, #00d2ff, #b300ff);
            color: #ffffff;
            border-top-right-radius: 4px;
            align-self: flex-end;
            box-shadow: 0 4px 15px rgba(179, 0, 255, 0.25);
        }
        
        .quick-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
            align-self: flex-start;
        }
        .quick-chip-btn {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.07);
            color: rgba(255, 255, 255, 0.75);
            padding: 8px 14px;
            border-radius: 50px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        body.light-theme .quick-chip-btn {
            background: rgba(0, 0, 0, 0.02);
            border: 1px solid rgba(0, 0, 0, 0.06);
            color: #5c5d61;
        }
        .quick-chip-btn:hover {
            background: rgba(0, 210, 255, 0.1);
            border-color: rgba(0, 210, 255, 0.4);
            color: #00d2ff;
        }
        
        .chat-input-area {
            padding: 16px 20px;
            background: rgba(255, 255, 255, 0.02);
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            gap: 10px;
            align-items: center;
        }
        body.light-theme .chat-input-area {
            background: rgba(0, 0, 0, 0.01);
            border-top: 1px solid rgba(0, 0, 0, 0.05);
        }
        #chat-input-field {
            flex: 1;
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 12px 16px;
            border-radius: 100px;
            color: #fff;
            font-size: 13px;
            font-family: inherit;
            outline: none;
            transition: all 0.3s;
        }
        body.light-theme #chat-input-field {
            background: #fff;
            border: 1px solid rgba(0, 0, 0, 0.1);
            color: #121316;
        }
        #chat-input-field:focus {
            border-color: rgba(0, 210, 255, 0.5);
            box-shadow: 0 0 10px rgba(0, 210, 255, 0.1);
        }
        #chat-send-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00d2ff, #b300ff);
            border: none;
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.3s;
        }
        #chat-send-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 0 15px rgba(0, 210, 255, 0.4);
        }
        .typing-loader {
            display: flex;
            gap: 4px;
            padding: 4px 8px;
            align-items: center;
        }
        .typing-dot {
            width: 6px;
            height: 6px;
            background: #88888b;
            border-radius: 50%;
            animation: typingBounce 1.4s infinite ease-in-out both;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes typingBounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        /* --- COOKIE CONSENT STYLING --- */
        #beatwave-cookie-consent {
            position: fixed;
            bottom: 30px;
            left: 30px;
            width: 420px;
            background: rgba(14, 15, 17, 0.85);
            backdrop-filter: blur(30px);
            -webkit-backdrop-filter: blur(30px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 24px;
            border-radius: 24px;
            box-shadow: 0 20px 45px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255,255,255,0.05);
            z-index: 99998;
            display: flex;
            flex-direction: column;
            gap: 16px;
            transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            transform: translateY(0);
        }
        #beatwave-cookie-consent.cookie-hidden {
            opacity: 0;
            transform: translateY(40px);
            pointer-events: none;
        }
        body.light-theme #beatwave-cookie-consent {
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(0, 0, 0, 0.08);
            box-shadow: 0 20px 45px rgba(0, 0, 0, 0.1);
        }
        .cookie-content {
            display: flex;
            gap: 14px;
            align-items: flex-start;
        }
        .cookie-icon {
            font-size: 1.5rem;
            color: #00d2ff;
            filter: drop-shadow(0 0 8px rgba(0,210,255,0.3));
        }
        .cookie-content p {
            margin: 0;
            font-size: 12.5px;
            line-height: 1.5;
            color: rgba(255,255,255,0.85);
        }
        body.light-theme .cookie-content p {
            color: #1d212a;
        }
        .cookie-content p a {
            color: #00d2ff;
            text-decoration: underline;
            font-weight: 700;
        }
        body.light-theme .cookie-content p a {
            color: #b300ff;
        }
        .cookie-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }
        #cookie-accept-btn {
            background: linear-gradient(135deg, #00d2ff, #b300ff);
            color: #fff;
            border: none;
            padding: 8px 18px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
        }
        #cookie-accept-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 5px 15px rgba(179, 0, 255, 0.4);
        }
        #cookie-decline-btn {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            color: rgba(255,255,255,0.6);
            padding: 8px 18px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
        }
        body.light-theme #cookie-decline-btn {
            background: rgba(0,0,0,0.03);
            border: 1px solid rgba(0,0,0,0.08);
            color: #5c5d61;
        }
        #cookie-decline-btn:hover {
            background: rgba(255, 59, 59, 0.15);
            color: #ff3b3b;
            border-color: rgba(255,59,59,0.3);
        }
        
        @media (max-width: 500px) {
            #beatwave-ai-container {
                bottom: 20px;
                right: 20px;
            }
            #beatwave-ai-window {
                width: calc(100vw - 40px);
                height: 460px;
                bottom: 65px;
            }
            #beatwave-cookie-consent {
                left: 20px;
                right: 20px;
                width: calc(100% - 40px);
                bottom: 20px;
            }
        }
    `;
    document.head.appendChild(styleEl);

    // 2. Inject HTML Structure (Wand bubble + chatbot panel + cookie consent panel)
    const container = document.createElement('div');
    container.id = 'beatwave-ai-container';
    container.innerHTML = `
        <button id="beatwave-ai-btn" aria-label="Ask Beatwave AI">
            <div class="ai-btn-glow"></div>
            <i class="fa-solid fa-wand-magic-sparkles"></i>
        </button>
        <div id="beatwave-ai-window" class="chat-hidden">
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="ai-avatar">
                        <i class="fa-solid fa-compact-disc fa-spin"></i>
                    </div>
                    <div>
                        <h3>Beatwave AI</h3>
                        <span class="ai-status"><span class="status-dot"></span>Online Assistant</span>
                    </div>
                </div>
                <button id="chat-close-btn">&times;</button>
            </div>
            <div class="chat-messages" id="chat-messages-container">
                <div class="chat-bubble ai-bubble">
                    Hello! I'm Beatwave AI. 🌌 Ask me anything about installation, developers, gapless audio, casting to a TV, or privacy settings!
                </div>
                <div class="quick-chips">
                    <button class="quick-chip-btn" data-question="What is Beatwave?">What is Beatwave?</button>
                    <button class="quick-chip-btn" data-question="How to cast to TV?">How to cast?</button>
                    <button class="quick-chip-btn" data-question="Who built this project?">Who built this?</button>
                    <button class="quick-chip-btn" data-question="Is my data safe?">Is my data safe?</button>
                </div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="chat-input-field" placeholder="Ask a question..." autocomplete="off">
                <button id="chat-send-btn">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
        </div>

        <!-- Cookie Consent Overlay Banner -->
        <div id="beatwave-cookie-consent" class="cookie-hidden">
            <div class="cookie-content">
                <i class="fa-solid fa-cookie-bite cookie-icon"></i>
                <p>BeatWave uses local database configurations and cookies to synchronize cast rooms, Decoders, and preferences. Read our <a href="toc.html">Terms & Privacy</a>.</p>
            </div>
            <div class="cookie-actions">
                <button id="cookie-decline-btn">Decline</button>
                <button id="cookie-accept-btn">Accept Cookies</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // 3. UI Selectors
    const aiBtn = document.getElementById('beatwave-ai-btn');
    const aiWindow = document.getElementById('beatwave-ai-window');
    const closeBtn = document.getElementById('chat-close-btn');
    const sendBtn = document.getElementById('chat-send-btn');
    const inputField = document.getElementById('chat-input-field');
    const messagesContainer = document.getElementById('chat-messages-container');

    // Cookie Selectors
    const cookieBanner = document.getElementById('beatwave-cookie-consent');
    const acceptBtn = document.getElementById('cookie-accept-btn');
    const declineBtn = document.getElementById('cookie-decline-btn');

    // Toggle Chat Visibility
    aiBtn.addEventListener('click', () => {
        aiWindow.classList.toggle('chat-hidden');
        if (!aiWindow.classList.contains('chat-hidden')) {
            inputField.focus();
        }
    });

    closeBtn.addEventListener('click', () => {
        aiWindow.classList.add('chat-hidden');
    });

    // Handle Sending Message
    const handleSend = () => {
        const query = inputField.value.trim();
        if (!query) return;

        // Render User Message
        appendMessage(query, 'user-bubble');
        inputField.value = '';

        // Render Typing Indicator
        const typingIndicator = showTypingIndicator();

        // Query Local Brain & Stream Answer
        setTimeout(() => {
            typingIndicator.remove();
            const response = generateAIResponse(query);
            streamResponse(response);
        }, 800);
    };

    sendBtn.addEventListener('click', handleSend);
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    // Chip click delegation
    messagesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('quick-chip-btn')) {
            const question = e.target.getAttribute('data-question');
            inputField.value = question;
            handleSend();
        }
    });

    // --- Cookie Consent Logic ---
    if (!localStorage.getItem('beatwave-cookie-choice')) {
        setTimeout(() => {
            cookieBanner.classList.remove('cookie-hidden');
        }, 1500); // Appear slightly after load
    }

    acceptBtn.addEventListener('click', () => {
        localStorage.setItem('beatwave-cookie-choice', 'accepted');
        cookieBanner.classList.add('cookie-hidden');
    });

    declineBtn.addEventListener('click', () => {
        localStorage.setItem('beatwave-cookie-choice', 'declined');
        cookieBanner.classList.add('cookie-hidden');
    });

    // 4. Helper Functions
    function appendMessage(text, className) {
        // Remove existing chips if present to clean view
        const oldChips = messagesContainer.querySelector('.quick-chips');
        if (oldChips && className === 'user-bubble') {
            oldChips.remove();
        }

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${className}`;
        bubble.innerHTML = formatMarkdown(text);
        
        messagesContainer.appendChild(bubble);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return bubble;
    }

    function showTypingIndicator() {
        const loader = document.createElement('div');
        loader.className = 'chat-bubble ai-bubble typing-loader';
        loader.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        messagesContainer.appendChild(loader);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return loader;
    }

    function streamResponse(fullText) {
        const bubble = appendMessage('', 'ai-bubble');
        let currentText = '';
        let charIndex = 0;
        
        inputField.disabled = true;
        sendBtn.disabled = true;

        const interval = setInterval(() => {
            if (charIndex < fullText.length) {
                currentText += fullText[charIndex];
                bubble.innerHTML = formatMarkdown(currentText);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                charIndex++;
            } else {
                clearInterval(interval);
                inputField.disabled = false;
                sendBtn.disabled = false;
                inputField.focus();
                appendChipsSuggestion(fullText);
            }
        }, 12);
    }

    function appendChipsSuggestion(lastAnswer) {
        let chips = [];
        if (lastAnswer.toLowerCase().includes('connect') || lastAnswer.toLowerCase().includes('cast')) {
            chips = ['Setup Cast Room', 'Troubleshooting Connect', 'Go to Webplayer'];
        } else if (lastAnswer.toLowerCase().includes('author') || lastAnswer.toLowerCase().includes('architect')) {
            chips = ['What is Vortex Apps?', 'GitHub Code repo'];
        } else if (lastAnswer.toLowerCase().includes('privacy')) {
            chips = ['Are files uploaded?', 'Terms of Service', 'Read Manifest'];
        } else {
            chips = ['What is Beatwave?', 'How to cast?', 'Who built this?', 'Data Privacy'];
        }

        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'quick-chips';
        chipsContainer.innerHTML = chips.map(c => `<button class="quick-chip-btn" data-question="${c}">${c}</button>`).join('');
        messagesContainer.appendChild(chipsContainer);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/- (.*?)\n/g, '• $1<br>')
            .replace(/\n/g, '<br>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: #00d2ff; text-decoration: underline;">$1</a>');
    }

    // 5. Intelligent Knowledge Base Matcher
    function generateAIResponse(q) {
        const query = q.toLowerCase();

        if (query.includes('what is') || query.includes('about') || query.includes('beatwave') && !query.includes('cast') && !query.includes('built')) {
            return `**BeatWave** is a standalone, free, and open-source audio client for Android environments natively designed by **Vortex Apps**.\n\nKey features include:\n- Seamless local decoding (supports MP3, FLAC, WAV, etc.)\n- A beautiful, hardware-accelerated glassmorphism design system\n- No ads, trackers, or commercial telemetry\n- A built-in "Listen Together" sync caster engine.`;
        }
        
        if (query.includes('install') || query.includes('download') || query.includes('setup') || query.includes('get start') || query.includes('apk') || query.includes('sideload')) {
            return `Setting up BeatWave on Android is simple:\n\n1. Click the **Get BeatWave** button on the home page landing slider to jump directly to our release tags on [GitHub Releases](https://github.com/beatlabs790/beatwave/releases).\n2. Download the latest standalone **APK** file.\n3. Open the downloaded file and click **Install**. You might need to allow 'Install from Unknown Sources' in your Android Settings since this is a secure, direct FOSS build.\n4. Open the app and authorize local storage access to index your music!`;
        }

        if (query.includes('creator') || query.includes('dev') || query.includes('developer') || query.includes('architect') || query.includes('built') || query.includes('who made') || query.includes('author') || query.includes('akshansh') || query.includes('aarav') || query.includes('vortex')) {
            return `BeatWave is developed and engineered by **Vortex Apps**.\n\nYou can find more information about our studio on our [Official Website](https://vortexapps.vercel.app) or connect with us on Instagram [@vortex.apps](https://instagram.com/vortex.apps).\n\nThe project is fork-engineered based on the beautiful open-source project [ConvX](https://github.com/cosmictaserdev-creator/Convx/) by @cosmictaserdev-creator, to whom we are incredibly grateful!`;
        }

        if (query.includes('cast') || query.includes('connect') || query.includes('tv') || query.includes('sync') || query.includes('listen together') || query.includes('room')) {
            return `The sync-casting system works through our **Cloud Connect Web Player**:\n\n1. Launch [Web Player](web.html).\n2. Click the **Connect Device** button in the sidebar menu.\n3. Enter a custom **Cast Room Name** (e.g. "myroom123").\n4. If you want this browser to be the player screen, select **TV Monitor Mode**. This renders the beautiful fullscreen display with the album art.\n5. To cast and control from your mobile client, select **Control Client** (or connect from your mobile app) using the same room name.\n\nNow commands like Play, Pause, and song selection will sync automatically!`;
        }

        if (query.includes('gapless') || query.includes('crossfade') || query.includes('fade') || query.includes('mix') || query.includes('autoplay')) {
            return `BeatWave features high-end audio playback configurations built on Jetpack Media3:\n\n- **Gapless Playback**: Pre-buffers next audio timeline values for perfect transitions.\n- **Crossfading**: Dynamically fades out volume at the end of a track while the next one begins. In the [Web Player](web.html), you can adjust this duration slide bar (0s to 12s) in the control panel.\n- **Autoplay Engine**: Autocompiles similar music recommendations from public catalogs when your immediate queue runs dry.`;
        }

        if (query.includes('privacy') || query.includes('data') || query.includes('secure') || query.includes('telemetry') || query.includes('tracking') || query.includes('safe') || query.includes('cookies')) {
            return `**Absolutely safe!** Privacy is our foundational value:\n\n- Zero analytical cookies or marketing tracking matrices.\n- Cookies are strictly utilized to remember user theme presets and verify cast room access states.\n- All music indexing and database mappings (Android Room/SQLite) remain strictly inside your physical device's secure local sandbox.\n- Network connectivity is restricted exclusively to user-selected remote audio stream decoding. We never gather profile logs.`;
        }

        if (query.includes('maintenance') || query.includes('offline') || query.includes('locked')) {
            return `Maintenance mode is toggled by administrators during service enhancements. While active, the core server synchronizations (like Listen Together databases) are offline to protect room databases. Local playback features in the compiled app remain fully operational!`;
        }

        if (query.includes('hello') || query.includes('hi') || query.includes('hey') || query.includes('sup') || query.includes('greet')) {
            return `Hello! 🌟 I am Beatwave AI, your interactive advisor. I'm here to help you get the most out of BeatWave. Ask me about setup details, casting settings, developers, or gapless audio options!`;
        }

        if (query.includes('thanks') || query.includes('thank you') || query.includes('cool') || query.includes('nice')) {
            return `You're very welcome! Let me know if you have any other questions about BeatWave. Have a fantastic listening session! 🎵`;
        }

        return `That's an interesting question! I am specialized in all things **BeatWave**.\n\nI can tell you that our platform is designed to provide clean, ad-free offline music. Would you like to know more about:\n- Sideloading the **Android app**?\n- Configuring the **Listen Together Cast Room**?\n- Who are the **developers** of this project?\n- How **gapless playback** configurations work?`;
    }
})();
