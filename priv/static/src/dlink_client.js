class DLinkClient {
  constructor({
    keySelf,
    keyPartner,
    host,
    defaultState = "off", // off, idle, readyToDownload, readyToPlay, readyToCheckPartner, readyToRecord, recording, recorded, uploading, readyToPowerDown
    consoleElement,
    activeClient,
  }) {
    this.keySelf = keySelf;
    this.keyPartner = keyPartner;
    this.host = host;
    this.state = defaultState;
    this.eventListeners = {};
    this.audioObjUrl = null;
    this.audioBlob = null;
    this.stream = null;
    this.audioContext = null;
    this.mediaStreamSource = null;
    this.processor = null;
    this.silenceGain = null;
    this.recordedBuffers = [];
    this.ac = activeClient; // self or partner

    // DOM elements
    this.cEl = consoleElement;
  }

  /**
   * Check own inbox
   */
  async checkOwnInbox() {
    const url = `${this.host}/v1/${
      this.ac === "self" ? this.keySelf : this.keyPartner
    }/inbox`;
    const response = await fetch(url);

    // Make sure response is ok
    if (!response.ok) {
      logToScreen(this.cEl, `Request failed`);
      return;
    }

    const data = await response.json();

    if (!data) {
      // No messages, check partner inbox
      logToScreen(
        this.cEl,
        "Your inbox is empty [click to check your partner's inbox]"
      );
      this.state = "readyToCheckPartner";
    } else {
      // Ready to download message
      logToScreen(this.cEl, "You have a new message [click to download]");
      this.state = "readyToDownload";
    }

    return data;
  }

  /**
   * Check partner inbox
   */
  async checkPartnerInbox() {
    const url = `${this.host}/v1/${
      this.ac === "self" ? this.keyPartner : this.keySelf
    }/inbox`;
    const response = await fetch(url);

    // Make sure response is ok
    if (!response.ok) {
      logToScreen(this.cEl, `Request failed`);
      return;
    }

    const data = await response.json();

    if (!data) {
      // Ready to record
      logToScreen(this.cEl, "Your partner's inbox is empty [click to record]");
      this.state = "readyToRecord";
    } else {
      // Prevent sending if inbox is full
      logToScreen(
        this.cEl,
        "Your partner's inbox is full. Please wait for them to download it [click to power down]"
      );
      this.state = "readyToPowerDown";
    }

    return data;
  }

  /**
   * Download recorded audio
   */
  async recDownload() {
    logToScreen(this.cEl, "Downloading message...");
    const url = `${this.host}/v1/${
      this.ac === "self" ? this.keySelf : this.keyPartner
    }/inbox/message`;
    const response = await fetch(url);

    // Make sure response is ok
    if (!response.ok) {
      logToScreen(this.cEl, `Request failed`);
      return;
    }

    const blob = await response.blob();
    this.audioBlob = blob;

    logToScreen(this.cEl, "Download complete [click to play]");
    this.state = "readyToPlay";
  }

  /**
   * Play audio message
   */
  recPlay() {
    if (!this.audioBlob) throw new Error("No audio to play");
    const audioUrl = URL.createObjectURL(this.audioBlob);

    // Create audio element and play
    const audioEl = new Audio();
    audioEl.src = audioUrl;
    audioEl.play();
    logToScreen(this.cEl, "Playing message...");
    this.state = "playing";

    // Await playback end
    return new Promise((resolve) => {
      audioEl.onended = () => {
        logToScreen(
          this.cEl,
          "Playback ended [click to delete message from server]"
        );
        this.state = "readyToDelete";
        resolve();
      };
    });
  }

  /**
   * Start recording audio
   */
  async recStart() {
    if (!navigator.mediaDevices) throw new Error("MediaDevices not supported");
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) throw new Error("Web Audio API not supported");

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContextCtor();
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silenceGain = this.audioContext.createGain();
    this.silenceGain.gain.value = 0;
    this.recordedBuffers = [];

    this.processor.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      this.recordedBuffers.push(new Float32Array(channelData));
    };

    this.mediaStreamSource.connect(this.processor);
    this.processor.connect(this.silenceGain);
    this.silenceGain.connect(this.audioContext.destination);

    this.state = "recording";
    logToScreen(this.cEl, "Recording started... [click to stop]");
  }

  /**
   * Stop recording audio
   */
  recStop() {
    if (!this.stream) throw new Error("No active recording session");

    this.state = "idle";
    logToScreen(this.cEl, "Recording stopped [click to upload]");

    this._finalizeRecording();
    this.state = "recorded";
  }

  /**
   * Upload recorded audio
   */
  async recUpload() {
    if (!this.audioBlob) throw new Error("No audio recorded");
    logToScreen(this.cEl, "Uploading message...");

    this.state = "uploading";
    const url = `${this.host}/v1/${
      this.ac === "self" ? this.keyPartner : this.keySelf
    }/inbox/message`;
    const response = await fetch(url, {
      method: "POST",
      body: this.audioBlob,
    });

    // Make sure response is ok
    if (!response.ok) {
      logToScreen(this.cEl, `Request failed`);
      return;
    }

    const json = await response.json();
    this.state = "readyToPowerDown";
    logToScreen(this.cEl, "Upload complete [click to power down]");
    return json;
  }

  /**
   * Delete own message from inbox
   */
  async recDelete() {
    logToScreen(this.cEl, "Deleting message...");

    const url = `${this.host}/v1/${
      this.ac === "self" ? this.keySelf : this.keyPartner
    }/inbox/message`;
    const response = await fetch(url, {
      method: "DELETE",
    });

    const json = await response.json();
    this.state = "readyToCheckPartner";
    logToScreen(
      this.cEl,
      "Message deleted [click to check your partner's inbox]"
    );
    return json;
  }

  /**
   * Power down client
   */
  powerOn() {
    logToScreen(
      this.cEl,
      `Client: ${
        this.ac === "self" ? this.keySelf : this.keyPartner
      } [click to check your inbox]`
    );
    this.state = "idle";
  }

  /**
   * Power down client
   */
  powerDown() {
    clearScreen(this.cEl);
    this.state = "off";
  }

  /**
   * Switch client key
   */
  toggleClient() {
    this.ac = this.ac === "self" ? "partner" : "self";

    logToScreen(
      this.cEl,
      `Switched to client ${
        this.ac === "self" ? this.keySelf : this.keyPartner
      } [click to check your inbox]`
    );

    this.state = "idle";
  }

  _finalizeRecording() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    const blob = this._createPcmBlob();
    this.audioBlob = blob;
    this._cleanupAudioGraph();

    this.recordedBuffers = [];
    this.stream = null;
    return blob;
  }

  _cleanupAudioGraph() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    if (this.mediaStreamSource) this.mediaStreamSource.disconnect();
    if (this.silenceGain) this.silenceGain.disconnect();

    const context = this.audioContext;
    this.processor = null;
    this.mediaStreamSource = null;
    this.silenceGain = null;

    if (context && context.state !== "closed") {
      context.close().catch(() => {});
    }
    this.audioContext = null;
  }

  _createPcmBlob() {
    if (!this.recordedBuffers.length) return null;

    const samples = this._mergeBuffers(this.recordedBuffers);
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const wavBuffer = this._encode16BitWav(samples, sampleRate);
    return new Blob([wavBuffer], { type: "audio/wav" });
  }

  _mergeBuffers(buffers) {
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;

    buffers.forEach((buffer) => {
      result.set(buffer, offset);
      offset += buffer.length;
    });

    return result;
  }

  _encode16BitWav(samples, sampleRate) {
    const bytesPerSample = 2;
    const blockAlign = bytesPerSample * 1;
    const byteRate = sampleRate * blockAlign;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i += 1) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true); // Bits per sample
    writeString(36, "data");
    view.setUint32(40, samples.length * bytesPerSample, true);

    this._floatTo16BitPCM(view, 44, samples);

    return buffer;
  }

  _floatTo16BitPCM(view, offset, samples) {
    for (let i = 0; i < samples.length; i += 1, offset += 2) {
      let s = samples[i];
      s = Math.max(-1, Math.min(1, s));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }
}
