/* ============================================================
   BeatWave Landing — page logic
   Extracted from the original inline script; behavior preserved.
   Perf patches: reduced grid density on mobile, rAF-batched
   cursor glow, static-count capture before unobserve.
   ============================================================ */

// ---------- Clipboard helpers ----------
function copyToClipboard(textToCopy, textElementId, iconElementId, originalText, successMsg) {
    navigator.clipboard.writeText(textToCopy).then(() => {
        const textNode = document.getElementById(textElementId);
        const iconNode = document.getElementById(iconElementId);

        if (textNode) textNode.innerText = successMsg;
        if (iconNode) iconNode.className = 'fa-solid fa-check';

        const pill = iconNode ? iconNode.closest('.upi-copy-pill, .checksum-bar') : null;
        if (pill) pill.classList.add('copied');

        setTimeout(() => {
            if (textNode) textNode.innerText = originalText;
            if (iconNode) iconNode.className = 'fa-regular fa-copy';
            if (pill) pill.classList.remove('copied');
        }, 2000);
    }).catch(err => console.error("Clipboard copy failed:", err));
}

window.copyUpiIdToClipboard = function () {
    copyToClipboard("akshanshsinha67@axl", "upiIdText", "upiCopyIcon", "akshanshsinha67@axl", "Copied!");
};

window.copyHashToClipboard = function () {
    copyToClipboard(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "hashText", "hashCopyIcon",
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "SHA-256 Copied!"
    );
};

// ---------- Loader ----------
function initWavyLoader() {
    const anchor = document.getElementById('wavy-text-anchor');
    if (!anchor) return;
    anchor.innerHTML = '';
    "BEATWAVE".split('').forEach((letter, index) => {
        const span = document.createElement('span');
        span.className = 'wavy-letter';
        span.innerText = letter;
        span.style.animationDelay = `${index * 0.08}s`;
        anchor.appendChild(span);
    });
}
initWavyLoader();

function initProgressBarEngine(onComplete) {
    const barFill = document.getElementById('loaderMatrixProgressBarNode');
    const pctLabel = document.getElementById('loaderProgressPct');
    if (!barFill) { if (onComplete) onComplete(); return; }

    const duration = 1200;
    let startTimestamp = null;

    function step(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        const linearProgress = Math.min(1, elapsed / duration);
        // easeOutCubic for organic acceleration and smooth deceleration into 100%
        const progress = 1 - Math.pow(1 - linearProgress, 3);
        const currentPct = Math.round(progress * 100);

        barFill.style.width = `${progress * 100}%`;
        if (pctLabel) pctLabel.textContent = currentPct;

        if (linearProgress < 1) {
            requestAnimationFrame(step);
        } else {
            barFill.style.width = '100%';
            if (pctLabel) pctLabel.textContent = '100';
            setTimeout(() => {
                if (onComplete) onComplete();
            }, 120);
        }
    }

    requestAnimationFrame(step);
}

// ---------- Firebase: admin + listeners ----------
let adminDb = null;

if (typeof firebaseConfigs !== 'undefined') {
    try {
        const adminApp = firebase.initializeApp(firebaseConfigs.adminConfig, "adminApp");
        adminDb = adminApp.database();
        setupDatabaseListeners();
        setupAdminModalHandlers();
    } catch (e) {
        console.error("Firebase init failed:", e);
    }
} else {
    console.error("Firebase configurations not found! Ensure config.js is loaded.");
}

