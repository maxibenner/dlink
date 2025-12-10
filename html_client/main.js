const buttonElement = document.getElementById("btn");
const audioElement = document.getElementById("audioPlayback");
const consoleElement = document.getElementById("console");
const switchButtonElement = document.getElementById("switchBtn");
const changeIdsButtonElement = document.getElementById("idsBtn");
const bodyElement = document.body;
const letterElement = document.getElementById("letter");

const clientA =
  localStorage.getItem("keySelf") || "tk-a123";
const clientB =
  localStorage.getItem("keyPartner") || "tk-b456";

const client = new DLinkClient({
  keySelf: clientA,
  keyPartner: clientB,
  host: "http://localhost:4000",
  consoleElement,
});

// Request mic permission on page load
const permission = navigator.mediaDevices.getUserMedia({ audio: true });

async function handleClick() {
  // Power on
  if (client.state === "off") {
    client.powerOn();
    return;
  }

  // Check if client with <key> has message in inbox
  if (client.state === "idle") {
    await client.checkOwnInbox();
    return;
  }

  // Download if message available
  if (client.state === "readyToDownload") {
    await client.recDownload(audioElement);
    return;
  }

  // Play downloaded message
  if (client.state === "readyToPlay") {
    await client.recPlay(audioElement);
    return;
  }

  // Check partner inbox if ready
  if (client.state === "readyToCheckPartner") {
    await client.checkPartnerInbox();
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

  // Power down if ready
  if (client.state === "readyToPowerDown") {
    client.powerDown();
    return;
  }
}

buttonElement.addEventListener("click", handleClick);

switchButtonElement.addEventListener("click", () => {
  consoleElement.textContent = "";
  client.state = client.state === "off" ? "off" : "idle";
  if (bodyElement.classList.contains("alt")) {
    client.toggleClient();
    letterElement.textContent = "A";
  } else {
    client.toggleClient();
    letterElement.textContent = "B";
  }
  bodyElement.classList.toggle("alt");
});

changeIdsButtonElement.addEventListener("click", () => {
  const newKeySelf = prompt(`Enter new ID for A:`);
  const newKeyPartner = prompt("Enter new ID for B:");
  if (newKeySelf) {
    client.keySelf = newKeySelf.trim();
    logToScreen(consoleElement, `ID A changed to ${client.keySelf}`);
    // Save to localStorage
    localStorage.setItem("keySelf", client.keySelf);
  }
  if (newKeyPartner) {
    client.keyPartner = newKeyPartner.trim();
    logToScreen(consoleElement, `ID B changed to ${client.keyPartner}`);
    // Save to localStorage
    localStorage.setItem("keyPartner", client.keyPartner);
  }

  client.powerOn();
});
