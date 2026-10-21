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

    const hashText = async (str) => {
        const buf = new TextEncoder().encode(str);
        const digest = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const handleLogin = async () => {
        const inputHash = await hashText(passInput.value.trim());
        // Cryptographic one-way hash: plaintext password is never revealed in frontend code
        if (inputHash === '006657998771eb1ef75d0a26f8824af99da8bf4f7261d3a4d896708286a618eb') {
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

// ---------- Theme System ----------
function applyTheme(theme, persist) {
    const isLight = theme === 'light';
    if (isLight) {
        document.documentElement.classList.add('light-theme');
        document.body.classList.add('light-theme');
    } else {
        document.documentElement.classList.remove('light-theme');
        document.body.classList.remove('light-theme');
    }

    // Keep native UI (scrollbars, form controls, caret) in sync with the theme
    document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';

    if (persist) {
        try {
            localStorage.setItem('beatwave-theme', isLight ? 'light' : 'dark');
        } catch (e) {}
    }

    // Sync all theme toggle icons across desktop navbar, mobile header, side menu, and floating rail
    document.querySelectorAll('.theme-toggle-btn, #themeToggleBtn').forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
        }
        btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
        btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
        btn.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
        // Kick a quick icon spin so the toggle feels physical (only on user toggle)
        if (icon) {
            icon.classList.remove('theme-spin');
            if (persist) {
                void icon.offsetWidth; // restart animation
                icon.classList.add('theme-spin');
            }
        }
    });

    // Sync browser theme-color meta tag for mobile status bars
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isLight ? '#fafafa' : '#000000');
    }
}

// Circular ripple reveal from the clicked toggle button — mirrors cosmictaser.de5.net
function toggleThemeWithRipple(event) {
    const currentIsLight = document.body.classList.contains('light-theme') ||
                           document.documentElement.classList.contains('light-theme');
    const nextTheme = currentIsLight ? 'dark' : 'light';

    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof document.startViewTransition !== 'function' || reducedMotion) {
        applyTheme(nextTheme, true);
        return;
    }

    const x = (event && event.clientX) || window.innerWidth - 48;
    const y = (event && event.clientY) || 48;
    const root = document.documentElement;

    root.classList.add('theme-ripple');
    let transition;
    try {
        transition = document.startViewTransition(() => applyTheme(nextTheme, true));
    } catch (e) {
        root.classList.remove('theme-ripple');
        applyTheme(nextTheme, true);
        return;
    }

    const cleanup = () => root.classList.remove('theme-ripple');
    transition.ready
        .then(() => {
            const maxRadius = Math.hypot(
                Math.max(x, window.innerWidth - x),
                Math.max(y, window.innerHeight - y)
            );
            root.animate(
                [
                    { clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' },
                    { clipPath: 'circle(' + maxRadius + 'px at ' + x + 'px ' + y + 'px)' }
                ],
                {
                    duration: 850,
                    easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
                    fill: 'forwards',
                    pseudoElement: '::view-transition-new(root)'
                }
            );
        })
        .catch(() => {})
        .then(() => transition.finished.catch(() => {}))
        .then(cleanup, cleanup);
}

function initThemeSystem() {
    // Read saved theme or detect from document element (set by head script)
    const savedTheme = localStorage.getItem('beatwave-theme') ||
        (document.documentElement.classList.contains('light-theme') ? 'light' : 'dark');
    applyTheme(savedTheme, false);

    // Global event delegation for all theme toggle buttons
    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.theme-toggle-btn, #themeToggleBtn');
        if (toggleBtn) {
            e.preventDefault();
            toggleThemeWithRipple(e);
        }
    });
}

initThemeSystem();

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
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)';
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
        if (card.classList.contains('bento-card--lyrics')) return;
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
let lenis = null;

