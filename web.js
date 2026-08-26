// BeatWave Cloud Connect Web Player Controller
let keys = [
    'AIzaSyCFLTX60NK5Se541Wc2teszaOQBWtisZ30',
    'AIzaSyAP6UP1GmMgE71FSHlRtpO9rLghpnoOt_4',
    'AIzaSyABN_mfpf5kK7g68OhNx5c6pJuL4NMzitg'
];
let keyIndex = 0;

let db = null;
let adminDb = null;

// Initialize HLS Background Video
function initBackgroundVideo() {
    const video = document.getElementById('bg-video');
    if (!video) return;
    const streamUrl = 'https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8';

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
            maxMaxBufferLength: 10,
            enableWorker: true,
            lowLatencyMode: true
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            video.play().catch(e => console.log("Background video autoplay blocked. Waiting for interaction."));
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', function() {
            video.play().catch(e => console.log("Background video autoplay blocked."));
        });
    } else {
        console.warn("HLS streaming is not supported on this browser.");
    }
}

// Automatically Fetch Downloads from GitHub
async function fetchGithubDownloads() {
    try {
        const response = await fetch('https://api.github.com/repos/beatlabs790/beatwave/releases');
        if (!response.ok) return;
        const releases = await response.json();
        let totalDownloads = 0;
        releases.forEach(release => {
            if (release.assets) {
                release.assets.forEach(asset => {
                    if (asset.download_count) {
                        totalDownloads += asset.download_count;
                    }
                });
            }
        });
        if (totalDownloads > 0) {
            // Update admin panel input value
            const input = document.getElementById('admin-downloads-input');
            if (input) {
                input.value = totalDownloads;
            }
            // Update database ref for downloads dynamically if user is admin or if we want it synced
            if (adminDb) {
                adminDb.ref('downloads').set(totalDownloads);
            }
        }
    } catch (e) {
        console.error("Error fetching Github downloads:", e);
    }
}

// Initialize using config.js variables
if (typeof firebaseConfigs !== 'undefined') {
    // Initialize Admin Database for Maintenance checks and configuration details
    const adminApp = firebase.initializeApp(firebaseConfigs.adminConfig, "adminApp");
    adminDb = adminApp.database();
    setupAdminListenersAndUI();

    // Initialize Player Database for Room Castings
    const playerApp = firebase.initializeApp(firebaseConfigs.playerConfig);
    db = playerApp.database();
} else {
    console.error("Firebase configurations not found! Ensure config.js is loaded.");
}