function showLiveToast(message) {
    document.querySelectorAll('.live-broadcast-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'live-broadcast-toast';
    toast.innerHTML = `
        <div class="toast-indicator"></div>
        <div class="toast-body">
            <div class="toast-title"><i class="fa-solid fa-tower-broadcast"></i> System Broadcast</div>
            <div class="toast-text">${message}</div>
        </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('toast-show'), 100);
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 500);
    }, 7000);
}

// ---------- Countdown ----------
let countdownInterval = null;
function startCountdownTimerLoop(targetTime) {
    stopCountdownTimerLoop();
    const tick = () => {
        const remaining = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
        const timerNode = document.getElementById('countdown-timer');

        if (remaining <= 0) {
            stopCountdownTimerLoop();
            if (timerNode) timerNode.innerText = "00:00";
            const mScreen = document.getElementById('maintenance-screen');
            if (mScreen) mScreen.classList.remove('maintenance-hidden');
            const banner = document.getElementById('countdown-banner');
            if (banner) banner.style.display = 'none';
            return;
        }

        const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
        const secs = (remaining % 60).toString().padStart(2, '0');
        if (timerNode) timerNode.innerText = `${mins}:${secs}`;
    };
    tick();
    countdownInterval = setInterval(tick, 1000);
}
function stopCountdownTimerLoop() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
}

// ---------- Database listeners ----------
function setupDatabaseListeners() {
    if (!adminDb) return;

    // 1. Maintenance
    adminDb.ref('maintenance').on('value', snapshot => {
        const isMaintenance = snapshot.val() || false;
        const mScreen = document.getElementById('maintenance-screen');
        if (mScreen) mScreen.classList.toggle('maintenance-hidden', !isMaintenance);
        const toggle = document.getElementById('admin-maintenance-toggle');
        if (toggle) toggle.checked = isMaintenance;
    });

    // 2. Announcement
    adminDb.ref('announcementActive').on('value', activeSnap => {
        const isActive = activeSnap.val() || false;
        adminDb.ref('announcement').on('value', textSnap => {
            const text = textSnap.val() || "";
            const banner = document.getElementById('announcement-banner');
            const textNode = document.getElementById('announcement-text');

            if (banner && textNode) {
                if (isActive && text.trim() !== "") {
                    textNode.innerText = text;
                    banner.classList.remove('announcement-hidden');
                } else {
                    banner.classList.add('announcement-hidden');
                }
            }

            const toggle = document.getElementById('admin-announcement-toggle');
            const input = document.getElementById('admin-announcement-input');
            if (toggle) toggle.checked = isActive;
            if (input) input.value = text;
        });
    });

    // 3. Downloads counter
    adminDb.ref('downloads').on('value', snapshot => {
        const downloadsVal = snapshot.val() || 235;
        const counterNode = document.getElementById('animatedCounterNode');
        if (counterNode) {
            counterNode.setAttribute('data-target-value', downloadsVal);
            const currentVal = parseInt(counterNode.getAttribute('data-current')) || 0;
            if (currentVal > 0) runOdometerAnimation();
            counterNode.setAttribute('data-current', downloadsVal);
        }
        const input = document.getElementById('admin-downloads-input');
        if (input) input.value = downloadsVal;
    });

    // 4. Download button text/link
    adminDb.ref('downloadText').on('value', textSnap => {
        const text = textSnap.val() || "Get BeatWave v4.0 (GitHub Build Hub)";
        const btn = document.getElementById('downloadButtonMain');
        if (btn) {
            const span = btn.querySelector('span');
            if (span) span.innerText = text;
        }
        const input = document.getElementById('admin-btntext-input');
        if (input) input.value = text;
    });

    adminDb.ref('downloadLink').on('value', linkSnap => {
        const link = linkSnap.val() || "https://github.com/beatlabs790/beatwave/releases/tag/v4.0";
        const btn = document.getElementById('downloadButtonMain');
        if (btn) btn.href = link;
        const input = document.getElementById('admin-btnlink-input');
        if (input) input.value = link;
    });

    // 5. Broadcast messages
    adminDb.ref('broadcastMessage').on('value', snapshot => {
        const val = snapshot.val();
        if (val && val.text && val.ts && Date.now() - val.ts < 15000) {
            showLiveToast(val.text);
        }
    });

    // 6. Maintenance countdown
    adminDb.ref('maintenanceCountdown').on('value', snapshot => {
        const val = snapshot.val();
        const banner = document.getElementById('countdown-banner');
        const toggle = document.getElementById('admin-countdown-toggle');
        const reasonInput = document.getElementById('admin-countdown-reason');

        if (val) {
            if (toggle) toggle.checked = val.active || false;
            if (reasonInput) reasonInput.value = val.msg || "";

            if (val.active && val.targetTime) {
                if (banner) banner.style.display = 'flex';
                const msgNode = document.getElementById('countdown-msg');
                if (msgNode) msgNode.innerText = val.msg || "core engine upgrade";
                startCountdownTimerLoop(val.targetTime);
            } else {
                if (banner) banner.style.display = 'none';
                stopCountdownTimerLoop();
            }
        } else {
            if (banner) banner.style.display = 'none';
            stopCountdownTimerLoop();
        }
    });
}

// ---------- Admin tabs ----------
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.admin-tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('admin-tab-hidden'));
            const target = document.getElementById(`admin-tab-${tab.getAttribute('data-tab')}`);
            if (target) target.classList.remove('admin-tab-hidden');
        });
    });
}

// ---------- Cast monitor ----------
let playerDbRoomsRef = null;
function setupCastMonitorListener() {
    if (typeof firebaseConfigs === 'undefined' || typeof firebase === 'undefined') return;
    try {
        const playerApp = firebase.apps.find(app => app.name === '[DEFAULT]') || firebase.app();
        const playerDb = playerApp.database();
        if (playerDbRoomsRef) playerDbRoomsRef.off();
        playerDbRoomsRef = playerDb.ref('rooms');

        playerDbRoomsRef.on('value', snapshot => {
            const rooms = snapshot.val();
            const listContainer = document.getElementById('admin-rooms-list');
            if (!listContainer) return;

            if (!rooms) {
                listContainer.innerHTML = '<p>No active cast rooms.</p>';
                return;
            }

            let html = '';
            Object.keys(rooms).forEach(roomName => {
                const room = rooms[roomName];
                const clientCount = room.clients ? Object.keys(room.clients).length : 1;
                html += `
                    <div class="admin-list-item">
                        <span>📡 <strong>${roomName.toUpperCase()}</strong> (${clientCount} nodes)</span>
                        <button onclick="terminateCastRoom('${roomName}')">Force Close</button>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
        });
    } catch (e) {
        console.error("Casting DB initialization deferred:", e);
    }
}
window.terminateCastRoom = function (roomName) {
    try {
        const playerApp = firebase.apps.find(app => app.name === '[DEFAULT]') || firebase.app();
        playerApp.database().ref('rooms/' + roomName).remove()
            .then(() => alert(`Room ${roomName.toUpperCase()} closed successfully.`))
            .catch(err => alert("Error closing room: " + err.message));
    } catch (e) {
        alert("Error connecting to casting system database.");
    }
};

