// Configuration
const API_BASE_URL = (function () {
  // Get the current protocol (http: or https:)
  const protocol = window.location.protocol;

  // Base URL with the appropriate protocol
  let baseUrl = "https://botdev.xash.co.zw/api/v1/wifi-vouchers";

  // If we're on a secure connection but the API is not, try to use HTTPS
  if (protocol === 'https:' && baseUrl.startsWith('http:')) {
    baseUrl = baseUrl.replace('http:', 'https:');
  }

  console.log("Using API base URL:", baseUrl);
  return baseUrl;
})();

// Global variable to store fetched packages
let availableVoucherPackages = [];

// Helper to display hints
function showHint(elementId, message, type = "error") {
  const hintElement = document.getElementById(elementId);
  if (hintElement) {
    hintElement.textContent = message;
    hintElement.className = ''; // Clear existing classes
    if (elementId === 'modal-hint') {
      hintElement.classList.add('modal-hint', type);
    } else {
      hintElement.classList.add('hint', type);
    }
  }
}


function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => showHint("oper-hint", "Voucher code copied to clipboard!", "success"))
      .catch(err => console.error('Failed to copy: ', err));
  }
}
// Helper function to sanitize voucher codes by removing all spaces
function sanitizeVoucherCode(code) {
  if (!code) return '';
  // Remove all spaces (including non-breaking spaces and other whitespace)
  return code.replace(/\s+/g, '');
}

// Improved fetch with XMLHttpRequest fallback
function improvedFetchWithFallback(url, options, successCallback, errorCallback) {
  // First try the fetch API with more robust error handling
  try {
    // Add cache-busting parameter more reliably
    const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + '_cb=' + new Date().getTime();

    // Set a timeout for fetch (since fetch doesn't support timeout natively)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 15000);
    });

    Promise.race([
      fetch(cacheBustUrl, {
        method: options.method || 'GET',
        headers: options.headers || {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        cache: 'no-store'
      }),
      timeoutPromise
    ])
      .then(response => {
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        successCallback(data);
      })
      .catch(error => {
        console.warn("Fetch failed, falling back to XMLHttpRequest:", error);

        // Fall back to XMLHttpRequest if fetch fails
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', cacheBustUrl, true);

        // Set headers
        if (options.headers) {
          Object.keys(options.headers).forEach(key => {
            xhr.setRequestHeader(key, options.headers[key]);
          });
        } else {
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.setRequestHeader("Accept", "application/json");
        }

        // Add timeout handling
        xhr.timeout = 15000;
        xhr.ontimeout = function () {
          errorCallback({ message: "Request timed out. Please check your connection and try again." }, 408);
        };

        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            try {
              if (xhr.status >= 200 && xhr.status < 300) {
                const responseData = xhr.responseText ? JSON.parse(xhr.responseText) : {};
                successCallback(responseData);
              } else {
                const errorData = xhr.responseText ? JSON.parse(xhr.responseText) : { message: "Request failed" };
                errorCallback(errorData, xhr.status);
              }
            } catch (e) {
              errorCallback({ message: "Error processing response: " + e.message }, xhr.status || 0);
            }
          }
        };

        xhr.onerror = function () {
          errorCallback({ message: "Network error. Please check your connection." }, 0);
        };

        // Send the request
        if (options.method === 'POST' && options.body) {
          xhr.send(JSON.stringify(options.body));
        } else {
          xhr.send();
        }
      });
  } catch (e) {
    // If fetch is not supported or throws immediate error, fall back to XMLHttpRequest
    console.warn("Fetch not supported, using XMLHttpRequest directly:", e);

    const xhr = new XMLHttpRequest();
    const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + '_cb=' + new Date().getTime();

    xhr.open(options.method || 'GET', cacheBustUrl, true);

    // Set headers
    if (options.headers) {
      Object.keys(options.headers).forEach(key => {
        xhr.setRequestHeader(key, options.headers[key]);
      });
    } else {
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "application/json");
    }

    // Add timeout handling
    xhr.timeout = 15000;
    xhr.ontimeout = function () {
      errorCallback({ message: "Request timed out. Please check your connection and try again." }, 408);
    };

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const responseData = xhr.responseText ? JSON.parse(xhr.responseText) : {};
            successCallback(responseData);
          } else {
            const errorData = xhr.responseText ? JSON.parse(xhr.responseText) : { message: "Request failed" };
            errorCallback(errorData, xhr.status);
          }
        } catch (e) {
          errorCallback({ message: "Error processing response: " + e.message }, xhr.status || 0);
        }
      }
    };

    xhr.onerror = function () {
      errorCallback({ message: "Network error. Please check your connection." }, 0);
    };

    // Send the request
    if (options.method === 'POST' && options.body) {
      xhr.send(JSON.stringify(options.body));
    } else {
      xhr.send();
    }
  }
}