// Live broadcast toast creator
function showLiveToast(message) {
    const existing = document.querySelectorAll('.live-broadcast-toast');
    existing.forEach(t => t.remove());

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

// Countdown variables
let countdownInterval = null;
function startCountdownTimerLoop(targetTime) {
    stopCountdownTimerLoop();
    
    const tick = () => {
        const remaining = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
        const timerValNode = document.getElementById('countdown-timer');
        
        if (remaining <= 0) {
            stopCountdownTimerLoop();
            if (timerValNode) timerValNode.innerText = "00:00";
            // Automatically trigger maintenance screen lockout!
            const mScreen = document.getElementById('maintenance-screen');
            if (mScreen) mScreen.classList.remove('maintenance-hidden');
            document.getElementById('countdown-banner').style.display = 'none';
            return;
        }
        
        const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
        const secs = (remaining % 60).toString().padStart(2, '0');
        if (timerValNode) timerValNode.innerText = `${mins}:${secs}`;
    };
    
    tick();
    countdownInterval = setInterval(tick, 1000);
}
function stopCountdownTimerLoop() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

function setupAdminListenersAndUI() {
    if (!adminDb) return;

    // Initialize Admin modal events and tabs
    setupAdminModalHandlers();

    // 1. Maintenance mode checking
    adminDb.ref('maintenance').on('value', snapshot => {
        const isMaintenance = snapshot.val() || false;
        const mScreen = document.getElementById('maintenance-screen');
        if (isMaintenance) {
            mScreen.classList.remove('maintenance-hidden');
        } else {
            mScreen.classList.add('maintenance-hidden');
        }
        const toggle = document.getElementById('admin-maintenance-toggle');
        if (toggle) toggle.checked = isMaintenance;
    });

    // 2. Announcement Listener
    adminDb.ref('announcementActive').on('value', activeSnap => {
        const isActive = activeSnap.val() || false;
        adminDb.ref('announcement').on('value', textSnap => {
            const text = textSnap.val() || "";
            const banner = document.getElementById('announcement-banner');
            const textNode = document.getElementById('announcement-text');
            
            if (isActive && text.trim() !== "") {
                textNode.innerText = text;
                banner.classList.remove('announcement-hidden');
            } else {
                banner.classList.add('announcement-hidden');
            }

            const toggle = document.getElementById('admin-announcement-toggle');
            const input = document.getElementById('admin-announcement-input');
            if (toggle) toggle.checked = isActive;
            if (input) input.value = text;
        });
    });

    // 3. Populate rest of admin panel config
    adminDb.ref('downloads').on('value', snap => {
        const input = document.getElementById('admin-downloads-input');
        if (input) input.value = snap.val() || 235;
    });
    adminDb.ref('downloadText').on('value', snap => {
        const input = document.getElementById('admin-btntext-input');
        if (input) input.value = snap.val() || "";
    });
    adminDb.ref('downloadLink').on('value', snap => {
        const input = document.getElementById('admin-btnlink-input');
        if (input) input.value = snap.val() || "";
    });

    // 4. Broadcast Message Listener
    adminDb.ref('broadcastMessage').on('value', snapshot => {
        const val = snapshot.val();
        if (val && val.text && val.ts) {
            if (Date.now() - val.ts < 15000) {
                showLiveToast(val.text);
            }
        }
    });

    // 5. Countdown Listener
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

    // 6. API Keys pool listener - reassigns keys pool dynamically
    adminDb.ref('apiKeys').on('value', snapshot => {
        const dbKeys = snapshot.val();
        if (dbKeys) {
            keys = Object.values(dbKeys);
            keyIndex = 0;
        }
    });

    // 7. Featured Catalog shelf listener
    adminDb.ref('featuredCatalog').on('value', snapshot => {
        const tracks = snapshot.val();
        const shelf = document.getElementById('featuredShelf');
        const grid = document.getElementById('featuredGrid');
        if (!shelf || !grid) return;
        
        if (!tracks) {
            shelf.classList.add('hidden');
            return;
        }
        
        shelf.classList.remove('hidden');
        grid.innerHTML = Object.keys(tracks).map(key => {
            const t = tracks[key];
            const titleSought = t.title.replace(/"/g, '&quot;').replace(/'/g, '\\\'');                
            const trackArtist = t.artist.replace(/"/g, '&quot;').replace(/'/g, '\\\'');
            return `
                <div class="glass p-4 rounded-2xl cursor-pointer hover-card transition group relative flex flex-col h-full" onclick="loadMusic('${t.videoId}', '${titleSought}', '${t.artUrl}', '${trackArtist}')">                                        
                    <div class="relative overflow-hidden rounded-xl mb-4 aspect-square">
                        <img src="${t.artUrl}" class="w-full h-full object-cover group-hover:scale-105 transition shadow-lg">                                        
                        <button onclick="pushTrackToQueueArray('${t.videoId}', '${titleSought}', '${t.artUrl}', '${trackArtist}', event)" class="absolute bottom-2 right-2 w-8 h-8 bg-black/80 hover:bg-red-600 rounded-lg backdrop-blur-md flex items-center justify-center border border-white/10 text-white opacity-0 group-hover:opacity-100 transition transform translate-y-1 group-hover:translate-y-0" title="Add to Queue">
                            <i class="fa-solid fa-plus text-xs"></i>
                        </button>
                    </div>
                    <div class="font-bold line-clamp-2 text-sm text-white flex-1">${t.title}</div>                                        
                    <div class="text-[10px] text-zinc-500 font-bold uppercase mt-2 tracking-widest truncate">${t.artist}</div>                                
                </div>
            `;
        }).join('');
    });
}

// Tab Navigation click handlers
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.admin-tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.getAttribute('data-tab');
            const contents = document.querySelectorAll('.admin-tab-content');
            contents.forEach(c => c.classList.add('admin-tab-hidden'));
            
            document.getElementById(`admin-tab-${tabName}`).classList.remove('admin-tab-hidden');
        });
    });
}

// Setup Cast Monitor loop (queries player DB `/rooms`)
let playerDbRoomsRef = null;
function setupCastMonitorListener() {
    if (!db) return;
    if (playerDbRoomsRef) playerDbRoomsRef.off();
    playerDbRoomsRef = db.ref('rooms');
    
    playerDbRoomsRef.on('value', snapshot => {
        const rooms = snapshot.val();
        const listContainer = document.getElementById('admin-rooms-list');
        if (!listContainer) return;
        
        if (!rooms) {
            listContainer.innerHTML = '<p class="text-xs text-zinc-500 font-bold py-4 text-center">No active cast rooms.</p>';
            return;
        }
        
        let listHtml = '';
        Object.keys(rooms).forEach(roomName => {
            const room = rooms[roomName];
            const clientCount = room.clients ? Object.keys(room.clients).length : 1; 
            listHtml += `
                <div class="admin-list-item">
                    <span>📡 <strong>${roomName.toUpperCase()}</strong> (${clientCount} nodes)</span>
                    <button onclick="terminateCastRoom('${roomName}')">Force Close</button>
                </div>
            `;
        });
        listContainer.innerHTML = listHtml;
    });
}

window.terminateCastRoom = function(roomName) {
    if (!db) return;
    db.ref('rooms/' + roomName).remove()
        .then(() => alert(`Room ${roomName.toUpperCase()} closed successfully.`))
        .catch(err => alert("Error closing room: " + err.message));
};

// Setup Music Catalog Listener
function setupFeaturedCatalogListener() {
    if (!adminDb) return;
    adminDb.ref('featuredCatalog').on('value', snapshot => {
        const tracks = snapshot.val();
        const listContainer = document.getElementById('admin-catalog-list');
        if (!listContainer) return;
        
        if (!tracks) {
            listContainer.innerHTML = '<p class="text-xs text-zinc-500 font-bold py-4 text-center">No tracks featured.</p>';
            return;
        }
        
        let listHtml = '';
        Object.keys(tracks).forEach(key => {
            const t = tracks[key];
            listHtml += `
                <div class="admin-list-item">
                    <span class="truncate pr-4" style="max-width: 75%; text-align: left;">🎵 <strong>${t.title}</strong> - ${t.artist}</span>
                    <button onclick="deleteFeaturedTrack('${key}')">Delete</button>
                </div>
            `;
        });
        listContainer.innerHTML = listHtml;
    });
}

