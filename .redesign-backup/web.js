// ========== BeatWave Web Player - Modern JavaScript ==========

(function() {
    'use strict';
    
    // ========== CONFIG ==========
    const CONFIG = {
        apiKeys: [
            'AIzaSyDPXs_o perfused-key-here'
        ],
        maxRetries: 3,
        cacheTTL: 5 * 60 * 1000 // 5 minutes
    };
    
    // ========== STATE ==========
    const state = {
        currentTrack: null,
        playlist: [],
        isPlaying: false,
        volume: 1,
        isMuted: false,
        previousVolume: 1,
        audioContext: null,
        sourceNode: null,
        gainNode: null
    };
    
    // ========== DOM ELEMENTS ==========
    const dom = {};
    
    function cacheDOM() {
        dom.body = document.body;
        dom.header = document.querySelector('.player-header');
        dom.logo = document.querySelector('.header-logo');
        dom.themeBtn = document.querySelector('.icon-btn.theme-btn');
        dom.themeIcon = dom.themeBtn?.querySelector('i');
        dom.searchInput = document.querySelector('.search-input');
        dom.searchIcon = document.querySelector('.search-icon');
        dom.nowPlayingSection = document.querySelector('.now-playing-section');
        
        // Now playing elements
        dom.albumArt = document.querySelector('.album-art');
        dom.trackTitle = document.querySelector('.track-title');
        dom.trackArtist = document.querySelector('.track-artist');
        dom.progressBar = document.querySelector('.progress-bar');
        dom.progressFill = document.querySelector('.progress-bar-fill');
        dom.currentTimeEl = document.querySelector('.progress-time.current');
        dom.totalTimeEl = document.querySelector('.progress-time.total');
        
        // Controls
        dom.playBtn = document.querySelector('.play-btn');
        dom.prevBtn = document.querySelector('[data-control="prev"]');
        dom.nextBtn = document.querySelector('[data-control="next"]');
        dom.shuffleBtn = document.querySelector('[data-control="shuffle"]');
        dom.repeatBtn = document.querySelector('[data-control="repeat"]');
        
        // Playlist
        dom.playlistSection = document.querySelector('.playlist-section');
        dom.playlistContainer = document.querySelector('.playlist-items');
        
        // Toast
        dom.toast = document.querySelector('.toast');
    }
    
    // ========== THEME MANAGEMENT ==========
    function initTheme() {
        const savedTheme = localStorage.getItem('beatwave-theme');
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        
        if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
            dom.body?.classList.add('light');
            updateThemeIcon(true);
        }
    }
    
    function toggleTheme() {
        const isLight = dom.body?.classList.toggle('light');
        localStorage.setItem('beatwave-theme', isLight ? 'light' : 'dark');
        updateThemeIcon(isLight);
        updateSearchInputBackground(isLight);
    }
    
    function updateThemeIcon(isLight) {
        if (dom.themeIcon) {
            dom.themeIcon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }
    
    function updateSearchInputBackground(isLight) {
        if (dom.searchInput) {
            if (isLight) {
                dom.searchInput.style.backgroundColor = 'rgba(0,0,0,0.03)';
                dom.searchInput.style.borderColor = 'rgba(0,0,0,0.08)';
            } else {
                dom.searchInput.style.backgroundColor = '';
                dom.searchInput.style.borderColor = '';
            }
        }
    }
    
    // ========== AUDIO ENGINE ==========
    function initAudio() {
        if (!state.audioContext) {
            try {
                state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                state.gainNode = state.audioContext.createGain();
                state.gainNode.connect(state.audioContext.destination);
                state.gainNode.gain.value = state.volume;
            } catch (e) {
                console.warn('AudioContext initialization failed:', e);
            }
        }
        
        if (state.audioContext?.state === 'suspended') {
            state.audioContext.resume();
        }
    }
    
    function createAudioElement(src) {
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.src = src;
        audio.volume = state.volume;
        
        // Audio event handlers
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', nextTrack);
        audio.addEventListener('play', () => {
            state.isPlaying = true;
            updatePlayButton();
        });
        audio.addEventListener('pause', () => {
            state.isPlaying = false;
            updatePlayButton();
        });
        audio.addEventListener('error', handleAudioError);
        
        return audio;
    }
    
    function handleAudioError(e) {
        console.error('Audio playback error:', e);
        showToast('Playback error. Try restarting the track.');
    }
    
    // ========== PLAYBACK CONTROLS ==========
    function play() {
        initAudio();
        
        if (!state.currentTrack) {
            playFirstTrack();
            return;
        }
        
        if (state.audioElement) {
            state.audioElement.play().catch(handlePlayError);
        }
    }
    
    function pause() {
        if (state.audioElement) {
            state.audioElement.pause();
        }
    }
    
    function togglePlay() {
        if (state.isPlaying) {
            pause();
        } else {
            play();
        }
    }
    
    function handlePlayError(e) {
        console.warn('Playback failed:', e);
        showToast('Tap to try again');
    }
    
    function playFirstTrack() {
        if (state.playlist.length > 0) {
            loadTrack(state.playlist[0]);
            play();
        }
    }
    
    function loadTrack(track) {
        if (state.audioElement) {
            state.audioElement.pause();
            state.audioElement.src = '';
        }
        
        state.currentTrack = track;
        
        // Load new audio element
        state.audioElement = createAudioElement(track.url);
        
        // Update UI
        updateNowPlaying(track);
        updatePlaylistHighlight();
        resetProgress();
    }
    
    function updateNowPlaying(track) {
        if (dom.albumArt) {
            dom.albumArt.style.backgroundImage = `url(${track.thumbnail || ''})`;
            dom.albumArt.style.backgroundSize = 'cover';
            dom.albumArt.style.backgroundPosition = 'center';
            dom.albumArt.src = track.thumbnail || '';
        }
        
        if (dom.trackTitle) {
            dom.trackTitle.textContent = track.title;
        }
        
        if (dom.trackArtist) {
            dom.trackArtist.textContent = track.artist;
        }
    }
    
    function updatePlayButton() {
        if (dom.playBtn) {
            dom.playBtn.classList.toggle('playing', state.isPlaying);
            dom.playBtn.innerHTML = state.isPlaying 
                ? '<i class="fa-solid fa-pause"></i>' 
                : '<i class="fa-solid fa-circle-play"></i>';
        }
    }
    
    function resetProgress() {
        if (dom.progressFill) dom.progressFill.style.width = '0%';
        if (dom.currentTimeEl) dom.currentTimeEl.textContent = '0:00';
        if (dom.totalTimeEl) dom.totalTimeEl.textContent = '0:00';
    }
    
    function updateProgress() {
        if (!state.audioElement || !dom.progressFill) return;
        
        const progress = (state.audioElement.currentTime / state.audioElement.duration) * 100;
        dom.progressFill.style.width = `${progress}%`;
        
        if (dom.currentTimeEl) {
            dom.currentTimeEl.textContent = formatTime(state.audioElement.currentTime);
        }
    }
    
    function updateDuration() {
        if (!state.audioElement || !dom.totalTimeEl) return;
        dom.totalTimeEl.textContent = formatTime(state.audioElement.duration);
    }
    
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    function seek(e) {
        if (!state.audioElement || !state.audioElement.duration) return;
        
        const rect = dom.progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        state.audioElement.currentTime = pos * state.audioElement.duration;
    }
    
    function nextTrack() {
        if (state.playlist.length === 0) return;
        
        const currentIndex = state.playlist.findIndex(
            t => t.url === state.currentTrack?.url
        );
        
        const nextIndex = (currentIndex + 1) % state.playlist.length;
        loadTrack(state.playlist[nextIndex]);
        play();
    }
    
    function prevTrack() {
        if (state.playlist.length === 0) return;
        
        // If more than 3 seconds in, restart current track
        if (state.audioElement && state.audioElement.currentTime > 3) {
            state.audioElement.currentTime = 0;
            return;
        }
        
        const currentIndex = state.playlist.findIndex(
            t => t.url === state.currentTrack?.url
        );
        
        const prevIndex = (currentIndex - 1 + state.playlist.length) % state.playlist.length;
        loadTrack(state.playlist[prevIndex]);
        play();
    }
    
    // ========== PLAYLIST MANAGEMENT ==========
    function loadPlaylist() {
        // Sample playlist - replace with your actual data source
        state.playlist = [
            {
                id: '1',
                title: 'Sample Track 1',
                artist: 'Artist Name',
                url: 'https://example.com/audio/track1.mp3',
                thumbnail: ''
            },
            {
                id: '2',
                title: 'Sample Track 2',
                artist: 'Another Artist',
                url: 'https://example.com/audio/track2.mp3',
                thumbnail: ''
            }
        ];
        
        renderPlaylist();
    }
    
    function renderPlaylist() {
        if (!dom.playlistContainer) return;
        
        if (state.playlist.length === 0) {
            dom.playlistContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fa-solid fa-music"></i>
                    </div>
                    <div class="empty-state-title">No tracks yet</div>
                    <div class="empty-state-text">Your playlist is empty</div>
                </div>
            `;
            return;
        }
        
        dom.playlistContainer.innerHTML = state.playlist.map((track, index) => `
            <div class="playlist-item ${track.id === state.currentTrack?.id ? 'active' : ''}"
                 data-index="${index}" data-url="${track.url}">
                <div class="playlist-item-art" style="background: linear-gradient(135deg, 
                    ${index % 2 === 0 ? 'var(--accent-cyan), var(--accent-purple)' : 'var(--accent-purple), var(--accent-pink)'});">
                    <i class="fa-solid fa-music"></i>
                </div>
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${escapeHtml(track.title)}</div>
                    <div class="playlist-item-artist">${escapeHtml(track.artist)}</div>
                </div>
                <div class="playlist-item-duration">--:--</div>
            </div>
        `).join('');
        
        // Add click handlers
        dom.playlistContainer.querySelectorAll('.playlist-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                loadTrack(state.playlist[index]);
                play();
            });
        });
    }
    
    function updatePlaylistHighlight() {
        if (!dom.playlistContainer) return;
        
        dom.playlistContainer.querySelectorAll('.playlist-item').forEach(item => {
            const url = item.dataset.url;
            item.classList.toggle('active', url === state.currentTrack?.url);
        });
    }
    
    // ========== SEARCH ==========
    function initSearch() {
        if (!dom.searchInput || !dom.searchIcon) return;
        
        dom.searchInput.addEventListener('input', debounce(handleSearch, 300));
        dom.searchInput.addEventListener('focus', () => {
            dom.searchIcon.style.color = 'var(--accent-cyan)';
        });
        dom.searchInput.addEventListener('blur', () => {
            dom.searchIcon.style.color = '';
        });
        
        // Clear button functionality
        dom.searchInput.parentElement?.addEventListener('click', (e) => {
            if (e.target.classList.contains('clear-btn')) {
                dom.searchInput.value = '';
                dom.searchInput.focus();
                handleSearch();
            }
        });
    }
    
    function handleSearch() {
        const query = dom.searchInput?.value.toLowerCase().trim() || '';
        
        if (!query) {
            renderPlaylist();
            return;
        }
        
        const filtered = state.playlist.filter(track =>
            track.title.toLowerCase().includes(query) ||
            track.artist.toLowerCase().includes(query)
        );
        
        renderFilteredPlaylist(filtered);
    }
    
    function renderFilteredPlaylist(filtered) {
        if (!dom.playlistContainer) return;
        
        if (filtered.length === 0) {
            dom.playlistContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fa-solid fa-search"></i>
                    </div>
                    <div class="empty-state-title">No results found</div>
                    <div class="empty-state-text">Try a different search term</div>
                </div>
            `;
            return;
        }
        
        dom.playlistContainer.innerHTML = filtered.map((track, index) => {
            const originalIndex = state.playlist.findIndex(t => t.id === track.id);
            return `
            <div class="playlist-item ${track.id === state.currentTrack?.id ? 'active' : ''}"
                 data-index="${originalIndex}" data-url="${track.url}">
                <div class="playlist-item-art" style="background: linear-gradient(135deg, 
                    ${originalIndex % 2 === 0 ? 'var(--accent-cyan), var(--accent-purple)' : 'var(--accent-purple), var(--accent-pink)'});">
                    <i class="fa-solid fa-music"></i>
                </div>
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${escapeHtml(track.title)}</div>
                    <div class="playlist-item-artist">${escapeHtml(track.artist)}</div>
                </div>
                <div class="playlist-item-duration">--:--</div>
            </div>
            `;
        }).join('');
        
        dom.playlistContainer.querySelectorAll('.playlist-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                loadTrack(state.playlist[index]);
                play();
            });
        });
    }
    
    // ========== UTILITY FUNCTIONS ==========
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function showToast(message, duration = 3000) {
        if (!dom.toast) return;
        
        dom.toast.textContent = message;
        dom.toast.classList.add('visible');
        
        setTimeout(() => {
            dom.toast.classList.remove('visible');
        }, duration);
    }
    
    // ========== EVENT LISTENERS ==========
    function initEventListeners() {
        // Theme toggle
        dom.themeBtn?.addEventListener('click', toggleTheme);
        
        // Play/pause
        dom.playBtn?.addEventListener('click', togglePlay);
        
        // Next/previous
        dom.nextBtn?.addEventListener('click', nextTrack);
        dom.prevBtn?.addEventListener('click', prevTrack);
        
        // Progress bar
        dom.progressBar?.addEventListener('click', seek);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        // Visibility change - pause when tab hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && state.isPlaying) {
                // Optionally pause, or keep playing
                // pause();
            }
        });
    }
    
    function handleKeyboardShortcuts(e) {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowRight':
                e.preventDefault();
                nextTrack();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                prevTrack();
                break;
            case 'ArrowUp':
                e.preventDefault();
                adjustVolume(0.1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                adjustVolume(-0.1);
                break;
            case 'KeyM':
                toggleMute();
                break;
        }
    }
    
    function adjustVolume(delta) {
        state.volume = Math.max(0, Math.min(1, state.volume + delta));
        state.isMuted = false;
        state.gainNode?.gain.setValueAtTime(state.volume, state.audioContext?.currentTime || 0);
        updateVolumeUI();
    }
    
    function toggleMute() {
        if (state.isMuted) {
            state.volume = state.previousVolume || 1;
            state.isMuted = false;
        } else {
            state.previousVolume = state.volume;
            state.volume = 0;
            state.isMuted = true;
        }
        state.gainNode?.gain.setValueAtTime(state.volume, state.audioContext?.currentTime || 0);
        updateVolumeUI();
    }
    
    function updateVolumeUI() {
        // Update volume visualization if needed
        console.log(`Volume: ${Math.round(state.volume * 100)}%`);
    }
    
    // ========== INITIALIZATION ==========
    function init() {
        cacheDOM();
        initTheme();
        initPlaylist();
        initSearch();
        initEventListeners();
        
        // Service Worker registration for offline support
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW registered:', reg.scope))
                .catch(err => console.log('SW registration failed:', err));
        }
        
        console.log('%c🎵 BeatWave Web Player', 'font-size: 14px; font-weight: bold; color: #00f2fe;');
        console.log('%cReady to play!', 'color: #8a2be2;');
    }
    
    function initPlaylist() {
        // Load playlist from localStorage or API
        const savedPlaylist = localStorage.getItem('beatwave-playlist');
        if (savedPlaylist) {
            try {
                state.playlist = JSON.parse(savedPlaylist);
            } catch (e) {
                state.playlist = [];
            }
        }
        
        if (state.playlist.length === 0) {
            loadPlaylist();
        } else {
            renderPlaylist();
        }
    }
    
    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
