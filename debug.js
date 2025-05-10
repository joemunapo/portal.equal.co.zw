// Debug logging system for mobile devices
const DEBUG_MODE = true; // Set to false in production
const MAX_LOG_ENTRIES = 50;
let debugLogs = [];

// Create debug panel in the DOM
function createDebugPanel() {
  if (!DEBUG_MODE) return;

  // Check if panel already exists
  if (document.getElementById('debug-panel')) return;

  // Create the debug panel elements
  const debugPanel = document.createElement('div');
  debugPanel.id = 'debug-panel';
  debugPanel.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 200px;
    background-color: rgba(0, 0, 0, 0.85);
    color: #00ff00;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
    overflow-y: auto;
    transform: translateY(200px);
    transition: transform 0.3s;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.5);
    padding: 5px;
    box-sizing: border-box;
  `;

  const toggleButton = document.createElement('button');
  toggleButton.id = 'debug-toggle';
  toggleButton.textContent = 'Debug';
  toggleButton.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background-color: rgba(0, 0, 0, 0.7);
    color: #00ff00;
    border: 1px solid #00ff00;
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 12px;
    z-index: 10000;
    opacity: 0.7;
  `;

  const logContainer = document.createElement('div');
  logContainer.id = 'debug-log';

  // Add elements to the DOM
  debugPanel.appendChild(logContainer);
  document.body.appendChild(debugPanel);
  document.body.appendChild(toggleButton);

  // Toggle debug panel on button click
  toggleButton.addEventListener('click', function() {
    if (debugPanel.style.transform === 'translateY(0px)') {
      debugPanel.style.transform = 'translateY(200px)';
    } else {
      debugPanel.style.transform = 'translateY(0px)';
      renderLogs();
    }
  });
}

// Add a log entry
function debugLog(message, type = 'info', data = null) {
  if (!DEBUG_MODE) return;

  const timestamp = new Date().toISOString().slice(11, 23);
  const logEntry = {
    time: timestamp,
    type: type,
    message: message,
    data: data
  };

  // Save to log array
  debugLogs.unshift(logEntry);

  // Limit array size
  if (debugLogs.length > MAX_LOG_ENTRIES) {
    debugLogs.pop();
  }

  // Render if debug panel is visible
  const debugPanel = document.getElementById('debug-panel');
  if (debugPanel && debugPanel.style.transform === 'translateY(0px)') {
    renderLogs();
  }

  // Also log to console if available
  try {
    if (type === 'error') {
      console.error(message, data || '');
    } else if (type === 'warn') {
      console.warn(message, data || '');
    } else {
      console.log(message, data || '');
    }
  } catch (e) {
    // Ignore console errors
  }
}

// Render logs to debug panel
function renderLogs() {
  const logContainer = document.getElementById('debug-log');
  if (!logContainer) return;

  logContainer.innerHTML = '';

  debugLogs.forEach(log => {
    const logItem = document.createElement('div');
    logItem.className = `log-item log-${log.type}`;

    let dataText = '';
    if (log.data) {
      try {
        dataText = typeof log.data === 'object' ? ' › ' + JSON.stringify(log.data).substring(0, 150) : ' › ' + log.data;
        if (dataText.length > 150) dataText = dataText.substring(0, 147) + '...';
      } catch (e) {
        dataText = ' › [Complex Object]';
      }
    }

    logItem.innerHTML = `<span class="log-time">${log.time}</span> <span class="log-type">${log.type.toUpperCase()}</span>: ${log.message}${dataText}`;

    // Style based on log type
    if (log.type === 'error') {
      logItem.style.color = '#ff5555';
    } else if (log.type === 'warn') {
      logItem.style.color = '#ffaa00';
    } else if (log.type === 'success') {
      logItem.style.color = '#55ff55';
    }

    logContainer.appendChild(logItem);
  });
}

// Override console methods to capture logs
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

// Override console methods if in debug mode
if (DEBUG_MODE) {
  console.log = function() {
    const args = Array.from(arguments);
    debugLog(args[0], 'info', args.length > 1 ? args.slice(1) : null);
    originalConsole.log.apply(console, arguments);
  };

  console.warn = function() {
    const args = Array.from(arguments);
    debugLog(args[0], 'warn', args.length > 1 ? args.slice(1) : null);
    originalConsole.warn.apply(console, arguments);
  };

  console.error = function() {
    const args = Array.from(arguments);
    debugLog(args[0], 'error', args.length > 1 ? args.slice(1) : null);
    originalConsole.error.apply(console, arguments);
  };
}