// ---------- Featured catalog ----------
function setupFeaturedCatalogListener() {
    if (!adminDb) return;
    adminDb.ref('featuredCatalog').on('value', snapshot => {
        const tracks = snapshot.val();
        const listContainer = document.getElementById('admin-catalog-list');
        if (!listContainer) return;

        if (!tracks) {
            listContainer.innerHTML = '<p>No tracks featured.</p>';
            return;
        }

        let html = '';
        Object.keys(tracks).forEach(key => {
            const t = tracks[key];
            html += `
                <div class="admin-list-item">
                    <span>🎵 <strong>${t.title}</strong> - ${t.artist}</span>
                    <button onclick="deleteFeaturedTrack('${key}')">Delete</button>
                </div>
            `;
        });
        listContainer.innerHTML = html;
    });
}
window.deleteFeaturedTrack = function (key) {
    if (!adminDb) return;
    adminDb.ref('featuredCatalog/' + key).remove()
        .catch(err => alert("Error deleting track: " + err.message));
};

// ---------- API keys ----------
function setupApiKeysListener() {
    if (!adminDb) return;
    adminDb.ref('apiKeys').on('value', snapshot => {
        const keys = snapshot.val();
        const listContainer = document.getElementById('admin-keys-list');
        if (!listContainer) return;

        if (!keys) {
            listContainer.innerHTML = '<p>Using fallback hardcoded API keys.</p>';
            return;
        }

        let html = '';
        Object.keys(keys).forEach(index => {
            const keyString = keys[index];
            const masked = keyString.substring(0, 8) + '...' + keyString.substring(keyString.length - 6);
            html += `
                <div class="admin-list-item">
                    <span>🔑 Key: <strong>${masked}</strong></span>
                    <button onclick="deleteApiKey('${index}')">Remove</button>
                </div>
            `;
        });
        listContainer.innerHTML = html;
    });
}
window.deleteApiKey = function (index) {
    if (!adminDb) return;
    adminDb.ref('apiKeys/' + index).remove()
        .catch(err => alert("Error removing key: " + err.message));
};

