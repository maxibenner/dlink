class DLinkClient {
  constructor({
    key,
    host,
    defaultState = "idle", // idle, readyToRecord, recording, recorded, uploading
    consoleElement,
  }) {
    this.key = key;
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

  /** Check if client with provided key has a message in their inbox
   */
  async hasMessage() {
    const url = `${this.host}/v1/status/${this.key}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data) {
      // Ready to record
      this.state = "readyToRecord";
      logToScreen(this.cEl, "Client is available to receive message");
    } else {
      // Prevent sending if inbox is full
      logToScreen(this.cEl, "Client inbox is full");
    }

    return data;
  }

  // async inbox() {
  //   logToScreen(this.cEl, "Checking inbox...");
  //   const url = `${this.host}/v1/inbox/${this.key}/${this.clientName}`;
  //   const response = await fetch(url);
  //   const data = await response.json();
  //   this.state = data.code;
  //   // If message is available, decode and download
  //   if (data.code === "INCOMING" && data.data) {
  //     await this.base64ToObjUrl(data.data);
  //   }
  //   logToScreen(this.cEl, data, "multi");
  //   return data;
  // }

  /**
   * Start recording audio from the user's microphone
   */
  async recStart() {
    // Handle permissions
    if (!navigator.mediaDevices) throw new Error("MediaDevices not supported");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Start recording
    this.state = "recording";
    logToScreen(this.cEl, "Recording started...");
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
    logToScreen(this.cEl, "Recording stopped");
    this.mediaRecorder.stop();
    this.state = "recorded";
  }

  async recUpload() {
    if (!this.audioBlob) throw new Error("No audio recorded");
    logToScreen(this.cEl, "Uploading message...");

    this.state = "uploading";
    const url = `${this.host}/v1/upload/${this.key}`;
    const response = await fetch(url, {
      method: "POST",
      body: this.audioBlob,
    });

    const json = await response.json();
    this.state = "idle";
    logToScreen(consoleElement, "Upload complete");
    return json;
  }

  /**
   * Switch client key
   */
  changeClient(newKey) {
    this.key = newKey;
    logToScreen(this.cEl, `Switched to client ${newKey}`);
  }
}