// Add this to your DOMContentLoaded event
document.addEventListener("DOMContentLoaded", function() {
  // Initialize debug panel
  createDebugPanel();

  // Log browser and device information
  debugLog('Device Info', 'info', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
    screen: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio || 1,
    connection: navigator.connection ?
      {
        type: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : 'N/A'
  });

  // Rest of your existing code...
});

// Modify your fetchPackagesWithFallback function to add more detailed logging
function fetchPackagesWithFallback() {
  debugLog('Starting package fetch with fallback method', 'info');

  const displayTbody = document.getElementById("voucher-display-tbody");
  const displayTfoot = document.getElementById("voucher-display-tfoot");

  if (!displayTbody || !displayTfoot) {
    debugLog('Table elements not found', 'error');
    return;
  }

  displayTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading packages...</td></tr>';
  displayTfoot.style.display = 'none';
  selectPackage.innerHTML = '<option value="" disabled selected>Loading packages...</option>';
  selectPackage.disabled = true;

  try {
    // Add a timestamp to prevent caching
    const url = `${API_BASE_URL}/available?t=${new Date().getTime()}`;
    debugLog(`Fetching packages from: ${url}`, 'info');

    // Try using fetch API for better Android compatibility
    fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      cache: 'no-store' // Explicitly prevent caching
    })
    .then(response => {
      debugLog(`Fetch response status: ${response.status}`, 'info');
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }
      return response.json();
    })
    .then(response => {
      debugLog('Package fetch successful', 'success', response);

      availableVoucherPackages = []; // Reset global store
      displayTbody.innerHTML = ''; // Clear display table

      if (response.data && response.data.length > 0) {
        debugLog(`Found ${response.data.length} packages`, 'success');
        availableVoucherPackages = response.data; // Store fetched packages globally

        // Populate main display table
        availableVoucherPackages.forEach(function (pkg) {
          const tr = document.createElement("tr");
          let durationText = "N/A";
          let dataLimitText = "N/A";
          if (pkg.name) {
            const nameParts = pkg.name.split(" - ");
            if (nameParts.length === 2) {
              durationText = nameParts[0];
              dataLimitText = nameParts[1];
            } else {
              dataLimitText = pkg.name;
            }
          }
          const priceText = `${pkg.currency === 'USD' ? '$' : pkg.currency}${pkg.price.toFixed(2)}`;
          tr.innerHTML = `
            <td>${dataLimitText}</td>
            <td>${durationText}</td>
            <td>${priceText}</td>
          `;
          displayTbody.appendChild(tr);
        });
        displayTfoot.style.display = '';
        showHint("modal-hint", "", "info"); // Clear modal hint
      } else {
        debugLog('No packages found in response', 'warn', response);
        displayTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No voucher packages currently available.</td></tr>';
        selectPackage.innerHTML = '<option value="" disabled selected>No packages available</option>';
        selectPackage.disabled = true;
      }
    })
    .catch(error => {
      debugLog(`Package fetch failed: ${error.message}`, 'error', error);
      const errorMessage = error.message || 'Please try again.';
      displayTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Error loading packages: ${errorMessage}</td></tr>`;
      selectPackage.innerHTML = '<option value="" disabled selected>Error loading packages</option>';
      selectPackage.disabled = true;
      showHint("modal-hint", `Error loading packages: ${errorMessage}`, "error");

      // Try to diagnose network issues
      fetch('https://www.google.com', { method: 'HEAD', mode: 'no-cors' })
        .then(() => {
          debugLog('Internet connection test successful', 'info');
        })
        .catch(err => {
          debugLog('Internet connection test failed', 'error', err);
        });

      // Add retry button
      const retryButton = document.createElement('button');
      retryButton.textContent = 'Retry Loading Packages';
      retryButton.className = 'button secondary';
      retryButton.style.marginTop = '10px';
      retryButton.addEventListener('click', function() {
        debugLog('Manual retry initiated by user', 'info');
        fetchPackagesWithFallback(); // Retry loading with fallback
      });

      // Add the retry button after the table
      const table = document.getElementById('voucher-display-table');
      if (table && table.parentNode) {
        if (document.getElementById('retry-button')) {
          document.getElementById('retry-button').remove();
        }
        retryButton.id = 'retry-button';
        table.parentNode.insertBefore(retryButton, table.nextSibling);
      }
    });
  } catch (e) {
    debugLog('Critical error in fetch fallback', 'error', e);
    displayTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Error loading packages. Please reload the page.</td></tr>`;
  }
}