// ---------- Admin modal ----------
function setupAdminModalHandlers() {
    const adminModal = document.getElementById('admin-modal');
    if (!adminModal) return;
    const loginBtn = document.getElementById('admin-login-btn');
    const maintAdminBtn = document.getElementById('maintenance-admin-btn');
    const closeBtn = document.getElementById('admin-modal-close');
    const loginSubmit = document.getElementById('admin-login-submit');
    const passInput = document.getElementById('admin-password-input');
    const loginView = document.getElementById('admin-login-view');
    const dashboardView = document.getElementById('admin-dashboard-view');
    const errorNode = document.getElementById('admin-login-error');
    const saveBtn = document.getElementById('admin-save-btn');
    const statusNode = document.getElementById('admin-save-status');

    const openModal = () => {
        adminModal.classList.remove('admin-modal-hidden');
        loginView.classList.remove('admin-step-hidden');
        dashboardView.classList.add('admin-step-hidden');
        document.getElementById('admin-tabs').classList.add('admin-tab-hidden');
        passInput.value = '';
        errorNode.innerText = '';
        statusNode.innerText = '';
        passInput.focus();
    };
    const closeModal = () => adminModal.classList.add('admin-modal-hidden');

    if (loginBtn) loginBtn.addEventListener('click', openModal);
    if (maintAdminBtn) maintAdminBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    document.querySelector('.admin-modal-backdrop').addEventListener('click', closeModal);

    const handleLogin = () => {
        if (passInput.value === 'admin00') {
            loginView.classList.add('admin-step-hidden');
            dashboardView.classList.remove('admin-step-hidden');
            document.getElementById('admin-tabs').classList.remove('admin-tab-hidden');
            errorNode.innerText = '';
            setupTabNavigation();
            setupCastMonitorListener();
            setupFeaturedCatalogListener();
            setupApiKeysListener();
        } else {
            errorNode.innerText = 'Access Denied: Invalid Password';
        }
    };
    loginSubmit.addEventListener('click', handleLogin);
    passInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleLogin(); });

    // Save configs
    saveBtn.addEventListener('click', () => {
        if (!adminDb) return;
        const isMaintenance = document.getElementById('admin-maintenance-toggle').checked;
        const isAnnActive = document.getElementById('admin-announcement-toggle').checked;
        const annText = document.getElementById('admin-announcement-input').value;
        const downloadsCount = parseInt(document.getElementById('admin-downloads-input').value) || 0;
        const btnText = document.getElementById('admin-btntext-input').value;
        const btnLink = document.getElementById('admin-btnlink-input').value;

        Promise.all([
            adminDb.ref('maintenance').set(isMaintenance),
            adminDb.ref('announcementActive').set(isAnnActive),
            adminDb.ref('announcement').set(annText),
            adminDb.ref('downloads').set(downloadsCount),
            adminDb.ref('downloadText').set(btnText),
            adminDb.ref('downloadLink').set(btnLink)
        ]).then(() => {
            statusNode.innerText = 'Configurations successfully updated!';
            setTimeout(() => { statusNode.innerText = ''; }, 3000);
        }).catch(err => {
            statusNode.style.color = '#ffffff';
            statusNode.innerText = 'Error writing to database: ' + err.message;
            setTimeout(() => { statusNode.innerText = ''; statusNode.style.color = ''; }, 4000);
        });
    });

    // Add music
    document.getElementById('admin-music-add-btn').addEventListener('click', () => {
        if (!adminDb) return;
        const vId = document.getElementById('admin-music-videoid').value.trim();
        const title = document.getElementById('admin-music-title').value.trim();
        const artist = document.getElementById('admin-music-artist').value.trim();
        const artUrl = document.getElementById('admin-music-arturl').value.trim();

        if (!vId || !title || !artist) {
            alert("Please fill out Video ID, Title, and Artist!");
            return;
        }
        adminDb.ref('featuredCatalog').push({
            videoId: vId, title: title, artist: artist,
            artUrl: artUrl || 'beatwave%20new%20new.png'
        }).then(() => {
            ['admin-music-videoid', 'admin-music-title', 'admin-music-artist', 'admin-music-arturl']
                .forEach(id => document.getElementById(id).value = '');
            alert("Track added successfully!");
        }).catch(err => alert("Error: " + err.message));
    });

    // Add API key
    document.getElementById('admin-key-add-btn').addEventListener('click', () => {
        if (!adminDb) return;
        const keyInput = document.getElementById('admin-key-input');
        const newKey = keyInput.value.trim();
        if (!newKey) return;
        adminDb.ref('apiKeys').push(newKey).then(() => {
            keyInput.value = '';
            alert("API key added!");
        }).catch(err => alert("Error: " + err.message));
    });

    // Broadcast alert
    document.getElementById('admin-alert-send-btn').addEventListener('click', () => {
        if (!adminDb) return;
        const alertMsg = document.getElementById('admin-alert-message').value.trim();
        if (!alertMsg) return;
        adminDb.ref('broadcastMessage').set({ text: alertMsg, ts: Date.now() }).then(() => {
            document.getElementById('admin-alert-message').value = '';
            const alertStatus = document.getElementById('admin-alert-status');
            alertStatus.innerText = 'Broadcast sent successfully!';
            setTimeout(() => { alertStatus.innerText = ''; }, 3000);
        }).catch(err => alert("Error: " + err.message));
    });

    // Countdown schedule
    document.getElementById('admin-countdown-save-btn').addEventListener('click', () => {
        if (!adminDb) return;
        const active = document.getElementById('admin-countdown-toggle').checked;
        const minutes = parseInt(document.getElementById('admin-countdown-minutes').value) || 5;
        const reason = document.getElementById('admin-countdown-reason').value.trim() || "Maintenance Scheduled";
        const targetTime = Date.now() + (minutes * 60 * 1000);

        adminDb.ref('maintenanceCountdown').set({
            active: active, targetTime: targetTime, msg: reason
        }).then(() => {
            const countdownStatus = document.getElementById('admin-countdown-status');
            countdownStatus.innerText = 'Maintenance schedule updated!';
            setTimeout(() => { countdownStatus.innerText = ''; }, 3000);
        }).catch(err => alert("Error: " + err.message));
    });
}

// ---------- Announcement close ----------
const annBanner = document.getElementById('announcement-banner');
const annClose = document.getElementById('announcement-close');
if (annClose && annBanner) {
    annClose.addEventListener('click', () => annBanner.classList.add('announcement-hidden'));
}

// ---------- Theme ----------
const themeBtn = document.getElementById('themeToggleBtn');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        themeBtn.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('beatwave-theme', isLight ? 'light' : 'dark');
    });
    if (localStorage.getItem('beatwave-theme') === 'light') {
        document.body.classList.add('light-theme');
        themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// ---------- Side menu ----------
document.body.addEventListener('click', function (e) {
    if (e.target.closest('.menu-trigger, .menu-trigger-f')) {
        e.preventDefault();
        toggleMenu();
    }
});

function toggleMenu() {
    const menu = document.getElementById('sideMenu');
    if (menu) menu.classList.toggle('active');
    document.body.style.overflow = menu && menu.classList.contains('active') ? 'hidden' : '';
}

// Close side menu on backdrop tap (mobile) via Escape
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const menu = document.getElementById('sideMenu');
        if (menu && menu.classList.contains('active')) toggleMenu();
    }
});

