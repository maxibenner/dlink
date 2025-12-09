// Logs message to on-screen console
function logToScreen(consoleEl, data, type) {
  const truncObj = { ...data };

  // Generate timestamp to add to log
  const timestamp = new Date().toISOString();

  if (type === "multi") {
    // Multi-line message
    // Truncate object keys
    Object.keys(truncObj).forEach((key) => {
      truncObj[key] = `${
        truncObj[key] && truncObj[key].length > 100
          ? truncObj[key].substring(0, 100) + "..."
          : truncObj[key]
      }`;
    });

    const formattedData = JSON.stringify(truncObj, null, 2);

    // Concanetnate previous data, new data, and timestamp
    consoleEl.textContent = `${consoleEl.textContent}>> ${timestamp}\n${formattedData}\n\n`;
  } else {
    // Single line message
    consoleEl.textContent = `${consoleEl.textContent}>> ${timestamp}\n${data}\n\n`;
  }

  // Scroll to bottom
  consoleEl.scrollTop = consoleEl.scrollHeight;
}