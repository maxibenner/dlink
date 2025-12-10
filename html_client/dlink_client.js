class DLinkClient {
  constructor({
    keySelf,
    keyPartner,
    host,
    defaultState = "off", // off, idle, readyToDownload, readyToPlay, readyToCheckPartner, readyToRecord, recording, recorded, uploading, readyToPowerDown
    consoleElement,
  }) {
    this.keySelf = keySelf;
    this.keyPartner = keyPartner;
    this.host = host;
    this.state = defaultState;
    this.eventListeners = {};
    this.audioObjUrl = null;
    this.audioBlob = null;
    this.mediaRecorder = null;
    this.chunks = [];

    // DOM elements
    this.cEl = consoleElement;
  }

  /**
   * Check own inbox
   */
  async checkOwnInbox() {
    const url = `${this.host}/v1/status/${this.keySelf}`;
    const response = await fetch(url);
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
    const url = `${this.host}/v1/status/${this.keyPartner}`;
    const response = await fetch(url);
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
    const url = `${this.host}/v1/download/${this.keySelf}`;
    const response = await fetch(url);
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
          "Playback ended [click to check your partner's inbox]"
        );
        this.state = "readyToCheckPartner";
        resolve();
      };
    });
  }

  /**
   * Start recording audio
   */
  async recStart() {
    // Handle permissions
    if (!navigator.mediaDevices) throw new Error("MediaDevices not supported");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Start recording
    this.state = "recording";
    logToScreen(this.cEl, "Recording started... [click to stop]");
    this.mediaRecorder = new MediaRecorder(stream);
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.onstop = async () => {
      this.audioBlob = new Blob(this.chunks, { type: "audio/ogg" });
    };
    this.mediaRecorder.start();
  }

  /**
   * Stop recording audio
   */
  recStop() {
    this.state = "idle";
    logToScreen(this.cEl, "Recording stopped [click to upload]");
    this.mediaRecorder.stop();
    this.state = "recorded";
  }

  /**
   * Upload recorded audio
   */
  async recUpload() {
    if (!this.audioBlob) throw new Error("No audio recorded");
    logToScreen(this.cEl, "Uploading message...");

    this.state = "uploading";
    const url = `${this.host}/v1/upload/${this.keyPartner}`;
    const response = await fetch(url, {
      method: "POST",
      body: this.audioBlob,
    });

    const json = await response.json();
    this.state = "readyToPowerDown";
    logToScreen(consoleElement, "Upload complete [click to power down]");
    return json;
  }

  /**
   * Power down client
   */
  powerOn() {
    logToScreen(
      consoleElement,
      `Client ${client.keySelf} [click to check your inbox]`
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
    const newKeySelf = this.keySelf;
    const newKeyPartner = this.keyPartner;
    this.keySelf = newKeyPartner;
    this.keyPartner = newKeySelf;

    if (this.state !== "off") {
      logToScreen(
        this.cEl,
        `Switched to client ${this.keySelf} [click to check your inbox]`
      );
    }
  }
}
