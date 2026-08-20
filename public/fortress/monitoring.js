(function (global) {
  "use strict";

  class LocalAccessMonitor extends EventTarget {
    constructor() {
      super();
      this.running = false;
      this.stream = null;
      this.video = null;
      this.canvas = null;
      this.audioContext = null;
      this.analyser = null;
      this.audioBuffer = null;
      this.previousFrame = null;
      this.frameTimer = 0;
      this.audioTimer = 0;
      this.alertTimes = new Map();
      this.metrics = { motion: 0, light: 0, sound: 0, environment: "Unknown" };
    }

    emit(type, detail = {}) {
      this.dispatchEvent(new CustomEvent(type, { detail }));
    }

    alert(kind, message, score) {
      const now = Date.now();
      if (now - (this.alertTimes.get(kind) || 0) < 12000) return;
      this.alertTimes.set(kind, now);
      this.emit("notice", { kind, message, score, at: now });
    }

    async start(video, canvas) {
      if (this.running) return this.metrics;
      if (!global.isSecureContext && global.location?.hostname !== "localhost") throw new Error("Camera and microphone access requires HTTPS or localhost.");
      if (!global.navigator?.mediaDevices?.getUserMedia) throw new Error("This browser does not provide camera and microphone access.");

      this.emit("state", { state: "requesting" });
      try {
        this.stream = await global.navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
        });
        this.video = video;
        this.canvas = canvas;
        this.video.srcObject = this.stream;
        await this.video.play();
        await this.setupAudio();
        this.running = true;
        this.stream.getTracks().forEach(track => track.addEventListener("ended", () => this.stop("Media access ended in the browser."), { once: true }));
        this.frameTimer = global.setInterval(() => this.sampleVideo(), 500);
        this.audioTimer = global.setInterval(() => this.sampleAudio(), 220);
        this.emit("state", { state: "active", video: this.stream.getVideoTracks().length > 0, audio: this.stream.getAudioTracks().length > 0 });
        this.alert("monitoring_started", "Local camera and microphone analysis started.", 0);
        return this.metrics;
      } catch (error) {
        this.stop();
        this.emit("state", { state: "denied", error: error.message });
        throw error;
      }
    }

    async setupAudio() {
      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass || !this.stream.getAudioTracks().length) return;
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === "suspended") await this.audioContext.resume();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.72;
      source.connect(this.analyser);
      this.audioBuffer = new Uint8Array(this.analyser.fftSize);
    }

    sampleVideo() {
      if (!this.running || !this.video || this.video.readyState < 2 || !this.canvas) return;
      const context = this.canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      const pixels = context.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
      const current = new Uint8Array(pixels.length / 16);
      let lightTotal = 0;
      let difference = 0;
      let index = 0;
      for (let pixel = 0; pixel < pixels.length; pixel += 16) {
        const value = Math.round((pixels[pixel] * 0.299) + (pixels[pixel + 1] * 0.587) + (pixels[pixel + 2] * 0.114));
        current[index] = value;
        lightTotal += value;
        if (this.previousFrame) difference += Math.abs(value - this.previousFrame[index]);
        index += 1;
      }
      const light = Math.round((lightTotal / current.length / 255) * 100);
      const motion = this.previousFrame ? Math.min(100, Math.round((difference / current.length / 42) * 100)) : 0;
      this.previousFrame = current;
      this.metrics.light = light;
      this.metrics.motion = motion;
      this.metrics.environment = light < 7 ? "Low visibility" : motion > 42 ? "High movement" : motion > 7 ? "Movement observed" : "Stable scene";
      if (light < 7) this.alert("low_light", "Very low ambient light detected.", 28);
      if (motion > 58) this.alert("high_motion", "A high level of visual change was detected.", 34);
      this.emit("metrics", { ...this.metrics });
    }

    sampleAudio() {
      if (!this.running || !this.analyser || !this.audioBuffer) return;
      this.analyser.getByteTimeDomainData(this.audioBuffer);
      let total = 0;
      for (const sample of this.audioBuffer) {
        const normalized = (sample - 128) / 128;
        total += normalized * normalized;
      }
      const rms = Math.sqrt(total / this.audioBuffer.length);
      this.metrics.sound = Math.min(100, Math.round(rms * 310));
      if (this.metrics.sound > 68) this.alert("sound_spike", "A notable sound-level spike was detected.", 24);
      this.emit("metrics", { ...this.metrics });
    }

    stop(message) {
      global.clearInterval(this.frameTimer);
      global.clearInterval(this.audioTimer);
      this.frameTimer = 0;
      this.audioTimer = 0;
      const wasRunning = this.running;
      this.running = false;
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = null;
      if (this.video) this.video.srcObject = null;
      this.audioContext?.close?.();
      this.audioContext = null;
      this.analyser = null;
      this.audioBuffer = null;
      this.previousFrame = null;
      this.metrics = { motion: 0, light: 0, sound: 0, environment: "Unknown" };
      if (wasRunning || message) this.emit("state", { state: "stopped", message });
    }
  }

  global.LocalAccessMonitor = LocalAccessMonitor;
})(globalThis);
