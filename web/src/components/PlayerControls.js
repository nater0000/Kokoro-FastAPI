export class PlayerControls {
    constructor(audioService, playerState) {
        this.audioService = audioService;
        this.playerState = playerState;
        this.elements = {
            playPauseBtn: document.getElementById('play-pause-btn'),
            seekSlider: document.getElementById('seek-slider'),
            volumeSlider: document.getElementById('volume-slider'),
            speedSlider: document.getElementById('speed-slider'),
            speedValue: document.getElementById('speed-value'),
            timeDisplay: document.getElementById('time-display'),
            cancelBtn: document.getElementById('cancel-btn')
        };
        
        this.setupEventListeners();
        this.setupAudioEvents();
        this.setupStateSubscription();
        this.timeUpdateInterval = null;
    }

    formatTime(secs) {
        const minutes = Math.floor(secs / 60);
        const seconds = Math.floor(secs % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    startTimeUpdate() {
        this.stopTimeUpdate(); // Clear any existing interval
        this.timeUpdateInterval = setInterval(() => {
            this.updateTimeDisplay();
        }, 100); // Update every 100ms for smooth tracking
    }

    stopTimeUpdate() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }

    updateTimeDisplay() {
        const currentTime = this.audioService.getCurrentTime();
        const duration = this.audioService.getDuration();
        
        // Update time display
        this.elements.timeDisplay.textContent = 
            `${this.formatTime(currentTime)} / ${this.formatTime(duration || 0)}`;
        
        // Update seek slider
        if (duration > 0 && !this.elements.seekSlider.dragging) {
            this.elements.seekSlider.value = (currentTime / duration) * 100;
        }
        
        // Update state
        this.playerState.setTime(currentTime, duration);
    }

    setupEventListeners() {
        // Play/Pause button
        this.elements.playPauseBtn.addEventListener('click', () => {
            const isDisabled = this.elements.playPauseBtn.disabled;
            const isPlaying = this.audioService.isPlaying();
            
            // Show debug info in status
            if (window.app && window.app.showStatus) {
                window.app.showStatus(`Play clicked - Disabled: ${isDisabled}, Playing: ${isPlaying}`, 'info', 2000);
            }
            
            console.log('PlayerControls: Play button clicked, disabled:', isDisabled, 'playing:', isPlaying);
            
            if (isPlaying) {
                console.log('PlayerControls: Pausing audio');
                this.audioService.pause();
            } else {
                console.log('PlayerControls: Playing audio');
                // For iOS Safari, try direct audio element access as fallback
                if (this.audioService.fallbackMode && this.audioService.audio) {
                    this.directPlay();
                } else {
                    this.audioService.play();
                }
            }
        });

        // Seek slider
        this.elements.seekSlider.addEventListener('mousedown', () => {
            this.elements.seekSlider.dragging = true;
        });

        this.elements.seekSlider.addEventListener('mouseup', () => {
            this.elements.seekSlider.dragging = false;
        });

        this.elements.seekSlider.addEventListener('input', (e) => {
            const duration = this.audioService.getDuration();
            const seekTime = (duration * e.target.value) / 100;
            this.audioService.seek(seekTime);
            this.updateTimeDisplay();
        });

        // Volume slider
        this.elements.volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.audioService.setVolume(volume);
            this.playerState.setVolume(volume);
        });

        // Speed slider
        this.elements.speedSlider.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.elements.speedValue.textContent = speed.toFixed(1);
            this.playerState.setSpeed(speed);
        });

        // Cancel button
        this.elements.cancelBtn.addEventListener('click', () => {
            this.audioService.cancel();
            this.playerState.reset();
            this.updateControls({ isGenerating: false });
            this.stopTimeUpdate();
        });
    }
    
    // Direct play method for iOS Safari fallback
    directPlay() {
        if (!this.audioService.audio) {
            console.error('PlayerControls: No audio element available');
            return;
        }
        
        const audio = this.audioService.audio;
        console.log('PlayerControls: Direct play attempt, readyState:', audio.readyState);
        
        if (window.app && window.app.showStatus) {
            window.app.showStatus(`Direct play - ReadyState: ${audio.readyState}`, 'info', 2000);
        }
        
        const playPromise = audio.play();
        if (playPromise) {
            playPromise
                .then(() => {
                    console.log('PlayerControls: Direct play successful');
                    this.elements.playPauseBtn.textContent = 'Pause';
                    this.playerState.setPlaying(true);
                    this.startTimeUpdate();
                    if (window.app && window.app.showStatus) {
                        window.app.showStatus('Playback started', 'success', 2000);
                    }
                })
                .catch(error => {
                    console.error('PlayerControls: Direct play failed:', error);
                    if (window.app && window.app.showStatus) {
                        window.app.showStatus('Play failed: ' + error.name, 'error', 3000);
                    }
                });
        }
    }

    setupAudioEvents() {
        this.audioService.addEventListener('play', () => {
            console.log('PlayerControls: Play event received');
            this.elements.playPauseBtn.textContent = 'Pause';
            this.playerState.setPlaying(true);
            this.startTimeUpdate();
        });

        this.audioService.addEventListener('pause', () => {
            console.log('PlayerControls: Pause event received');
            this.elements.playPauseBtn.textContent = 'Play';
            this.playerState.setPlaying(false);
            this.stopTimeUpdate();
        });

        this.audioService.addEventListener('ended', () => {
            console.log('PlayerControls: Ended event received');
            this.elements.playPauseBtn.textContent = 'Play';
            this.playerState.setPlaying(false);
            this.stopTimeUpdate();
        });

        // Handle when audio data is loaded (especially for iOS Safari fallback)
        this.audioService.addEventListener('loadeddata', () => {
            console.log('PlayerControls: Audio data loaded');
            this.updateControls(this.playerState.getState());
        });

        // Handle when audio metadata is loaded (duration available)
        this.audioService.addEventListener('loadedmetadata', () => {
            console.log('PlayerControls: Audio metadata loaded');
            this.updateTimeDisplay();
            this.updateControls(this.playerState.getState());
        });

        // Handle when audio can be played
        this.audioService.addEventListener('canplay', () => {
            console.log('PlayerControls: Audio can be played');
            this.updateControls(this.playerState.getState());
        });

        // Handle custom audio ready event for iOS Safari
        this.audioService.addEventListener('audioReady', () => {
            console.log('PlayerControls: Audio ready event received');
            this.updateControls(this.playerState.getState());
        });

        // Initial time display
        this.updateTimeDisplay();
    }

    setupStateSubscription() {
        this.playerState.subscribe(state => this.updateControls(state));
    }

    updateControls(state) {
        // Update button states - enable play button if audio is loaded or generating
        const hasAudio = this.audioService.audio && this.audioService.audio.src && !this.audioService.audio.error;
        const wasDisabled = this.elements.playPauseBtn.disabled;
        this.elements.playPauseBtn.disabled = !hasAudio && !state.isGenerating;
        this.elements.seekSlider.disabled = !state.duration;
        this.elements.cancelBtn.style.display = state.isGenerating ? 'block' : 'none';
        
        console.log('PlayerControls: updateControls called', {
            hasAudio,
            audioSrc: this.audioService.audio?.src,
            audioError: this.audioService.audio?.error,
            isGenerating: state.isGenerating,
            playButtonDisabled: this.elements.playPauseBtn.disabled,
            wasDisabled
        });
        
        // Update volume and speed if changed externally
        if (this.elements.volumeSlider.value !== state.volume * 100) {
            this.elements.volumeSlider.value = state.volume * 100;
        }
        
        if (this.elements.speedSlider.value !== state.speed.toString()) {
            this.elements.speedSlider.value = state.speed;
            this.elements.speedValue.textContent = state.speed.toFixed(1);
        }
    }

    cleanup() {
        this.stopTimeUpdate();
        if (this.audioService) {
            this.audioService.pause();
        }
        if (this.playerState) {
            this.playerState.reset();
        }
        // Reset UI elements
        this.elements.playPauseBtn.textContent = 'Play';
        this.elements.playPauseBtn.disabled = true;
        this.elements.seekSlider.value = 0;
        this.elements.seekSlider.disabled = true;
        this.elements.timeDisplay.textContent = '0:00 / 0:00';
    }
}

export default PlayerControls;