// Legacy Ajax utility for backward compatibility
var Ajax = {
  _request: function (method, url, data, successCallback, errorCallback) {
    // Use the improved fetch/XHR function
    improvedFetchWithFallback(
      url,
      {
        method: method,
        body: method !== "GET" ? data : null
      },
      successCallback,
      errorCallback
    );
  },
  get: function (url, successCallback, errorCallback) {
    this._request("GET", url, null, successCallback, errorCallback);
  },
  post: function (url, data, successCallback, errorCallback) {
    this._request("POST", url, data, successCallback, errorCallback);
  },
};

// URL parameter handling
function getQueryStringKey(key) {
  return getQueryStringAsObject()[key];
}

function getQueryStringAsObject() {
  var b,
    cv,
    e,
    k,
    ma,
    sk,
    v,
    r = {},
    d = function (val) {
      return decodeURIComponent(val);
    },
    q = window.location.search.substring(1),
    s = /([^&;=]+)=?([^&;]*)/g;

  ma = function (val) {
    if (typeof val != "object") {
      cv = val;
      val = {};
      val.length = 0;
      if (cv) {
        Array.prototype.push.call(val, cv);
      }
    }
    return val;
  };

  while ((e = s.exec(q))) {
    b = e[1].indexOf("[");
    v = d(e[2]);
    if (b < 0) {
      k = d(e[1]);
      if (r[k]) {
        r[k] = ma(r[k]);
        Array.prototype.push.call(r[k], v);
      } else {
        r[k] = v;
      }
    } else {
      k = d(e[1].slice(0, b));
      sk = d(e[1].slice(b + 1, e[1].indexOf("]", b)));
      r[k] = ma(r[k]);
      if (sk) {
        r[k][sk] = v;
      } else {
        Array.prototype.push.call(r[k], v);
      }
    }
  }
  return r;
}

// Init variables for original portal logic
var portalData = {};
var portalGlobalConfig = {};
var portalSubmitUrl = "/portal/auth";
var portalIsCommited = false;

var clientMac = getQueryStringKey("clientMac");
var apMac = getQueryStringKey("apMac");
var gatewayMac = getQueryStringKey("gatewayMac") || undefined;
var ssidName = getQueryStringKey("ssidName") || undefined;
var radioId = !!getQueryStringKey("radioId")
  ? Number(getQueryStringKey("radioId"))
  : undefined;
var vid = !!getQueryStringKey("vid")
  ? Number(getQueryStringKey("vid"))
  : undefined;
var originUrl = getQueryStringKey("originUrl");

var portalErrorHintMap = {
  0: "Connected",
  "-1": "General error.",
  "-41500": "Invalid authentication type.",
  "-41501": "Failed to authenticate.",
  "-41502": "Voucher code is incorrect.",
  "-41503": "Voucher is expired.",
  "-41504": "Voucher traffic has exceeded the limit.",
  "-41505": "The number of users has reached the limit.",
  "-41531": "Your code have reached your Wi-Fi data limit.",
  "-41538": "Voucher is not effective.",
};