window.deleteFeaturedTrack = function(key) {
    if (!adminDb) return;
    adminDb.ref('featuredCatalog/' + key).remove()
        .catch(err => alert("Error deleting track: " + err.message));
};

// Setup API Key Rotator list
function setupApiKeysListener() {
    if (!adminDb) return;
    adminDb.ref('apiKeys').on('value', snapshot => {
        const keysVal = snapshot.val();
        const listContainer = document.getElementById('admin-keys-list');
        if (!listContainer) return;
        
        if (!keysVal) {
            listContainer.innerHTML = '<p class="text-xs text-zinc-500 font-bold py-4 text-center">Using fallback hardcoded API keys.</p>';
            return;
        }
        
        let listHtml = '';
        Object.keys(keysVal).forEach(index => {
            const keyString = keysVal[index];
            const masked = keyString.substring(0, 8) + '...' + keyString.substring(keyString.length - 6);
            listHtml += `
                <div class="admin-list-item">
                    <span>🔑 Key: <strong>${masked}</strong></span>
                    <button onclick="deleteApiKey('${index}')">Remove</button>
                </div>
            `;
        });
        listContainer.innerHTML = listHtml;
    });
}

window.deleteApiKey = function(index) {
    if (!adminDb) return;
    adminDb.ref('apiKeys/' + index).remove()
        .catch(err => alert("Error removing key: " + err.message));
};

function setupAdminModalHandlers() {
    const adminModal = document.getElementById('admin-modal');
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

    if (loginBtn) loginBtn.addEventListener('click', openModal);
    if (maintAdminBtn) maintAdminBtn.addEventListener('click', openModal);

    const closeModal = () => {
        adminModal.classList.add('admin-modal-hidden');
    };
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

    saveBtn.addEventListener('click', () => {
        if (!adminDb) return;
        const isMaint = document.getElementById('admin-maintenance-toggle').checked;
        const isAnnActive = document.getElementById('admin-announcement-toggle').checked;
        const annText = document.getElementById('admin-announcement-input').value;
        const downloadsCount = parseInt(document.getElementById('admin-downloads-input').value) || 0;
        const btnText = document.getElementById('admin-btntext-input').value;
        const btnLink = document.getElementById('admin-btnlink-input').value;

        Promise.all([
            adminDb.ref('maintenance').set(isMaint),
            adminDb.ref('announcementActive').set(isAnnActive),
            adminDb.ref('announcement').set(annText),
            adminDb.ref('downloads').set(downloadsCount),
            adminDb.ref('downloadText').set(btnText),
            adminDb.ref('downloadLink').set(btnLink)
        ]).then(() => {
            statusNode.innerText = 'Updated successfully!';
            setTimeout(() => { statusNode.innerText = ''; }, 3000);
        }).catch(err => {
            statusNode.style.color = '#ff3b3b';
            statusNode.innerText = 'Error: ' + err.message;
            setTimeout(() => { statusNode.innerText = ''; statusNode.style.color = '#00ff88'; }, 4000);
        });
    });

    // Add Music Track
    const addMusicBtn = document.getElementById('admin-music-add-btn');
    addMusicBtn.addEventListener('click', () => {
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
            videoId: vId,
            title: title,
            artist: artist,
            artUrl: artUrl || 'beatwave%20new%20new.png'
        }).then(() => {
            document.getElementById('admin-music-videoid').value = '';
            document.getElementById('admin-music-title').value = '';
            document.getElementById('admin-music-artist').value = '';
            document.getElementById('admin-music-arturl').value = '';
            alert("Track added successfully!");
        }).catch(err => alert("Error: " + err.message));
    });

    // Add API Key
    const addKeyBtn = document.getElementById('admin-key-add-btn');
    addKeyBtn.addEventListener('click', () => {
        if (!adminDb) return;
        const keyInput = document.getElementById('admin-key-input');
        const newKey = keyInput.value.trim();
        if (!newKey) return;
        
        adminDb.ref('apiKeys').push(newKey).then(() => {
            keyInput.value = '';
            alert("API key added!");
        }).catch(err => alert("Error: " + err.message));
    });

    // Send Alert Broadcast
    const sendAlertBtn = document.getElementById('admin-alert-send-btn');
    const alertStatus = document.getElementById('admin-alert-status');
    sendAlertBtn.addEventListener('click', () => {
        if (!adminDb) return;
        const alertMsg = document.getElementById('admin-alert-message').value.trim();
        if (!alertMsg) return;
        
        adminDb.ref('broadcastMessage').set({
            text: alertMsg,
            ts: Date.now()
        }).then(() => {
            document.getElementById('admin-alert-message').value = '';
            alertStatus.innerText = 'Broadcast sent successfully!';
            setTimeout(() => { alertStatus.innerText = ''; }, 3000);
        }).catch(err => alert("Error: " + err.message));
    });

    // Save Countdown schedule
    const saveCountdownBtn = document.getElementById('admin-countdown-save-btn');
    const countdownStatus = document.getElementById('admin-countdown-status');
    saveCountdownBtn.addEventListener('click', () => {
        if (!adminDb) return;
        const active = document.getElementById('admin-countdown-toggle').checked;
        const minutes = parseInt(document.getElementById('admin-countdown-minutes').value) || 5;
        const reason = document.getElementById('admin-countdown-reason').value.trim() || "Maintenance Scheduled";
        
        const targetTime = Date.now() + (minutes * 60 * 1000);
        
        adminDb.ref('maintenanceCountdown').set({
            active: active,
            targetTime: targetTime,
            msg: reason
        }).then(() => {
            countdownStatus.innerText = 'Maintenance schedule updated!';
            setTimeout(() => { countdownStatus.innerText = ''; }, 3000);
        }).catch(err => alert("Error: " + err.message));
    });
}