// ---------- FAQ accordions ----------
function setupFaqAccordions() {
    document.querySelectorAll('.faq-wrapper-node').forEach(node => {
        const trigger = node.querySelector('.faq-trigger-tab');
        const panel = node.querySelector('.faq-content-panel');
        if (!trigger || !panel) return;
        trigger.addEventListener('click', () => {
            const isActive = node.classList.contains('active');
            document.querySelectorAll('.faq-wrapper-node').forEach(other => {
                other.classList.remove('active');
                const p = other.querySelector('.faq-content-panel');
                if (p) p.style.maxHeight = null;
            });
            if (!isActive) {
                node.classList.add('active');
                panel.style.maxHeight = panel.scrollHeight + "px";
            }
        });
    });
}

// ---------- Gallery carousel ----------
let activeFrameIndex = 0;
let galleryRotationInterval = null;

function updateGalleryFrameDisplay() {
    const frames = document.querySelectorAll('.matrix-frame-node');
    const dots = document.querySelectorAll('.matrix-nav-dot');
    if (!frames.length) return;
    frames.forEach((f, idx) => f.classList.toggle('active-frame', idx === activeFrameIndex));
    dots.forEach((d, idx) => d.classList.toggle('active-dot', idx === activeFrameIndex));
}
function cycleGalleryFrameNext() {
    const frames = document.querySelectorAll('.matrix-frame-node');
    if (!frames.length) return;
    activeFrameIndex = (activeFrameIndex + 1) % frames.length;
    updateGalleryFrameDisplay();
    resetGalleryRotationTimer();
}
function jumpToGalleryFrameIndex(idx) {
    activeFrameIndex = idx;
    updateGalleryFrameDisplay();
    resetGalleryRotationTimer();
}
function resetGalleryRotationTimer() {
    clearInterval(galleryRotationInterval);
    galleryRotationInterval = setInterval(() => {
        const frames = document.querySelectorAll('.matrix-frame-node');
        if (frames.length) {
            activeFrameIndex = (activeFrameIndex + 1) % frames.length;
            updateGalleryFrameDisplay();
        }
    }, 3500);
}

// ---------- Odometer ----------
function runOdometerAnimation() {
    const counterElement = document.getElementById('animatedCounterNode');
    if (!counterElement) return;
    const target = parseInt(counterElement.getAttribute('data-target-value')) || 0;
    const duration = 2000;
    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counterElement.innerText = Math.floor(eased * target).toLocaleString();
        if (progress < 1) requestAnimationFrame(updateCounter);
        else counterElement.innerText = target.toLocaleString();
    }
    requestAnimationFrame(updateCounter);
}

// ---------- Terminal typing ----------
const termLines = [
    { text: "system_status --verify-integrity", isCmd: true },
    { text: "[SUCCESS] UI rendering thread matched structural asset bounds.", isCmd: false },
    { text: "network_gateway --status", isCmd: true },
    { text: "[ONLINE] Static page compilation successfully loaded.", isCmd: false }
];

let terminalStarted = false;
async function typeTerminal() {
    if (terminalStarted) return;
    terminalStarted = true;

    const term = document.getElementById('linux-terminal');
    if (!term) return;
    term.innerHTML = '';
    const cursor = '<span class="blinking-cursor">_</span>';

    for (let i = 0; i < termLines.length; i++) {
        const line = termLines[i];
        const p = document.createElement('p');
        term.appendChild(p);

        if (line.isCmd) {
            const prompt = '<span class="term-accent">user@beatwave:~$</span> ';
            for (let c = 0; c <= line.text.length; c++) {
                p.innerHTML = prompt + line.text.substring(0, c) + cursor;
                await new Promise(r => setTimeout(r, 28));
            }
            p.innerHTML = prompt + line.text;
            await new Promise(r => setTimeout(r, 300));
        } else {
            p.className = 'term-success';
            p.innerHTML = line.text;
            await new Promise(r => setTimeout(r, 420));
        }
    }
    const finalP = document.createElement('p');
    finalP.innerHTML = '<span class="term-accent">user@beatwave:~$</span> ' + cursor;
    term.appendChild(finalP);
}