// Function to check if we are online and can reach the API
function checkConnectivityAndRecover() {
  let isOnline = navigator.onLine;

  // Display network status
  if (!isOnline) {
    showHint("oper-hint", "You appear to be offline. Please check your connection.", "error");
    return false;
  }

  // Try to ping the API to check if it's reachable
  return new Promise((resolve) => {
    // Set a timeout for the connectivity check
    const timeoutId = setTimeout(() => {
      showHint("oper-hint", "API server seems unreachable. Using offline mode if possible.", "warning");
      resolve(false);
    }, 5000);

    // Try to fetch just the response headers to minimize data transfer
    fetch(`${API_BASE_URL}/ping?t=${new Date().getTime()}`, {
      method: 'HEAD',
      cache: 'no-store'
    })
      .then(response => {
        clearTimeout(timeoutId);
        if (response.ok) {
          showHint("oper-hint", "", "info"); // Clear any error message
          resolve(true);
        } else {
          showHint("oper-hint", "API server returned an error. Some features may be limited.", "warning");
          resolve(false);
        }
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.error("Connectivity check failed:", error);
        showHint("oper-hint", "Could not connect to the API server. Some features may be limited.", "warning");
        resolve(false);
      });
  });
}

// Handle connection to WiFi - sanitizes voucher code
function handlePortalSubmit() {
  var voucherInput = document.getElementById("voucherCode");
  var voucherValue = voucherInput.value.trim();

  if (!voucherValue) {
    showHint("oper-hint", "Please enter a voucher code.", "error");
    voucherInput.focus();
    return;
  }

  // Sanitize the voucher code by removing all spaces
  var sanitizedVoucherCode = sanitizeVoucherCode(voucherValue);

  // Update the input field to show the sanitized code to the user
  voucherInput.value = sanitizedVoucherCode;

  var submitData = {
    authType: 3,
    voucherCode: sanitizedVoucherCode, // Use sanitized code
    clientMac: clientMac,
    apMac: apMac,
    gatewayMac: gatewayMac,
    ssidName: ssidName,
    radioId: radioId,
    vid: vid,
    originUrl: originUrl,
  };

  if (portalIsCommited) return;

  showHint("oper-hint", "Connecting...", "info");

  // Use XMLHttpRequest for portal submission since it's communicating with local Omada controller
  var xhrPortal = new XMLHttpRequest();
  xhrPortal.open("POST", portalSubmitUrl, true);
  xhrPortal.setRequestHeader("Content-Type", "application/json");

  // Add timeout handling for portal submission
  xhrPortal.timeout = 20000; // 20 seconds timeout
  xhrPortal.ontimeout = function () {
    showHint("oper-hint", "Connection request timed out. Please try again.", "error");
  };

  xhrPortal.onreadystatechange = function () {
    if (xhrPortal.readyState == 4) {
      try {
        var response = JSON.parse(xhrPortal.responseText);
        if (xhrPortal.status == 200 || xhrPortal.status == 304) {
          if (response && response.errorCode === 0) {
            portalIsCommited = true;
            showHint("oper-hint", portalErrorHintMap[response.errorCode], "success");
            if (response.result && response.result.landingUrl) {
              window.location.href = response.result.landingUrl;
            } else if (originUrl) {
              window.location.href = originUrl;
            } else {
              showHint("oper-hint", "Connected! You can now browse.", "success");
            }
          } else {
            showHint("oper-hint", portalErrorHintMap[response.errorCode] || "Authentication failed", "error");
          }
        } else {
          showHint("oper-hint", (response && response.message) || "Authentication failed with the portal.", "error");
        }
      } catch (e) {
        showHint("oper-hint", "Error processing portal response: " + e.message, "error");
      }
    }
  };

  xhrPortal.onerror = function () {
    showHint("oper-hint", "Network error connecting to portal. Please try again.", "error");
  };

  xhrPortal.send(JSON.stringify(submitData));
}