// Announcement Banner close
const annBanner = document.getElementById('announcement-banner');
const annClose = document.getElementById('announcement-close');
if (annClose && annBanner) {
    annClose.addEventListener('click', () => {
        annBanner.classList.add('announcement-hidden');
    });
}

if (localStorage.getItem('beatwave-theme') === 'light') {
    document.body.classList.add('light-theme');
}

let player, playState = false, currentRoom = null, isTV = false, videoEnabled = false, theaterViewActive = false;
let playQueueArray = [], activeQueueIndex = -1;
let autoplayEngineActive = true, crossfadeDurationSeconds = 0, crossfadeTriggeredFlag = false;
let crossfadeIntervalPoller = null, timelineProgressPoller = null;

async function fetchWithRetry(url) {                        
    try {                                
        const currentKey = keys[keyIndex];                                
        const targetUrl = url.replace(/key=[^&]+/, `key=${currentKey}`);                                                
        const response = await fetch(targetUrl);                                
        const data = await response.json();
        if (data.error && (data.error.errors[0].reason === 'quotaExceeded' || data.error.code === 400 || data.error.code === 403)) {                                        
            console.warn(`Key #${keyIndex + 1} threshold reached. Rotating fallback layers...`);                                                            
            if (keyIndex < keys.length - 1) {                                                
                keyIndex++;                                                
                return fetchWithRetry(url);                                        
            } else {                                                
                throw new Error("All API manifestations exhausted.");                                        
            }                                
        }                                
        return data;                        
    } catch (error) {                                
        console.error("Fetch instance mismatch:", error);                                
        if (keyIndex < keys.length - 1) {                                        
            keyIndex++;                                        
            return fetchWithRetry(url);                                
        }                                
        return null;                        
    }                
}

function initConnect() {                        
    if (!db) {
        alert("Firebase connection is initializing, please try again in a moment.");
        return;
    }
    const room = prompt("Enter Cast Room Name:");                        
    if (!room) return;                        
    currentRoom = room.toLowerCase();                        
    const choice = confirm("MOUNT ENVIRONMENT AS TV RECEIVER?\n\n[OK] = TV Monitor Mode\n[Cancel] = Mobile Control Client");                                    
    if (choice) {                                
        isTV = true;                 
        document.getElementById('tvMode').classList.add('active');                
        const roomBadge = document.getElementById('tvRoomTag');                
        roomBadge.innerText = `ROOM ACCESS ID: ${currentRoom.toUpperCase()}`;                
        roomBadge.classList.remove('hidden');                                
        const innerIframeTarget = document.getElementById('player-hidden-container');                
        document.getElementById('player-wrapper-tv').appendChild(innerIframeTarget);                
        innerIframeTarget.classList.remove('opacity-0', 'pointer-events-none', 'w-1', 'h-1');                
        innerIframeTarget.className = "w-full h-full object-cover";
        db.ref('rooms/' + currentRoom).on('value', s => {                     
            if (s.val()?.lastCmd) handleCommand(s.val().lastCmd);                 
        });                        
    } else {                                
        isTV = false;                 
        document.getElementById('activeDevice').classList.replace('text-zinc-600', 'text-blue-500');                                
        document.getElementById('deviceName').innerText = "Casting to: " + currentRoom;                        
    }                
}

function sendRemoteCommand(type, data = null) {                        
    if (!currentRoom) { if (type === 'PLAY_PAUSE') toggleLocalPlay(); return; }                        
    if (db) db.ref('rooms/' + currentRoom).update({ lastCmd: { type, data, ts: Date.now() } });                
}

function handleCommand(cmd) {                        
    if (Date.now() - cmd.ts > 10000) return;                        
    if (cmd.type === 'PLAY_PAUSE') toggleLocalPlay();                        
    if (cmd.type === 'LOAD') loadMusic(cmd.data.id, cmd.data.t, cmd.data.img, cmd.data.a, true);                        
    if (cmd.type === 'TOGGLE_VIDEO') document.body.className = cmd.data ? 'h-screen flex flex-col mode-video' : 'h-screen flex flex-col mode-audio';                
}

function toggleVideoMode() {                        
    videoEnabled = !videoEnabled;                        
    document.getElementById('videoToggle').innerText = `Video: ${videoEnabled ? 'On' : 'Off'}`;                        
    sendRemoteCommand('TOGGLE_VIDEO', videoEnabled);                
}

const tag = document.createElement('script');         
tag.src = "https://www.youtube.com/iframe_api";                
document.body.appendChild(tag);                        