function initSmoothScroll() {
    const nav = document.querySelector('nav:not(.mobile-dock)');
    if (window.Lenis && !lenis) {
        lenis = new Lenis({
            duration: 1.1,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            smoothTouch: false
        });
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const hash = a.getAttribute('href');
            if (hash === '#') { e.preventDefault(); if (lenis) lenis.scrollTo(0, { offset: 0 }); else window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
            const id = hash.slice(1);
            const target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            const offset = (nav ? nav.offsetHeight : 64) + 20;
            if (lenis) {
                lenis.scrollTo(target, { offset: -offset });
            } else {
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
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
    container.innerHTML = '<div class="curtain-panel"><div class="curtain-panel-inner"></div></div>';
    if (screen) screen.style.background = 'transparent';
}

function triggerCurtainReveal(onDone) {
    const screen = document.getElementById('loading-screen');
    const overlay = screen ? screen.querySelector('.curtain-logo-overlay') : null;
    const inner = screen ? screen.querySelector('.curtain-panel-inner') : null;

    if (!screen) {
        if (onDone) onDone();
        return;
    }

    // 1. Instantly release pointer-events and guarantee background transparency
    screen.classList.add('revealing');
    screen.style.background = 'transparent';

    // 2. Fade & progressively blur out the logo overlay smoothly
    if (overlay) overlay.classList.add('fade-out-logo');

    // 3. Lift the seamless curtain upward like a luxury stage reveal (zero lines, zero slices)
    setTimeout(() => {
        if (inner) {
            inner.style.transform = 'translateY(-100%)';
        }

        // 4. Smoothly hide screen container after curtain completes its sweep
        setTimeout(() => {
            screen.classList.add('fade-out');
            setTimeout(() => {
                screen.style.display = 'none';
                if (onDone) onDone();
            }, 300);
        }, 860);
    }, 240);
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
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.1)';
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

/* ── Nav ground state (OpenTune restyle) ─────────────────────
   Paints the sticky nav in three states, purely via classes:
     · (none)   solid tint — seamless with the tint hero
     · raised   frosted tint — scrolling within the hero
     · solid    dark (light theme: frosted white) — past the hero
   Complements the ripple theme toggle; no styles are set inline. */
(function initNavGroundState() {
    const navEl = document.querySelector('nav:not(.mobile-dock)');
    const heroEl = document.querySelector('.hero');
    if (!navEl || !heroEl) return;

    let navTicking = false;

    function updateNavGround() {
        navTicking = false;
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        // Hero bottom edge in viewport space — robust against transforms
        const heroBottom = heroEl.getBoundingClientRect().bottom;
        const navH = navEl.offsetHeight;
        const pastHero = heroBottom <= navH;
        navEl.classList.toggle('raised', !pastHero && y > 4);
        navEl.classList.toggle('solid', pastHero);
    }

    window.addEventListener('scroll', function () {
        if (!navTicking) {
            navTicking = true;
            requestAnimationFrame(updateNavGround);
        }
    }, { passive: true });
    window.addEventListener('resize', updateNavGround, { passive: true });
    updateNavGround();
})();

/* ── Showcase features (Opentune port) ───────────────────────
   · Phone preview — single device, crossfading screens on a
     timer, advance on click, 3D tilt on hover
   · Artwork colour chapter — sticky cover deck, the section
     wash follows the active sleeve
   · Word-synced lyrics demo — rAF sweep + style pills
   Additive: every hook is guarded and reduced-motion falls
   back to a static composition. */
(function initShowcaseScroll() {
    const hub = document.querySelector('.gallery-section .workspace-gallery-hub');
    const stage = hub && hub.querySelector('.pin-stage');
    const wrap = hub && hub.querySelector('.rail-wrap');
    const rail = hub && hub.querySelector('.rail');
    const crate = document.querySelector('.crate-section');
    const crateStage = crate && crate.querySelector('.crate-stage');
    const cards = crate ? Array.prototype.slice.call(crate.querySelectorAll('.cardx')) : [];
    const steps = crate ? Array.prototype.slice.call(crate.querySelectorAll('.crate-steps li')) : [];
    const navEl = document.querySelector('nav:not(.mobile-dock)');
    const dockEl = document.querySelector('.mobile-dock');
    // Cover washes — must match the .sw swatches in the markup
    const TINTS = ['#d2536b', '#7d68ff', '#17a2c6', '#e0447f', '#f0a13c'];
    if (!hub && !crate) return;

    let navH = 72;
    let travel = 0;
    let ticking = false;
    const clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

    function setChrome() {
        navH = navEl && navEl.offsetHeight ? navEl.offsetHeight : 72;
        let dockH = 0;
        if (dockEl && dockEl.offsetHeight && getComputedStyle(dockEl).display !== 'none') dockH = dockEl.offsetHeight;
        document.documentElement.style.setProperty('--ot-nav-h', navH + 'px');
        document.documentElement.style.setProperty('--ot-dock-h', dockH + 'px');
    }

    function layoutRail() {
        if (!hub || !stage || !rail || !wrap) return;
        rail.style.transform = '';
        const full = Math.max(0, rail.scrollWidth - wrap.clientWidth);
        if (full >= 120) {
            hub.classList.add('pinned');
            travel = full;
            hub.style.height = (stage.offsetHeight + travel) + 'px';
        } else {
            hub.classList.remove('pinned');
            hub.style.height = '';
            travel = 0;
        }
    }

    let curStep = -1;
    function paintCrate(i) {
        if (i === curStep || !cards.length) return;
        curStep = i;
        if (crate) crate.style.setProperty('--wash', TINTS[i] || TINTS[0]);
        steps.forEach(function (li, k) { li.classList.toggle('on', k === i); });
        cards.forEach(function (c, k) {
            c.classList.toggle('on', k === i);
            c.classList.toggle('past', k < i);
        });
    }

    function update() {
        if (hub && stage && rail && travel > 0 && hub.classList.contains('pinned')) {
            const range = hub.offsetHeight - stage.offsetHeight;
            const p = range > 0 ? clamp01((navH - hub.getBoundingClientRect().top) / range) : 0;
            rail.style.transform = 'translate3d(' + (-p * travel).toFixed(1) + 'px,0,0)';
        }
        if (crate && crateStage && cards.length) {
            const range = crate.offsetHeight - crateStage.offsetHeight;
            const p = range > 8 ? clamp01((navH - crate.getBoundingClientRect().top) / range) : 0;
            paintCrate(Math.min(cards.length - 1, Math.floor(p * cards.length)));
        }
    }

    function onScroll() {
        update();
    }

    function layout() { setChrome(); layoutRail(); update(); }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', layout, { passive: true });
    window.addEventListener('load', layout);
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(layout).catch(function () {});
    }
    layout();
    // Poll so the artwork chapter stays in sync even when rAF/scroll events are throttled
    if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setInterval(update, 120);
    }
})();

(function initLyricsDemo() {
    const kar = document.getElementById('karaoke');
    const bar = document.getElementById('lyric-styles');
    if (!kar) return;
    const LINES = [
        'Midnight, and the city glows,',
        'headphones on, the noise lets go,',
        'every beat we hold tonight,',
        'plays the song we already know.'
    ];
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const lines = LINES.map(function (text) {
        const line = document.createElement('div');
        line.className = 'k-line next';
        let acc = 0;
        const words = text.split(' ').map(function (w) {
            line.appendChild(document.createTextNode(' '));
            const ws = document.createElement('span');
            ws.className = 'wrd';
            const chars = Array.prototype.map.call(w, function (ch) {
                const c = document.createElement('span');
                c.className = 'ch';
                c.textContent = ch;
                ws.appendChild(c);
                return c;
            });
            line.appendChild(ws);
            const dur = 150 + w.length * 46 + (/[,.;:!?—’]$/.test(w) ? 280 : 0);
            const word = { el: ws, chars: chars, start: acc, dur: dur, sung: false };
            acc += dur;
            return word;
        });
        kar.appendChild(line);
        return { el: line, words: words, start: 0, dur: acc + 900, state: '' };
    });
    let total = 0;
    lines.forEach(function (l) { l.start = total; total += l.dur; });

    function setP(word, p) {
        const n = word.chars.length;
        for (let i = 0; i < n; i++) {
            const cp = p <= 0 ? 0 : p >= 1 ? 1 : Math.min(1, Math.max(0, (p * (n + 1.4) - i) / 1.4));
            word.chars[i].style.setProperty('--p', cp.toFixed(3));
        }
    }
    function unSung(w) { if (w.sung) { w.sung = false; w.el.classList.remove('sung'); } }
    function setState(l, st) {
        if (l.state === st) return;
        l.state = st;
        l.el.classList.toggle('now', st === 'now');
        l.el.classList.toggle('next', st === 'next');
        l.el.classList.toggle('past', st === 'past');
        if (st === 'next') l.words.forEach(function (w) { setP(w, 0); unSung(w); });
        else if (st === 'past') l.words.forEach(function (w) { setP(w, 1); unSung(w); });
    }
    function paint(t) {
        for (let li = 0; li < lines.length; li++) {
            const l = lines[li];
            const lt = t - l.start;
            if (lt < 0) { setState(l, 'next'); continue; }
            if (lt >= l.dur) { setState(l, 'past'); continue; }
            setState(l, 'now');
            for (let wi = 0; wi < l.words.length; wi++) {
                const w = l.words[wi];
                const wt = lt - w.start;
                const p = wt <= 0 ? 0 : Math.min(1, wt / w.dur);
                setP(w, p);
                if (p > 0 && !w.sung) { w.sung = true; w.el.classList.add('sung'); }
            }
        }
    }

    // Style pills — only the paint mechanism changes
    let activeBtn = bar ? bar.querySelector('.pill.on') : null;
    function applyStyle(name) { kar.className = 'karaoke style-' + name; }
    if (bar) {
        bar.addEventListener('click', function (e) {
            const btn = e.target && e.target.closest ? e.target.closest('.pill') : null;
            if (!btn || !btn.getAttribute('data-style')) return;
            if (activeBtn) activeBtn.classList.remove('on');
            activeBtn = btn;
            btn.classList.add('on');
            applyStyle(btn.getAttribute('data-style'));
        });
    }
    applyStyle((activeBtn && activeBtn.getAttribute('data-style')) || 'karaoke');

    // Static fill for reduced motion — first line sung, the rest waiting
    if (still) { paint(lines[0].dur); return; }

    // Run only while the well is near the viewport
    let visible = true;
    if ('IntersectionObserver' in window) {
        visible = false;
        const io = new IntersectionObserver(function (entries) {
            visible = entries[0].isIntersecting;
        }, { rootMargin: '120px' });
        io.observe(kar);
    }

    const t0 = performance.now();
    (function frame(now) {
        requestAnimationFrame(frame);
        if (!visible || document.hidden) return;
        paint((now - t0) % total);
    })(performance.now());
})();

/* ── Phone preview showcase (scroll-locked) ─────────────────
   One device, five screens. The phone stays pinned while the
   section scrolls; scroll progress drives the active screen.
   Click a dot/arrow to jump (and scroll to that screen's
   position). Hover tilts the device toward the cursor. */
(function initPhoneShowcase() {
    const root = document.getElementById('phone-showcase');
    const phone = document.getElementById('phone');
    const section = document.querySelector('.gallery-section');
    if (!root || !phone || !section) return;

    const SHOTS = [
        { src: 'beatwave%20home-portrait.png', name: 'Home', desc: 'Your library, up front' },
        { src: 'beatwave%20search-portrait.png', name: 'Search', desc: 'Results as you type' },
        { src: 'beatwave%20album-portrait.png', name: 'Albums', desc: 'Sleeves in full' },
        { src: 'beatwave%20player-portrait.png', name: 'Player', desc: 'Out of the way' },
        { src: 'beatwave%20abt-portrait.png', name: 'About', desc: 'The story, in-app' }
    ];

    const shots = Array.prototype.slice.call(phone.querySelectorAll('.phone-shot'));
    const nameEl = document.getElementById('phone-name');
    const descEl = document.getElementById('phone-desc');
    const dots = Array.prototype.slice.call(root.querySelectorAll('.phone-dot'));
    const prevBtn = document.getElementById('phone-prev');
    const nextBtn = document.getElementById('phone-next');
    const navEl = document.querySelector('nav:not(.mobile-dock)');

    const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const n = SHOTS.length;
    let idx = 0;
    let manualUntil = 0;

    function show(i) {
        i = (i + n) % n;
        if (i === idx && shots[idx].classList.contains('on')) return;
        idx = i;
        shots.forEach(function (el, k) { el.classList.toggle('on', k === idx); });
        dots.forEach(function (el, k) { el.classList.toggle('on', k === idx); });
        if (nameEl) nameEl.textContent = SHOTS[idx].name;
        if (descEl) descEl.textContent = SHOTS[idx].desc;
    }

    function navH() { return (navEl && navEl.offsetHeight) ? navEl.offsetHeight : 72; }

    function updateFromScroll() {
        if (reduced) return;
        if (Date.now() < manualUntil) return;
        const rect = section.getBoundingClientRect();
        const stageH = root.offsetHeight || (window.innerHeight - navH());
        const range = section.offsetHeight - stageH;
        if (range <= 0) { show(0); return; }
        const p = Math.min(1, Math.max(0, (navH() - rect.top) / range));
        const i = Math.min(n - 1, Math.floor(p * n));
        if (i !== idx) show(i);
    }

    function scrollToScreen(i) {
        i = (i + n) % n;
        show(i);
        manualUntil = Date.now() + 900;
        const stageH = root.offsetHeight || (window.innerHeight - navH());
        const range = section.offsetHeight - stageH;
        if (range <= 0) return;
        const p = Math.min(1, Math.max(0, (i + 0.5) / n));
        const docTop = section.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: docTop + p * range, behavior: reduced ? 'auto' : 'smooth' });
    }

    // Click controls — jump and scroll to that screen's position
    if (prevBtn) prevBtn.addEventListener('click', function () { scrollToScreen((idx - 1 + n) % n); });
    if (nextBtn) nextBtn.addEventListener('click', function () { scrollToScreen((idx + 1) % n); });
    dots.forEach(function (d) {
        d.addEventListener('click', function () {
            const i = parseInt(d.getAttribute('data-i'), 10);
            if (!isNaN(i)) scrollToScreen(i);
        });
    });

    // Hover tilt
    phone.addEventListener('pointerenter', function () {});
    phone.addEventListener('pointerleave', function () { phone.style.transform = ''; });
    phone.addEventListener('pointermove', function (e) {
        if (reduced || e.pointerType !== 'mouse') return;
        const r = phone.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -14;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 18;
        phone.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
    });

    // Keyboard
    root.setAttribute('tabindex', '0');
    root.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { scrollToScreen((idx - 1 + n) % n); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { scrollToScreen((idx + 1) % n); e.preventDefault(); }
    });

    if (!reduced) {
        window.__phonePoll = setInterval(updateFromScroll, 120);
        window.addEventListener('resize', updateFromScroll, { passive: true });
        updateFromScroll();
    }

    show(0);
})();