// ---------- Text scramble ----------
class TextScramble {
    constructor(el) {
        this.el = el;
        this.chars = '!<>-_\\/[]{}—=+*^?#________';
        this.update = this.update.bind(this);
    }
    setText(newText) {
        const oldText = this.el.innerText;
        const length = Math.max(oldText.length, newText.length);
        const promise = new Promise((resolve) => this.resolve = resolve);
        this.queue = [];
        for (let i = 0; i < length; i++) {
            const from = oldText[i] || '';
            const to = newText[i] || '';
            const start = Math.floor(Math.random() * 40);
            const end = start + Math.floor(Math.random() * 40);
            this.queue.push({ from, to, start, end });
        }
        cancelAnimationFrame(this.frameId);
        this.frame = 0;
        this.update();
        return promise;
    }
    update() {
        let output = '';
        let complete = 0;
        for (let i = 0, n = this.queue.length; i < n; i++) {
            let { from, to, start, end, char } = this.queue[i];
            if (this.frame >= end) { complete++; output += to; }
            else if (this.frame >= start) {
                if (!char || Math.random() < 0.28) { char = this.randomChar(); this.queue[i].char = char; }
                output += `<span style="color: var(--text-mid)">${char}</span>`;
            } else { output += from; }
        }
        this.el.innerHTML = output;
        if (complete === this.queue.length) { this.resolve(); }
        else { this.frameId = requestAnimationFrame(this.update); this.frame++; }
    }
    randomChar() { return this.chars[Math.floor(Math.random() * this.chars.length)]; }
}

// ---------- Particle wave field (perf-tuned) ----------
function buildPermutationTable(seed) {
    const table = new Uint8Array(256);
    for (let i = 0; i < 256; i++) table[i] = i;
    let s = seed * 65536;
    for (let i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const n = Math.floor((s / 2147483647) * (i + 1));
        const q = table[i]; table[i] = table[n]; table[n] = q;
    }
    return table;
}

function createNoise2D(seed = Math.random()) {
    const p = buildPermutationTable(seed);
    const perm = new Uint8Array(512);
    const permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        perm[i] = p[i & 255];
        permMod12[i] = perm[i] % 12;
    }
    const grad2 = [
        [1, 1], [-1, 1], [1, -1], [-1, -1],
        [1, 0], [-1, 0], [1, 0], [-1, 0],
        [0, 1], [-0, 1], [0, 1], [-0, 1]
    ];
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    return function noise2D(x, y) {
        let n0 = 0, n1 = 0, n2 = 0;
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const t = (i + j) * G2;
        const X0 = i - t, Y0 = j - t;
        const x0 = x - X0, y0 = y - Y0;
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
        const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
        const ii = i & 255, jj = j & 255;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            t0 *= t0;
            const gi0 = permMod12[ii + perm[jj]];
            n0 = t0 * t0 * (grad2[gi0][0] * x0 + grad2[gi0][1] * y0);
        }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            t1 *= t1;
            const gi1 = permMod12[ii + i1 + perm[jj + j1]];
            n1 = t1 * t1 * (grad2[gi1][0] * x1 + grad2[gi1][1] * y1);
        }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            t2 *= t2;
            const gi2 = permMod12[ii + 1 + perm[jj + 1]];
            n2 = t2 * t2 * (grad2[gi2][0] * x2 + grad2[gi2][1] * y2);
        }
        return 70 * (n0 + n1 + n2);
    };
}

const canvas = document.getElementById('particle-canvas');
const ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;
let mouse = { x: -100, y: -100, sx: -100, sy: -100, lx: -100, ly: -100, vs: 0, a: 0, set: false };
let isMobile = window.innerWidth <= 768;
let lines = [];
let noise2D = createNoise2D();
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initParticles() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    isMobile = window.innerWidth <= 768;

    lines = [];
    // Perf: high-efficiency spacing (56px on mobile for ~100 points, 16px/12px on desktop)
    const spacing = isMobile ? 56 : (window.innerWidth < 1200 ? 16 : 12);

    const totalLines = Math.ceil(canvas.width / spacing) + 4;
    const totalPoints = Math.ceil(canvas.height / spacing) + 4;

    for (let i = 0; i < totalLines; i++) {
        const points = [];
        for (let j = 0; j < totalPoints; j++) {
            const baseX = -20 + spacing * i;
            const baseY = -20 + spacing * j;
            points.push({ baseX, baseY, x: baseX, y: baseY, waveX: 0, waveY: 0, cx: 0, cy: 0, vx: 0, vy: 0 });
        }
        lines.push(points);
    }
}