function onYouTubeIframeAPIReady() {             
    player = new YT.Player('player', {                 
        height: '100%',                 
        width: '100%',                 
        playerVars: { 'autoplay': 1, 'controls': 0, 'rel': 0, 'showinfo': 0, 'iv_load_policy': 3 },                 
        events: {                     
            'onStateChange': onPlayerStateChange                 
        }             
    });         
}                        

function onPlayerStateChange(e) {
    playState = (e.data == YT.PlayerState.PLAYING);
    document.getElementById('playIcon').className = playState ? 'fa-solid fa-pause' : 'fa-solid fa-play ml-0.5';
    
    if (e.data == YT.PlayerState.PLAYING) {
        crossfadeTriggeredFlag = false;
        startPlaybackMonitoring();
        startTimelineTrackerEngine();
    } else {
        clearInterval(crossfadeIntervalPoller);
        clearInterval(timelineProgressPoller);
    }

    if (e.data == YT.PlayerState.ENDED) {
        advanceQueueNext();
    }
}

function startTimelineTrackerEngine() {
    clearInterval(timelineProgressPoller);
    timelineProgressPoller = setInterval(() => {
        if (!player || typeof player.getCurrentTime !== 'function' || typeof player.getDuration !== 'function') return;
        const currentTime = player.getCurrentTime() || 0;
        const duration = player.getDuration() || 0;
        
        if (duration > 0) {
            const percentage = (currentTime / duration) * 100;
            document.getElementById('progressTimelineFill').style.width = `${percentage}%`;
            document.getElementById('progressTimeCurrent').innerText = formatTimelineClockString(currentTime);
            document.getElementById('progressTimeDuration').innerText = formatTimelineClockString(duration);
        }
    }, 250);
}

function formatTimelineClockString(timeSeconds) {
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.floor(timeSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

window.seekTrackTimeline = function(event) {
    if (!player || typeof player.getDuration !== 'function' || typeof player.seekTo !== 'function') return;
    const rail = document.getElementById('progressTimelineRail');
    const rect = rail.getBoundingClientRect();
    const clickPositionX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickPositionX / rect.width));
    const duration = player.getDuration();
    
    if (duration > 0) {
        const destinationTargetTime = percentage * duration;
        player.seekTo(destinationTargetTime, true);
        document.getElementById('progressTimelineFill').style.width = `${percentage * 100}%`;
        document.getElementById('progressTimeCurrent').innerText = formatTimelineClockString(destinationTargetTime);
    }
}

window.toggleTheaterMode = function(shouldActivate) {
    theaterViewActive = shouldActivate;
    const modal = document.getElementById('theater-viewframe');
    const hiddenContainer = document.getElementById('player-hidden-container');
    const mainVideoMount = document.getElementById('theaterVideoMount');
    
    if (shouldActivate) {
        modal.classList.add('active-frame');
        mainVideoMount.appendChild(hiddenContainer);
        hiddenContainer.classList.remove('opacity-0', 'pointer-events-none', 'w-1', 'h-1');
        hiddenContainer.className = "w-full h-full object-cover relative z-10";
    } else {
        modal.classList.remove('active-frame');
        document.body.appendChild(hiddenContainer);
        hiddenContainer.className = "absolute pointer-events-none opacity-0 left-0 top-0 w-1 h-1 overflow-hidden z-0";
    }
}

function startPlaybackMonitoring() {
    clearInterval(crossfadeIntervalPoller);
    if (crossfadeDurationSeconds <= 0) return;

    crossfadeIntervalPoller = setInterval(() => {
        if (!player || typeof player.getDuration !== 'function') return;
        const duration = player.getDuration();
        const currentTime = player.getCurrentTime();

        if (duration > 0 && (duration - currentTime <= crossfadeDurationSeconds) && !crossfadeTriggeredFlag) {
            crossfadeTriggeredFlag = true;
            executeAudioCrossfadeEngine();
        }
    }, 500);
}

function executeAudioCrossfadeEngine() {
    let volume = 100;
    const stepInterval = (crossfadeDurationSeconds * 1000) / 20;
    const volumeFadeInterval = setInterval(() => {
        volume -= 5;
        if (volume <= 0) {
            clearInterval(volumeFadeInterval);
            advanceQueueNext();
            if (player && typeof player.setVolume === 'function') player.setVolume(100);
        } else {
            if (player && typeof player.setVolume === 'function') player.setVolume(volume);
        }
    }, stepInterval);
}

window.toggleLocalPlay = function() {             
    if(!player || typeof player.pauseVideo !== 'function') return;            
    playState ? player.pauseVideo() : player.playVideo();         
}

window.toggleAutoplayConfig = function(isActive) { autoplayEngineActive = isActive; }

window.updateCrossfadeConfig = function(val) {
    crossfadeDurationSeconds = parseInt(val);
    document.getElementById('crossfadeDurationLabel').innerText = crossfadeDurationSeconds > 0 ? `${crossfadeDurationSeconds}s` : 'Off';
    if (playState) startPlaybackMonitoring();
}