// Fetch packages with enhanced fallback mechanism
function fetchPackagesWithFallback() {
  console.log("Attempting to fetch voucher packages...");

  const displayTbody = document.getElementById("voucher-display-tbody");
  const displayTfoot = document.getElementById("voucher-display-tfoot");
  const selectPackage = document.getElementById("voucher-package");

  if (!displayTbody || !displayTfoot) {
    console.error("Voucher display table body or foot not found!");
    return;
  }

  if (!selectPackage) {
    console.error("Voucher package select element not found!");
    // Continue anyway as this might just be the main page without the modal open
  } else {
    selectPackage.innerHTML = '<option value="" disabled selected>Loading packages...</option>';
    selectPackage.disabled = true;
  }

  displayTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading packages...</td></tr>';
  displayTfoot.style.display = 'none';

  // Add a timestamp to prevent caching
  const url = `${API_BASE_URL}/available?t=${new Date().getTime()}`;

  // Use our improved fetch with fallback function
  improvedFetchWithFallback(
    url,
    { method: 'GET' },
    function (response) {
      console.log("Package fetch success:", response);

      availableVoucherPackages = []; // Reset global store
      displayTbody.innerHTML = ''; // Clear display table

      if (response.data && response.data.length > 0) {
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

        // Also update the modal's select dropdown if it exists
        if (selectPackage) {
          populateVoucherPackagesForModal();
        }
      } else {
        displayTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No voucher packages currently available.</td></tr>';
        if (selectPackage) {
          selectPackage.innerHTML = '<option value="" disabled selected>No packages available</option>';
          selectPackage.disabled = true;
        }
      }
    },
    function (errorResponse, status) {
      console.error("Package fetch error:", status, errorResponse);
      const errorMessage = errorResponse.message || 'Please try again.';
      displayTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Error loading packages: ${errorMessage}</td></tr>`;
      if (selectPackage) {
        selectPackage.innerHTML = '<option value="" disabled selected>Error loading packages</option>';
        selectPackage.disabled = true;
      }
      showHint("modal-hint", `Error loading packages: ${errorMessage}`, "error");

      // Add retry button
      const retryButton = document.createElement('button');
      retryButton.textContent = 'Retry Loading Packages';
      retryButton.className = 'button secondary';
      retryButton.style.marginTop = '10px';
      retryButton.addEventListener('click', function () {
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
    }
  );
}

// Modal functionality
var modal = document.getElementById("ecocash-modal");
var btnEcocash = document.getElementById("button-ecocash");
var closeModalBtn = document.getElementById("close-modal");
var btnSubmitEcocash = document.getElementById("submit-ecocash");
var selectPackage = document.getElementById("voucher-package");
var ecocashForm = document.getElementById("ecocash-form");

function resetModal() {
  ecocashForm.reset();
  showHint("modal-hint", "", "info");
  btnSubmitEcocash.textContent = "Pay Now";
  btnSubmitEcocash.disabled = false;
  if (pollingInterval) clearInterval(pollingInterval);
  pollAttempts = 0;
}

// Populate the modal's select dropdown using pre-fetched data
function populateVoucherPackagesForModal() {
  selectPackage.innerHTML = '<option value="" disabled selected>Select Package</option>'; // Reset
  if (availableVoucherPackages.length > 0) {
    availableVoucherPackages.forEach(function (pkg) {
      var option = document.createElement("option");
      option.value = pkg.id;
      option.textContent = `${pkg.name} ($${pkg.price.toFixed(2)})`;
      selectPackage.appendChild(option);
    });
    selectPackage.disabled = false;
    showHint("modal-hint", "", "info"); // Clear any previous modal hint
  } else {
    selectPackage.innerHTML = '<option value="" disabled selected>No packages available</option>';
    selectPackage.disabled = true;
    showHint("modal-hint", "No voucher packages currently available.", "error");
  }
}

// Helper function to standardize EcoCash number format
function formatEcocashNumber(number) {
  // Remove all non-digit characters
  number = number.replace(/\D/g, '');

  // Handle different formats
  if (number.startsWith('07')) {
    // Standard ZW format (e.g., 0771234567)
    if (number.length === 10) {
      return number;
    }
  } else if (number.startsWith('2637')) {
    // International format without + (e.g., 263771234567)
    if (number.length === 12) {
      return '0' + number.substring(3);
    }
  } else if (number.startsWith('+2637')) {
    // International format with + (e.g., +263771234567)
    if (number.length === 13) {
      return '0' + number.substring(4);
    }
  } else if (number.startsWith('7')) {
    // Without prefix (e.g., 771234567)
    if (number.length === 9) {
      return '0' + number;
    }
  }

  // Return original if no formatting applied
  return number;
}

// Handle EcoCash payment submission with improved error handling
function handleEcocashSubmitWithRetry() {
  var selectedVoucherId = selectPackage.value;
  var ecocashNumberInput = document.getElementById("ecocash-number");

  var ecocashNumber = ecocashNumberInput.value.trim();

  // Validate inputs
  if (!selectedVoucherId) {
    showHint("modal-hint", "Please select a package.", "error");
    return;
  }
  if (!ecocashNumber) {
    showHint("modal-hint", "Please enter your EcoCash number.", "error");
    ecocashNumberInput.focus();
    return;
  }
  if (!ecocashNumberInput.checkValidity()) {
    showHint("modal-hint", "Please enter a valid EcoCash number (e.g., 077xxxxxxx or 078xxxxxxx).", "error");
    ecocashNumberInput.focus();
    return;
  }

  // Format EcoCash number to ensure it works with the API
  ecocashNumber = formatEcocashNumber(ecocashNumber);

  var buyData = {
    selected_voucher_id: selectedVoucherId,
    ecocash_phone: ecocashNumber,
  };

  btnSubmitEcocash.textContent = "Processing...";
  btnSubmitEcocash.disabled = true;
  showHint("modal-hint", "Initiating payment... Please wait.", "info");

  // Set up retry mechanism
  var retryCount = 0;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 3000; // 3 seconds

  function attemptPaymentRequest() {
    // Use the improved fetch with fallback function
    improvedFetchWithFallback(
      `${API_BASE_URL}/buy`,
      {
        method: 'POST',
        body: buyData
      },
      function (response) {
        showHint("modal-hint", response.message + " Please check your phone to authorize.", "info");
        if (response.transaction_id && response.check_status_url) {
          pollTransactionStatus(response.transaction_id, response.check_status_url);
        } else {
          showHint("modal-hint", "Payment initiated, but could not get transaction ID for status check.", "error");
          btnSubmitEcocash.textContent = "Pay Now";
          btnSubmitEcocash.disabled = false;
        }
      },
      function (errorResponse, status) {
        console.error("Error buying voucher:", status, errorResponse);
        let errMsg = "Failed to initiate purchase.";
        if (errorResponse && errorResponse.message) {
          errMsg = errorResponse.message;
        } else if (errorResponse && errorResponse.errors) {
          const firstErrorKey = Object.keys(errorResponse.errors)[0];
          errMsg = errorResponse.errors[firstErrorKey][0];
        }

        if (retryCount < MAX_RETRIES) {
          retryCount++;
          showHint("modal-hint", `${errMsg} Retrying... (Attempt ${retryCount}/${MAX_RETRIES})`, "info");
          setTimeout(attemptPaymentRequest, RETRY_DELAY);
        } else {
          showHint("modal-hint", `${errMsg} Maximum retries reached. Please try again later.`, "error");
          btnSubmitEcocash.textContent = "Pay Now";
          btnSubmitEcocash.disabled = false;
        }
      }
    );
  }

  // Start the payment request process
  attemptPaymentRequest();
}

// Polling for transaction status with improved handling
let pollingInterval;
let pollAttempts = 0;
const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 6000;

function pollTransactionStatus(transactionId, statusUrl) {
  if (pollingInterval) clearInterval(pollingInterval);
  pollAttempts = 0;
  let successfulPollsCount = 0;

  showHint("modal-hint", "Waiting for payment confirmation... Do not close this window.", "info");

  // Storage mechanism for offline recovery
  try {
    localStorage.setItem('pendingTransactionId', transactionId);
    localStorage.setItem('pendingStatusUrl', statusUrl);
    localStorage.setItem('pendingTimestamp', Date.now().toString());
  } catch (e) {
    console.warn("Could not save transaction details to localStorage:", e);
  }

  pollingInterval = setInterval(function () {
    pollAttempts++;

    // Show a more user-friendly progress indicator
    const dotsCount = (pollAttempts % 4);
    const dots = '.'.repeat(dotsCount);
    const progressPercent = Math.min(Math.round((pollAttempts / MAX_POLL_ATTEMPTS) * 100), 100);

    showHint("modal-hint", `Checking payment status${dots} (${progressPercent}%)`, "info");

    if (pollAttempts > MAX_POLL_ATTEMPTS) {
      clearInterval(pollingInterval);
      showHint("modal-hint", "Payment check timed out. Your payment might still be processing. Please check your EcoCash messages or contact support if debited.", "error");
      btnSubmitEcocash.textContent = "Pay Now";
      btnSubmitEcocash.disabled = false;
      return;
    }

    // Add cache busting to status URL
    const cacheBustUrl = statusUrl + (statusUrl.includes('?') ? '&' : '?') + 't=' + new Date().getTime();

    // Use improved fetch with fallback
    improvedFetchWithFallback(
      cacheBustUrl,
      { method: 'GET' },
      function (response) {
        // Clear stored transaction if we get any response
        try {
          if (localStorage.getItem('pendingTransactionId') === transactionId) {
            localStorage.removeItem('pendingTransactionId');
            localStorage.removeItem('pendingStatusUrl');
            localStorage.removeItem('pendingTimestamp');
          }
        } catch (e) {
          console.warn("Could not clear transaction from localStorage:", e);
        }

        if (response.status === "completed") {
          successfulPollsCount++;

          // Wait for two consecutive successful "completed" statuses to avoid race conditions
          if (successfulPollsCount >= 2) {
            clearInterval(pollingInterval);
            showHint("modal-hint", "Purchase Successful! Voucher details sent via SMS.", "success");

            let receivedVoucherCode = "";
            // Path adjustments based on your API response for completed transaction
            if (response.vouchers_details && response.vouchers_details.pin) {
              receivedVoucherCode = response.vouchers_details.pin;
            } else if (response.receipt && response.receipt.vouchers &&
              Array.isArray(response.receipt.vouchers) &&
              response.receipt.vouchers.length > 0 &&
              response.receipt.vouchers[0].pin) {
              receivedVoucherCode = response.receipt.vouchers[0].pin;
            } else {
              console.warn("Could not find PIN in voucher_details or receipt. API Response:", response);
              showHint("modal-hint", "Purchase successful! Voucher sent. Check SMS for PIN.", "success");
            }

            // Sanitize the received voucher code by removing spaces
            if (receivedVoucherCode) {
              receivedVoucherCode = sanitizeVoucherCode(receivedVoucherCode);
              document.getElementById("voucherCode").value = receivedVoucherCode;
              copyToClipboard(receivedVoucherCode);
            }

            setTimeout(function () {
              modal.classList.remove("active");
              resetModal();
              if (receivedVoucherCode) {
                showHint("oper-hint", "Voucher purchased! Connecting with new voucher...", "success");
                handlePortalSubmit();
              } else {
                showHint("oper-hint", "Voucher purchased! Please check SMS for your voucher code and enter it manually.", "success");
              }
            }, 3000);
          } else {
            // Wait for another poll to confirm
            showHint("modal-hint", "Received completion status. Confirming...", "info");
          }
        } else if (response.status === "failed") {
          clearInterval(pollingInterval);
          let failMsg = "Payment Failed.";
          if (response.error_details) failMsg += ` Reason: ${response.error_details}`;
          else if (response.payment_details && response.payment_details.failure_reason)
            failMsg += ` Reason: ${response.payment_details.failure_reason}`;

          showHint("modal-hint", failMsg, "error");
          btnSubmitEcocash.textContent = "Pay Now";
          btnSubmitEcocash.disabled = false;
        } else {
          // Reset the success counter for non-completed statuses
          successfulPollsCount = 0;
          showHint("modal-hint", `Payment ${response.status}. Waiting for confirmation... Attempt ${pollAttempts}/${MAX_POLL_ATTEMPTS}`, "info");
        }
      },
      function (errorResponse, status) {
        console.error("Error polling status:", status, errorResponse);
        // Decrease polling frequency when errors occur
        if (pollAttempts > 5) {
          clearInterval(pollingInterval);
          // Set up a longer interval
          pollingInterval = setInterval(arguments.callee, POLL_INTERVAL_MS * 2);
        }

        if (status === 404 && pollAttempts > 5) {
          clearInterval(pollingInterval);
          showHint("modal-hint", "Transaction check failed (not found). Please contact support.", "error");
          btnSubmitEcocash.textContent = "Pay Now";
          btnSubmitEcocash.disabled = false;
        } else if (status !== 404) {
          showHint("modal-hint", `Error checking status: ${(errorResponse && errorResponse.message) || 'Retrying...'}. Attempt ${pollAttempts}/${MAX_POLL_ATTEMPTS}`, "error");
        }
      }
    );
  }, POLL_INTERVAL_MS);
}

// Function to check for and recover interrupted transactions
function checkForInterruptedTransactions() {
  try {
    const pendingTransactionId = localStorage.getItem('pendingTransactionId');
    const pendingStatusUrl = localStorage.getItem('pendingStatusUrl');
    const pendingTimestamp = localStorage.getItem('pendingTimestamp');

    if (pendingTransactionId && pendingStatusUrl && pendingTimestamp) {
      // Check if the transaction is not too old (less than 24 hours)
      const now = Date.now();
      const timestamp = parseInt(pendingTimestamp, 10);
      const ageInHours = (now - timestamp) / (1000 * 60 * 60);

      if (ageInHours < 24) {
        // Ask user if they want to check status
        if (confirm("We detected an unfinished payment from earlier. Would you like to check its status?")) {
          modal.classList.add("active");
          showHint("modal-hint", "Checking status of previous payment...", "info");
          btnSubmitEcocash.textContent = "Processing...";
          btnSubmitEcocash.disabled = true;

          // Start polling with the saved information
          pollTransactionStatus(pendingTransactionId, pendingStatusUrl);
        } else {
          // User declined, clear the stored transaction
          localStorage.removeItem('pendingTransactionId');
          localStorage.removeItem('pendingStatusUrl');
          localStorage.removeItem('pendingTimestamp');
        }
      } else {
        // Transaction is too old, clear it
        localStorage.removeItem('pendingTransactionId');
        localStorage.removeItem('pendingStatusUrl');
        localStorage.removeItem('pendingTimestamp');
      }
    }
  } catch (e) {
    console.warn("Error checking for interrupted transactions:", e);
  }
}

// Initialize the page
document.addEventListener("DOMContentLoaded", function () {
  // Event listener for portal connect button
  document
    .getElementById("button-login")
    .addEventListener("click", handlePortalSubmit);

  // Event listener for input field to sanitize voucher codes on blur
  document
    .getElementById("voucherCode")
    .addEventListener("blur", function () {
      // Automatically remove spaces when user leaves the field
      this.value = sanitizeVoucherCode(this.value);
    });

  // Initial connectivity check
  checkConnectivityAndRecover().then(isConnected => {
    // Fetch and display voucher packages
    fetchPackagesWithFallback();
  });

  // Set up periodic connectivity checks
  setInterval(checkConnectivityAndRecover, 60000); // Check every minute

  // Also check when the page becomes visible again
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      checkConnectivityAndRecover().then(isConnected => {
        if (isConnected && availableVoucherPackages.length === 0) {
          // Refresh voucher packages if we don't have any
          fetchPackagesWithFallback();
        }
      });
    }
  });

  // Check for interrupted transactions from previous sessions
  checkForInterruptedTransactions();

  // Modal related event listeners
  btnEcocash.addEventListener("click", function () {
    modal.classList.add("active");
    populateVoucherPackagesForModal(); // Now uses the globally stored `availableVoucherPackages`
  });

  closeModalBtn.addEventListener("click", function () {
    modal.classList.remove("active");
    resetModal();
  });

  window.addEventListener("click", function (event) {
    // Either remove this event listener completely, or make it do nothing
    // This ensures users must use the close button explicitly
    if (event.target === modal) {
      // Optional: show a hint that they should use the close button
      showHint("modal-hint", "Please use the close button to exit", "info");
      // The hint will disappear after a second
      setTimeout(() => {
        if (document.getElementById("modal-hint").textContent === "Please use the close button to exit") {
          showHint("modal-hint", "", "info");
        }
      }, 1000);
    }
  });

  btnSubmitEcocash.addEventListener("click", handleEcocashSubmitWithRetry);

  // Online/offline event listeners
  window.addEventListener("online", function () {
    showHint("oper-hint", "You are back online. Reconnecting to services...", "info");
    checkConnectivityAndRecover().then(isConnected => {
      if (isConnected) {
        // Refresh voucher packages
        fetchPackagesWithFallback();
      }
    });
  });

  window.addEventListener("offline", function () {
    showHint("oper-hint", "You are currently offline. Some features may not work.", "warning");
  });

  // Original /portal/getPortalPageSetting call for Omada controller
  var xhrPortalSettings = new XMLHttpRequest();
  xhrPortalSettings.open("POST", "/portal/getPortalPageSetting", true);
  xhrPortalSettings.setRequestHeader("Content-Type", "application/json");
  xhrPortalSettings.timeout = 10000; // 10 seconds timeout

  xhrPortalSettings.onreadystatechange = function () {
    if (xhrPortalSettings.readyState == 4) {
      try {
        var response = JSON.parse(xhrPortalSettings.responseText);
        if (xhrPortalSettings.status == 200 || xhrPortalSettings.status == 304) { // Success
          portalData = response.result;
          if (response.errorCode !== 0) {
            showHint("oper-hint", portalErrorHintMap[response.errorCode] || "Error initializing portal", "error");
          }
        } else { // HTTP error
          showHint("oper-hint", (response && response.message) || "Could not load portal settings.", "error");
        }
      } catch (e) { // JSON parsing error or other script error
        showHint("oper-hint", "Error processing portal settings response.", "error");
      }
    }
  };

  xhrPortalSettings.ontimeout = function () {
    console.warn("Portal settings request timed out");
    showHint("oper-hint", "Connection to WiFi portal timed out. Try refreshing the page.", "warning");
  };

  xhrPortalSettings.onerror = function () {
    console.error("Error loading portal settings");
    showHint("oper-hint", "Error connecting to the WiFi portal. Try refreshing the page.", "error");
  };

  xhrPortalSettings.send(JSON.stringify({ // Data for the portal settings request
    clientMac: clientMac,
    apMac: apMac,
    gatewayMac: gatewayMac,
    ssidName: ssidName,
    radioId: radioId,
    vid: vid,
    originUrl: originUrl,
  }));
});