function animateParticles(time = 0) {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isLight = document.body.classList.contains('light-theme');
    ctx.strokeStyle = isLight ? 'rgba(13, 21, 38, 0.07)' : 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    // Mobile ultra-fast liquid wave: zero mouse calculations, pure 60fps performance
    if (isMobile) {
        for (let i = 0; i < lines.length; i++) {
            const points = lines[i];
            ctx.beginPath();
            for (let j = 0; j < points.length; j++) {
                const p = points[j];
                const waveY = Math.sin((p.baseX * 0.004) + (time * 0.0012) + (j * 0.18)) * 8;
                const drawX = p.baseX;
                const drawY = p.baseY + waveY;
                if (j === 0) ctx.moveTo(drawX, drawY);
                else ctx.lineTo(drawX, drawY);
            }
            ctx.stroke();
        }
        animationFrameId = requestAnimationFrame(animateParticles);
        return;
    }

    mouse.sx += (mouse.x - mouse.sx) * 0.1;
    mouse.sy += (mouse.y - mouse.sy) * 0.1;
    const dx = mouse.x - mouse.lx;
    const dy = mouse.y - mouse.ly;
    const d = Math.hypot(dx, dy);
    mouse.vs += (d - mouse.vs) * 0.1;
    mouse.vs = Math.min(100, mouse.vs);
    mouse.lx = mouse.x;
    mouse.ly = mouse.y;
    mouse.a = Math.atan2(dy, dx);

    const mSize = Math.max(175, mouse.vs);

    for (let i = 0; i < lines.length; i++) {
        const points = lines[i];
        ctx.beginPath();
        for (let j = 0; j < points.length; j++) {
            const p = points[j];
            const move = noise2D((p.baseX + time * 0.008) * 0.003, (p.baseY + time * 0.003) * 0.002) * 8;
            p.waveX = Math.cos(move) * 12;
            p.waveY = Math.sin(move) * 6;

            const mdx = p.baseX - mouse.sx;
            const mdy = p.baseY - mouse.sy;
            const md = Math.hypot(mdx, mdy);

            if (md < mSize) {
                const s = 1 - md / mSize;
                const f = Math.cos(md * 0.001) * s;
                p.vx += Math.cos(mouse.a) * f * mSize * mouse.vs * 0.00035;
                p.vy += Math.sin(mouse.a) * f * mSize * mouse.vs * 0.00035;
            }

            p.vx += (0 - p.cx) * 0.01;
            p.vy += (0 - p.cy) * 0.01;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.cx += p.vx;
            p.cy += p.vy;
            p.cx = Math.min(50, Math.max(-50, p.cx));
            p.cy = Math.min(50, Math.max(-50, p.cy));

            const drawX = p.baseX + p.waveX + p.cx;
            const drawY = p.baseY + p.waveY + p.cy;

            if (j === 0) ctx.moveTo(drawX, drawY);
            else ctx.lineTo(drawX, drawY);
        }
        ctx.stroke();
    }
    animationFrameId = requestAnimationFrame(animateParticles);
}

let animationFrameId = null;

// Pause the field when the tab is hidden (battery saver)
document.addEventListener('visibilitychange', () => {
    if (!canvas) return;
    if (document.hidden) {
        if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    } else if (!animationFrameId && !prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(animateParticles);
    }
});

// ---------- Mouse + cursor glow ----------
let transformUpdatePending = false;
window.addEventListener('mousemove', (e) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;

    if (!mouse.set) {
        mouse.sx = mouse.x; mouse.sy = mouse.y;
        mouse.lx = mouse.x; mouse.ly = mouse.y;
        mouse.set = true;
    }

    if (!isMobile) document.body.classList.add('cursor-active');

    const cursorGlow = document.getElementById('cursor-glow');
    if (!transformUpdatePending && !isMobile && cursorGlow) {
        transformUpdatePending = true;
        requestAnimationFrame(() => {
            cursorGlow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
            transformUpdatePending = false;
        });
    }
}, { passive: true });

window.addEventListener('mouseout', () => {
    mouse.x = -100;
    mouse.y = -100;
});

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(initParticles, 300);
});

// ---------- Scroll reveal + tracker ----------
let activeScrollObserver = null;
let scrollPending = false;
let textScrambleInstance = null;

function scrollReveal() {
    if (!scrollPending) {
        scrollPending = true;
        requestAnimationFrame(() => {
            const reveals = document.querySelectorAll('.reveal');
            const triggerBottom = window.innerHeight - 40;
            reveals.forEach(el => {
                if (el.getBoundingClientRect().top < triggerBottom) el.classList.add('active');
            });
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const tracker = document.getElementById("scroll-tracker");
            if (tracker && height > 0) tracker.style.width = (winScroll / height) * 100 + "%";
            scrollPending = false;
        });
    }
}
window.addEventListener('scroll', scrollReveal, { passive: true });