window.loadMusic = function(id, t, img, a, remoteBypass = false) {                        
    const parsedTitle = t.replace(/"/g, '&quot;').replace(/'/g, '&#39;');            
    const parsedArtist = a.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const trackingAsset = { id, t: parsedTitle, img, a: parsedArtist };
    const existingMatchIndex = playQueueArray.findIndex(item => item.id === id);
    
    if (existingMatchIndex === -1) {
        playQueueArray.push(trackingAsset);
        updateQueueInterfaceDisplay();
    }

    if (!remoteBypass && currentRoom && !isTV) {
        sendRemoteCommand('LOAD', { id, t: parsedTitle, img, a: parsedArtist });
        document.getElementById('nowArt').src = img;                 
        document.getElementById('nowTitle').innerText = parsedTitle;
        document.getElementById('nowArtistLabel').innerText = parsedArtist;
        return;
    }

    activeQueueIndex = playQueueArray.findIndex(item => item.id === id);
    updateQueueInterfaceDisplay();

    document.getElementById('theaterTrackTitle').innerText = parsedTitle;
    document.getElementById('theaterTrackArtist').innerText = parsedArtist;

    if (isTV) {                                
        player.loadVideoById(id);                                
        document.getElementById('tvArt').src = img;                                
        document.getElementById('tvTitle').innerText = parsedTitle;                                
        document.getElementById('tvArtist').innerText = parsedArtist;                        
    } else {                                
        player.loadVideoById(id);                                
        document.getElementById('nowArt').src = img;                 
        document.getElementById('nowTitle').innerText = parsedTitle;                        
        document.getElementById('nowArtistLabel').innerText = parsedArtist;                        
    }                
}

window.pushTrackToQueueArray = function(id, t, img, a, eventNode) {
    if (eventNode) eventNode.stopPropagation();
    const parsedTitle = t.replace(/"/g, '&quot;').replace(/'/g, '&#39;');            
    const parsedArtist = a.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    
    if (playQueueArray.some(item => item.id === id)) return;
    playQueueArray.push({ id, t: parsedTitle, img, a: parsedArtist });
    updateQueueInterfaceDisplay();
}

window.advanceQueueNext = function() {
    if (activeQueueIndex + 1 < playQueueArray.length) {
        activeQueueIndex++;
        const nextTrack = playQueueArray[activeQueueIndex];
        loadMusic(nextTrack.id, nextTrack.t, nextTrack.img, nextTrack.a, true);
    } else if (autoplayEngineActive && playQueueArray.length > 0) {
        triggerAutoplayDiscoveryContext();
    }
}

async function triggerAutoplayDiscoveryContext() {
    if (playQueueArray.length === 0) return;
    const sampleSeed = playQueueArray[activeQueueIndex >= 0 ? activeQueueIndex : playQueueArray.length - 1];
    const queryUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(sampleSeed.a + " music alternative")}&type=video&key=${keys[0]}`;
    const responseData = await fetchWithRetry(queryUrl);
    if (responseData && responseData.items && responseData.items.length > 0) {
        const structuralItem = responseData.items[Math.floor(Math.random() * responseData.items.length)];
        pushTrackToQueueArray(structuralItem.id.videoId, structuralItem.snippet.title, structuralItem.snippet.thumbnails.high.url, structuralItem.snippet.channelTitle);
        advanceQueueNext();
    }
}

window.removeQueueTrackIndex = function(index, eventNode) {
    if (eventNode) eventNode.stopPropagation();
    playQueueArray.splice(index, 1);
    if (activeQueueIndex === index) activeQueueIndex = Math.max(0, activeQueueIndex - 1);
    else if (activeQueueIndex > index) activeQueueIndex--;
    updateQueueInterfaceDisplay();
}

window.clearQueue = function() {
    playQueueArray = [];
    activeQueueIndex = -1;
    updateQueueInterfaceDisplay();
}

function updateQueueInterfaceDisplay() {
    const container = document.getElementById('queueContainerNode');
    if (!container) return;
    if (playQueueArray.length === 0) {
        container.innerHTML = `<p class="text-xs text-zinc-600 font-medium py-4 text-center">Queue empty. Add tracks below.</p>`;
        return;
    }
    container.innerHTML = playQueueArray.map((item, index) => {
        const isActive = index === activeQueueIndex;
        return `
            <div onclick="loadMusic('${item.id}', '${item.t.replace(/'/g, "\\'")}', '${item.img}', '${item.a.replace(/'/g, "\\'")}', true)" class="flex items-center gap-3 p-2 rounded-xl border ${isActive ? 'bg-red-500/10 border-red-500/20' : 'bg-zinc-950/40 border-white/5'} cursor-pointer hover:bg-zinc-900 group transition">
                <img src="${item.img}" class="w-10 h-10 rounded-lg object-cover bg-zinc-900 flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-bold truncate ${isActive ? 'text-red-400' : 'text-zinc-200'}">${item.t}</div>
                    <div class="text-[9px] text-zinc-500 truncate mt-0.5">${item.a}</div>
                </div>
                <button onclick="removeQueueTrackIndex(${index}, event)" class="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-500 transition px-1 text-xs"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    }).join('');
}

window.toggleFullscreen = function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
    } else {
        document.exitFullscreen();
    }
}