/* ── GitHub downloads sync ──────────────────────────────────
   Keeps the landing-page download counter in sync with the
   GitHub release download counts (same source as web.js). */
(function initGithubDownloads() {
    async function fetchGithubDownloads() {
        try {
            const response = await fetch('https://api.github.com/repos/beatlabs790/beatwave/releases');
            if (!response.ok) return;
            const releases = await response.json();
            let totalDownloads = 0;
            releases.forEach(function (release) {
                if (release.assets) {
                    release.assets.forEach(function (asset) {
                        if (asset.download_count) totalDownloads += asset.download_count;
                    });
                }
            });
            if (totalDownloads > 0) {
                const counterNode = document.getElementById('animatedCounterNode');
                if (counterNode) {
                    counterNode.setAttribute('data-target-value', totalDownloads);
                    const current = parseInt(counterNode.getAttribute('data-current')) || 0;
                    if (current > 0 && typeof runOdometerAnimation === 'function') runOdometerAnimation();
                    counterNode.setAttribute('data-current', totalDownloads);
                }
                if (typeof adminDb !== 'undefined' && adminDb) {
                    try { adminDb.ref('downloads').set(totalDownloads); } catch (e) {}
                }
            }
        } catch (e) {
            console.error('Error fetching GitHub downloads:', e);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fetchGithubDownloads);
    } else {
        fetchGithubDownloads();
    }
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