function refreshRenderObservers() {
    const targetEl = document.getElementById('scramble-target');
    if (targetEl) {
        textScrambleInstance = new TextScramble(targetEl);
        const phrases = [
            'Engineered For Pure Audio.',
            'Zero Ads. Zero Tracking.',
            'Open Source. Forever.'
        ];
        let phraseIndex = 0;
        const rotateScramble = () => {
            phraseIndex = (phraseIndex + 1) % phrases.length;
            textScrambleInstance.setText(phrases[phraseIndex]).then(() => {
                setTimeout(rotateScramble, 2600);
            });
        };
        setTimeout(rotateScramble, 3200);
    }

    // Bento card 3D tilt (desktop only)
    const cardsList = document.querySelectorAll('.bento-card');
    cardsList.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            if (isMobile) return;
            const rect = card.getBoundingClientRect();
            const xc = rect.width / 2, yc = rect.height / 2;
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            const dx = (x - xc) / (xc || 1);
            const dy = (y - yc) / (yc || 1);
            card.style.transform = `perspective(1000px) rotateY(${dx * 3}deg) rotateX(${-dy * 3}deg) translateY(-2px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

    // Terminal observer
    if ('IntersectionObserver' in window) {
        activeScrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    typeTerminal();
                    activeScrollObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.6 });
        const termElement = document.getElementById('linux-terminal');
        if (termElement) activeScrollObserver.observe(termElement);
    }

    scrollReveal();
}

// ---------- Boot ----------
/* ── Smooth scroll — JS with nav offset ─────────────────── */
function initSmoothScroll() {
    const nav = document.querySelector('nav:not(.mobile-dock)');
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const hash = a.getAttribute('href');
            if (hash === '#') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
            const id = hash.slice(1);
            const target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            const offset = (nav ? nav.offsetHeight : 64) + 20;
            const top = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            // update mobile dock active state
            document.querySelectorAll('.dock-item').forEach(d => d.classList.remove('active'));
            const dockMatch = document.querySelector(`.dock-item[href="${hash}"]`);
            if (dockMatch) dockMatch.classList.add('active');
        });
    });
}

/* ── Antigravity / parallax scroll (Desktop only, clamped) ── */
function initAntigravity() {
    if (prefersReducedMotion || window.innerWidth <= 768) return;
    const els = document.querySelectorAll('[data-ag]');
    if (!els.length) return;

    let ticking = false;
    function applyAg() {
        const sy = window.scrollY;
        els.forEach(el => {
            const factor = parseFloat(el.dataset.ag) || 0.05;
            // Clamp displacement to prevent elements drifting out of view
            const offset = Math.max(-30, -sy * factor);
            el.style.transform = `translateY(${offset}px)`;
        });
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) { requestAnimationFrame(applyAg); ticking = true; }
    }, { passive: true });
}

/* ── Curtain reveal ─────────────────────────────────────── */
function buildCurtainPanels() {
    const screen = document.getElementById('loading-screen');
    const container = document.getElementById('curtain-container');
    if (!container) return;
    const isSmall = window.innerWidth <= 640;
    const count = isSmall ? 5 : 8;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const panel = document.createElement('div');
        panel.className = 'curtain-panel';
        const inner = document.createElement('div');
        inner.className = 'curtain-panel-inner';
        panel.appendChild(inner);
        container.appendChild(panel);
    }
    // Once opaque panels are attached, ensure screen background is transparent so curtain lifts reveal the site
    if (screen) screen.style.background = 'transparent';
}

function triggerCurtainReveal(onDone) {
    const screen = document.getElementById('loading-screen');
    const overlay = screen ? screen.querySelector('.curtain-logo-overlay') : null;
    const panels  = screen ? screen.querySelectorAll('.curtain-panel-inner') : [];

    if (!screen || !panels.length) {
        if (screen) screen.style.display = 'none';
        if (onDone) onDone();
        return;
    }

    // 1. Instantly release pointer-events and guarantee background transparency
    screen.classList.add('revealing');
    screen.style.background = 'transparent';

    // 2. Fade & progressively blur out the logo overlay smoothly
    if (overlay) overlay.classList.add('fade-out-logo');

    const isSmall = window.innerWidth <= 640;
    const STAGGER = isSmall ? 38 : 50;
    const DURATION = 820;

    // 3. Lift panels upward in silky staggered cascade
    setTimeout(() => {
        panels.forEach((inner, i) => {
            setTimeout(() => {
                inner.style.transform = 'translateY(-100%)';
            }, i * STAGGER);
        });

        // 4. Smoothly fade out screen container after all panels complete their sweep
        const totalMs = (panels.length - 1) * STAGGER + DURATION + 40;
        setTimeout(() => {
            screen.classList.add('fade-out');
            setTimeout(() => {
                screen.style.display = 'none';
                if (onDone) onDone();
            }, 350);
        }, totalMs);
    }, 280);
}

function startApp() {
    setupFaqAccordions();
    resetGalleryRotationTimer();

    initParticles();
    if (!prefersReducedMotion) {
        animateParticles();
    } else {
        // Static render, no animation loop
        animateParticlesOnce();
    }

    refreshRenderObservers();
    initSmoothScroll();
    buildCurtainPanels();
    initAntigravity();

    // Progress bar runs for 3 s, then curtain reveals
    initProgressBarEngine(() => {
        triggerCurtainReveal(() => runOdometerAnimation());
    });
}

function animateParticlesOnce() {
    if (!ctx || !canvas) return;
    // Draw one static frame
    const isLight = document.body.classList.contains('light-theme');
    ctx.strokeStyle = isLight ? 'rgba(13, 21, 38, 0.07)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < lines.length; i++) {
        const points = lines[i];
        ctx.beginPath();
        for (let j = 0; j < points.length; j++) {
            const p = points[j];
            const drawX = p.baseX, drawY = p.baseY;
            if (j === 0) ctx.moveTo(drawX, drawY);
            else ctx.lineTo(drawX, drawY);
        }
        ctx.stroke();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