window.triggerPageSearch = async function() {
    const query = document.getElementById('searchPageInput').value.trim();
    if (!query) return;
    switchPage('search');
    
    const grid = document.getElementById('searchGrid');                        
    grid.innerHTML = '<div class="col-span-full py-20 text-center"><i class="fa-solid fa-circle-notch fa-spin text-4xl text-red-600"></i></div>';                                                
    const data = await fetchWithRetry(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=18&q=${encodeURIComponent(query)}&type=video&key=${keys[keyIndex]}`);                        
    if (data && data.items) render(data.items, 'searchGrid');                        
    else grid.innerHTML = '<p class="col-span-full text-center text-zinc-500">Service threshold timed out. Verify rotation manifest.</p>';                
}

window.triggerQuickFilter = function(query) {
    const input = document.getElementById('searchPageInput');
    if (input) {
        input.value = query;
        triggerPageSearch();
    }
}

function render(items, gridId) {                        
    document.getElementById(gridId).innerHTML = items.map(i => {                
        const titleSought = i.snippet.title.replace(/"/g, '&quot;').replace(/'/g, '\\\'');                
        const trackArtist = i.snippet.channelTitle.replace(/"/g, '&quot;').replace(/'/g, '\\\'');                                
        return `                                
            <div class="glass p-4 rounded-2xl cursor-pointer hover-card transition group relative flex flex-col h-full" onclick="loadMusic('${i.id.videoId}', '${titleSought}', '${i.snippet.thumbnails.high.url}', '${trackArtist}')">                                        
                <div class="relative overflow-hidden rounded-xl mb-4 aspect-square">
                    <img src="${i.snippet.thumbnails.high.url}" class="w-full h-full object-cover group-hover:scale-105 transition shadow-lg">                                        
                    <button onclick="pushTrackToQueueArray('${i.id.videoId}', '${titleSought}', '${i.snippet.thumbnails.high.url}', '${trackArtist}', event)" class="absolute bottom-2 right-2 w-8 h-8 bg-black/80 hover:bg-red-600 rounded-lg backdrop-blur-md flex items-center justify-center border border-white/10 text-white opacity-0 group-hover:opacity-100 transition transform translate-y-1 group-hover:translate-y-0" title="Add to Queue">
                        <i class="fa-solid fa-plus text-xs"></i>
                    </button>
                </div>
                <div class="font-bold line-clamp-2 text-sm text-white flex-1">${i.snippet.title}</div>                                        
                <div class="text-[10px] text-zinc-500 font-bold uppercase mt-2 tracking-widest truncate">${i.snippet.channelTitle}</div>                                
            </div>                        
        `}).join('');                
}

window.switchPage = function(pageId) {
    const pages = ['discover', 'search', 'cast', 'queue'];
    pages.forEach(p => {
        const viewEl = document.getElementById(p + 'View');
        if (viewEl) {
            if (p === pageId) {
                viewEl.classList.remove('hidden');
                viewEl.style.animation = 'applePageSlideIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            } else {
                viewEl.classList.add('hidden');
            }
        }
        const btn = document.getElementById(`nav-${p}-btn`);
        if (btn) {
            if (p === pageId) {
                btn.className = "w-full text-left flex items-center gap-4 py-2 px-3 text-white transition apple-nav-btn active";
            } else {
                btn.className = "w-full text-left flex items-center gap-4 py-2 px-3 text-zinc-400 hover:text-white transition apple-nav-btn";
            }
        }
    });
    location.hash = pageId;
}

function setDynamicAmbientBlur(coverUrl, fallbackSeed) {
    if (!coverUrl) {
        setDynamicThemeFallback(fallbackSeed);
        return;
    }
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = coverUrl + (coverUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    img.onload = function() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 10;
            canvas.height = 10;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 10, 10);
            
            const imgData = ctx.getImageData(0, 0, 10, 10).data;
            let r = 0, g = 0, b = 0, count = 0;
            
            for (let i = 0; i < imgData.length; i += 4) {
                if (imgData[i+3] < 50) continue;
                r += imgData[i];
                g += imgData[i+1];
                b += imgData[i+2];
                count++;
            }
            
            if (count === 0) throw new Error("No solid pixels detected");
            
            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);
            
            const color = `rgb(${r}, ${g}, ${b})`;
            document.documentElement.style.setProperty('--accent', color);
            document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
        } catch (e) {
            console.warn("CORS/Canvas extraction failed, fallback to title hash.", e);
            setDynamicThemeFallback(fallbackSeed);
        }
    };
    img.onerror = function() {
        setDynamicThemeFallback(fallbackSeed);
    };
}

function setDynamicThemeFallback(seedText) {
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
        hash = seedText.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    document.documentElement.style.setProperty('--accent', `hsl(${hue}, 75%, 45%)`);
    document.documentElement.style.setProperty('--accent-glow', `hsla(${hue}, 75%, 45%, 0.35)`);
}

window.applyAudioPreset = function(preset) {
    const btns = document.querySelectorAll('.eq-preset-btn');
    btns.forEach(b => {
        b.className = "eq-preset-btn px-4 py-2.5 rounded-xl border border-white/5 bg-zinc-900 text-xs text-zinc-300 font-bold transition hover:bg-white/10";
    });
    
    const activeBtn = document.querySelector(`.eq-preset-btn[data-preset="${preset}"]`);
    if (activeBtn) {
        activeBtn.className = "eq-preset-btn active px-4 py-2.5 rounded-xl border border-white/5 bg-white/5 text-xs text-zinc-300 font-bold transition hover:bg-white/10";
    }
};

window.startCastingRoomNode = function(asTV = false) {
    if (!db) {
        alert("Firebase connection is initializing, please try again in a moment.");
        return;
    }
    const roomInput = document.getElementById('castRoomInput');
    if (!roomInput) return;
    const roomVal = roomInput.value.trim().toLowerCase();
    if (!roomVal) {
        alert("Please enter a valid Cast Room ID.");
        return;
    }
    
    currentRoom = roomVal;
    
    if (asTV) {
        isTV = true;                 
        document.getElementById('tvMode').classList.add('active');                
        const roomBadge = document.getElementById('tvRoomTag');                
        roomBadge.innerText = `ROOM ACCESS ID: ${currentRoom.toUpperCase()}`;                
        roomBadge.classList.remove('hidden');                                
        const innerIframeTarget = document.getElementById('player-hidden-container');                
        document.getElementById('player-wrapper-tv').appendChild(innerIframeTarget);                
        innerIframeTarget.classList.remove('opacity-0', 'pointer-events-none', 'w-1', 'h-1');                
        innerIframeTarget.className = "w-full h-full object-cover";
        
        db.ref('rooms/' + currentRoom).on('value', s => {                     
            if (s.val()?.lastCmd) handleCommand(s.val().lastCmd);                 
        });
        
        document.getElementById('castStatusIndicator').className = "w-3 h-3 rounded-full bg-emerald-500 animate-pulse";
        document.getElementById('castStatusText').className = "text-xs font-bold text-emerald-400";
        document.getElementById('castStatusText').innerText = `Active Receiver (Room: ${currentRoom.toUpperCase()})`;
        document.getElementById('castDisconnectBtn').classList.remove('hidden');
    } else {
        isTV = false;                 
        db.ref('rooms/' + currentRoom).update({
            active: true,
            lastUpdated: Date.now()
        }).then(() => {
            document.getElementById('castStatusIndicator').className = "w-3 h-3 rounded-full bg-emerald-500 animate-pulse";
            document.getElementById('castStatusText').className = "text-xs font-bold text-emerald-400";
            document.getElementById('castStatusText').innerText = `Casting Controller Active (Room: ${currentRoom.toUpperCase()})`;
            document.getElementById('castDisconnectBtn').classList.remove('hidden');
            
            document.getElementById('activeDevice').className = "flex items-center gap-3 px-4 py-2 rounded-full bg-blue-500/10 text-blue-400 font-bold text-[9px] uppercase tracking-widest transition";
            document.getElementById('deviceName').innerText = "Casting to: " + currentRoom.toUpperCase();
        }).catch(err => {
            alert("Casting failed: " + err.message);
        });
    }
};

window.disconnectCastingNode = function() {
    if (currentRoom) {
        if (isTV) {
            document.getElementById('tvMode').classList.remove('active');
            const roomBadge = document.getElementById('tvRoomTag');
            roomBadge.classList.add('hidden');
            
            const innerIframeTarget = document.getElementById('player-hidden-container');
            document.body.appendChild(innerIframeTarget);
            innerIframeTarget.className = "absolute pointer-events-none opacity-0 left-0 top-0 w-1 h-1 overflow-hidden z-0";
            
            db.ref('rooms/' + currentRoom).off('value');
        }
        
        document.getElementById('castStatusIndicator').className = "w-3 h-3 rounded-full bg-zinc-700 animate-pulse";
        document.getElementById('castStatusText').className = "text-xs font-bold text-zinc-500";
        document.getElementById('castStatusText').innerText = "Not casting";
        document.getElementById('castDisconnectBtn').classList.add('hidden');
        
        document.getElementById('activeDevice').className = "flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-900/50 text-zinc-600 font-bold text-[9px] uppercase tracking-widest transition";
        document.getElementById('deviceName').innerText = "Local Device";
        
        currentRoom = null;
        isTV = false;
    }
};

window.onload = async () => {                         
    const progressNode = document.getElementById('loadingProgressFillNode');
    if(progressNode) progressNode.style.width = '50%';

    // Initialize HLS Background video
    initBackgroundVideo();

    // Auto-fetch download counts from GitHub Release API
    fetchGithubDownloads();

    // Multipage routing initial loading
    const initialHash = location.hash.replace('#', '') || 'discover';
    switchPage(initialHash);
    window.addEventListener('hashchange', () => {
        const hash = location.hash.replace('#', '') || 'discover';
        switchPage(hash);
    });

    // Liquid theme toggle controller
    const liquidBtn = document.getElementById('liquidToggleBtn');
    const isLightInit = document.body.classList.contains('light-theme');
    if (liquidBtn) {
        if (isLightInit) liquidBtn.classList.add('active');
        liquidBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLightNow = document.body.classList.contains('light-theme');
            if (isLightNow) {
                liquidBtn.classList.add('active');
            } else {
                liquidBtn.classList.remove('active');
            }
            localStorage.setItem('beatwave-theme', isLightNow ? 'light' : 'dark');
        });
    }
    
    const searchInput = document.getElementById('searchPageInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') triggerPageSearch(); });
    }

    if(progressNode) progressNode.style.width = '100%';
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if(loader) loader.classList.add('fade-out');
    }, 100);

    // Fetch trending music asynchronously in the background
    fetchWithRetry(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=trending+music&type=video&key=${keys[0]}`)
        .then(data => {
            if (data && data.items) render(data.items, 'trendingGrid');
        });
};
