const buttonElement = document.getElementById("btn");
const audioElement = document.getElementById("audioPlayback");
const consoleElement = document.getElementById("console");
const switchButtonElement = document.getElementById("switchBtn");
const bodyElement = document.body;
const letterElement = document.getElementById("letter");

const clientA = "tk-a2a5729c1-309b-40b2-a61e";
const clientB = "tk-b4b6f3c2d-45d6-b789-c4b5";

const client = new DLinkClient({
  key: clientA,
  host: "http://localhost:4000",
  consoleElement,
});

logToScreen(consoleElement, `Initialized with key: ${client.key}`);

// Request mic permission on page load
const permission = navigator.mediaDevices.getUserMedia({ audio: true });

async function handleClick() {
  // Check if client with <key> has message in inbox
  if (client.state === "idle") {
    await client.hasMessage();
    return;
  }

  // Start recording if ready
  if (client.state === "readyToRecord") {
    client.recStart();
    return;
  }

  // Stop recording if recording
  if (client.state === "recording") {
    client.recStop();
    return;
  }

  // Upload recorded message if recorded
  if (client.state === "recorded") {
    await client.recUpload();
    return;
  }

  // switch (client.state) {
  //   case "INCOMING":
  //     audioElement.src = client.audioObjUrl;
  //     audioElement.play();
  //     logToScreen(consoleElement, "Playback started.");
  //     audioElement.onended = () => {
  //       logToScreen(consoleElement, "Playback finished.");
  //       // client.inbox();
  //     };
  //     break;
  //   case "EMPTY":
  //     client.recordingStart();
  //     break;
  //   case "RECORDING": {
  //     client.recordingStop();
  //     break;
  //   }
  // }
}

buttonElement.addEventListener("click", handleClick);

switchButtonElement.addEventListener("click", () => {
  consoleElement.textContent = "";
  client.state = "idle";
  if (bodyElement.classList.contains("alt")) {
    client.changeClient(clientA);
    letterElement.textContent = "A";
  } else {
    client.changeClient(clientB);
    letterElement.textContent = "B";
  }
  bodyElement.classList.toggle("alt");
});
