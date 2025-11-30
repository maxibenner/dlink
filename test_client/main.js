console.log("Page loaded");

const buttonElement = document.getElementById("btn");
const audioElement = document.getElementById("audioPlayback");
const consoleElement = document.getElementById("console");

const client = new DLinkClient({
  clientName: "web-test",
  key: "tk-2a5729c1-309b-40b2-a61e",
  host: "http://localhost:4000",
  buttonElement,
  audioElement,
  consoleElement,
});

// Request mic permission on page load
navigator.mediaDevices.getUserMedia({ audio: true });

// window.addEventListener("DOMContentLoaded", requestMicPermission);

// async function main() {
//   const res = await client.init();
// }

// main();

async function handleClick() {
  const hasMessage = await client.hasMessage(client.key);
  logToScreen(consoleElement, "Inbox " + client.key + " has message: " + hasMessage);

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
