class DLinkClient {
  constructor({
    clientName,
    key,
    host,
    defaultState = "IDLE",
    consoleElement,
    buttonElement,
    audioElement,
  }) {
    this.clientName = clientName;
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
    this.bEl = buttonElement;
    this.aEl = audioElement;
  }

  async init() {
    const inboxData = await this.inbox();
    this.state = inboxData.code;

    return inboxData;
  }

  async inbox() {
    logToScreen(this.cEl, "Checking inbox...");
    const url = `${this.host}/v1/inbox/${this.key}/${this.clientName}`;
    const response = await fetch(url);
    const data = await response.json();
    this.state = data.code;
    // If message is available, decode and download
    if (data.code === "INCOMING" && data.data) {
      await this.base64ToObjUrl(data.data);
    }
    logToScreen(this.cEl, data, "multi");
    return data;
  }

  async recordingStart() {
    if (!navigator.mediaDevices) throw new Error("MediaDevices not supported");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    logToScreen(this.cEl, "Recording started...");
    this.mediaRecorder = new MediaRecorder(stream);
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.onstop = async () => {
      this.audioBlob = new Blob(this.chunks, { type: "audio/ogg" });
      logToScreen(this.cEl, "Uploading...");
      await this.recordingUpload();
      logToScreen(this.cEl, "Done");
      this.inbox();
    };
    this.mediaRecorder.start();
    this.state = "RECORDING";
  }

  recordingStop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }

  async recordingUpload() {
    if (!this.audioBlob) throw new Error("No audio recorded");

    this.state = "UPLOADING";
    const url = `${this.host}/v1/inbox/${this.key}/${this.clientName}`;
    const response = await fetch(url, {
      method: "POST",
      body: this.audioBlob,
    });
    return await response.json();
  }

  async base64ToObjUrl(base64Data) {
    // base64Data is the encoded audio from inbox
    const audioData = atob(base64Data);
    const arrayBuffer = new Uint8Array(
      [...audioData].map((c) => c.charCodeAt(0))
    );
    const blob = new Blob([arrayBuffer], { type: "audio/ogg" });
    this.audioObjUrl = URL.createObjectURL(blob);

    return blob;
  }
}
