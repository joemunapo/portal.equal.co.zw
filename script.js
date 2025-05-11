// Configuration
const API_BASE_URL = (function () {
  // Get the current protocol (http: or https:)
  const protocol = window.location.protocol;

  // Base URL with the appropriate protocol
  let baseUrl = "https://bot.xash.co.zw/api/v1/wifi-vouchers";

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

// Helper function to sanitize voucher codes by removing all spaces
function sanitizeVoucherCode(code) {
  if (!code) return '';
  // Remove all spaces (including non-breaking spaces and other whitespace)
  return code.replace(/\s+/g, '');
}


// Ajax utility with improved error handling and timeouts
var Ajax = {
  _request: function (method, url, data, successCallback, errorCallback) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "application/json");

    // Add timeout handling
    xhr.timeout = 15000; // 15 seconds timeout
    xhr.ontimeout = function () {
      console.error("Request timed out:", url);
      errorCallback.call(this, { message: "Request timed out. Please check your connection and try again." }, 408);
    };

    xhr.onreadystatechange = function () {
      if (xhr.readyState == 4) {
        try {
          // Only try to parse JSON if there's a response
          if (xhr.responseText && xhr.responseText.trim()) {
            var responseData = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              successCallback.call(this, responseData, xhr.status);
            } else {
              errorCallback.call(this, responseData, xhr.status);
            }
          } else {
            // Handle empty responses
            if (xhr.status >= 200 && xhr.status < 300) {
              successCallback.call(this, {}, xhr.status);
            } else {
              errorCallback.call(this, { message: "Empty response from server." }, xhr.status);
            }
          }
        } catch (e) {
          console.error("JSON parse error:", e, "Response was:", xhr.responseText);
          errorCallback.call(this, {
            message: "Invalid response from server or network error.",
            errorDetails: xhr.responseText,
            parseError: e.message
          }, xhr.status || 500);
        }
      }
    };

    xhr.onerror = function () {
      console.error("Network error on:", url);
      errorCallback.call(this, { message: "Network error. Please check your connection." }, 0);
    };

    // Add cache busting for GET requests
    if (method === "GET") {
      // Add timestamp to URL to prevent caching
      var separator = url.indexOf('?') > -1 ? '&' : '?';
      url = url + separator + 't=' + new Date().getTime();
      xhr.send(null);
    } else {
      xhr.send(JSON.stringify(data));
    }
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

  var xhrPortal = new XMLHttpRequest();
  xhrPortal.open("POST", portalSubmitUrl, true);
  xhrPortal.setRequestHeader("Content-Type", "application/json");
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
        showHint("oper-hint", "Error processing portal response.", "error");
      }
    }
  };
  xhrPortal.send(JSON.stringify(submitData));
}

// Fetch packages with fallback mechanism for Android compatibility
function fetchPackagesWithFallback() {
  // Try to fetch packages with standard Ajax first
  console.log("Attempting to fetch packages with primary method...");

  const displayTbody = document.getElementById("voucher-display-tbody");
  const displayTfoot = document.getElementById("voucher-display-tfoot");

  if (!displayTbody || !displayTfoot) {
    console.error("Voucher display table body or foot not found!");
    return;
  }

  displayTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading packages...</td></tr>';
  displayTfoot.style.display = 'none';
  selectPackage.innerHTML = '<option value="" disabled selected>Loading packages...</option>';
  selectPackage.disabled = true;

  try {
    // Add a timestamp to prevent caching
    const url = `${API_BASE_URL}/available?t=${new Date().getTime()}`;

    // Try using fetch API as a fallback (works better on some Android devices)
    fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      cache: 'no-store' // Explicitly prevent caching
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status}`);
        }
        return response.json();
      })
      .then(response => {
        console.log("Fetch API success:", response);

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
        } else {
          displayTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No voucher packages currently available.</td></tr>';
          selectPackage.innerHTML = '<option value="" disabled selected>No packages available</option>';
          selectPackage.disabled = true;
        }
      })
      .catch(error => {
        console.error("Fetch API error:", error);
        const errorMessage = error.message || 'Please try again.';
        displayTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Error loading packages: ${errorMessage}</td></tr>`;
        selectPackage.innerHTML = '<option value="" disabled selected>Error loading packages</option>';
        selectPackage.disabled = true;
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
      });
  } catch (e) {
    console.error("Critical error in fetch fallback:", e);
    displayTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Error loading packages. Please reload the page.</td></tr>`;
  }
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

// Handle EcoCash payment submission
function handleEcocashSubmit() {
  var selectedVoucherId = selectPackage.value;
  var ecocashNumberInput = document.getElementById("ecocash-number");
  var notificationNumberInput = document.getElementById("notification-number");

  var ecocashNumber = ecocashNumberInput.value.trim();
  var notificationNumber = notificationNumberInput.value.trim();

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
  if (notificationNumber && !notificationNumberInput.checkValidity()) {
    showHint("modal-hint", "Please enter a valid notification number or leave it blank.", "error");
    notificationNumberInput.focus();
    return;
  }

  var finalNotificationNumber = notificationNumber ? notificationNumber : ecocashNumber;

  var buyData = {
    selected_voucher_id: selectedVoucherId,
    ecocash_phone: ecocashNumber,
    notification_phone: finalNotificationNumber,
  };

  btnSubmitEcocash.textContent = "Processing...";
  btnSubmitEcocash.disabled = true;
  showHint("modal-hint", "Initiating payment... Please wait.", "info");

  Ajax.post(`${API_BASE_URL}/buy`, buyData,
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
      showHint("modal-hint", errMsg, "error");
      btnSubmitEcocash.textContent = "Pay Now";
      btnSubmitEcocash.disabled = false;
    }
  );
}

// Polling for transaction status
let pollingInterval;
let pollAttempts = 0;
const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 6000;

function pollTransactionStatus(transactionId, statusUrl) {
  if (pollingInterval) clearInterval(pollingInterval);
  pollAttempts = 0;

  showHint("modal-hint", "Waiting for payment confirmation... Do not close this window.", "info");

  pollingInterval = setInterval(function () {
    pollAttempts++;
    if (pollAttempts > MAX_POLL_ATTEMPTS) {
      clearInterval(pollingInterval);
      showHint("modal-hint", "Payment check timed out. Please try again or contact support if debited.", "error");
      btnSubmitEcocash.textContent = "Pay Now";
      btnSubmitEcocash.disabled = false;
      return;
    }

    // Add cache busting to status URL
    const cacheBustUrl = statusUrl + (statusUrl.includes('?') ? '&' : '?') + 't=' + new Date().getTime();

    Ajax.get(cacheBustUrl,
      function (response) {
        showHint("modal-hint", `Status: ${response.status}. Checking...`, "info");
        if (response.status === "completed") {
          clearInterval(pollingInterval);
          showHint("modal-hint", "Purchase Successful! Voucher details sent via SMS.", "success");

          let receivedVoucherCode = "";
          // Path adjustments based on your API response for completed transaction
          if (response.vouchers_details && response.vouchers_details.pin) {
            receivedVoucherCode = response.vouchers_details.pin;
          } else if (response.receipt && response.receipt.vouchers && Array.isArray(response.receipt.vouchers) && response.receipt.vouchers.length > 0 && response.receipt.vouchers[0].pin) {
            receivedVoucherCode = response.receipt.vouchers[0].pin;
          } else {
            console.warn("Could not find PIN in voucher_details or receipt. API Response:", response);
            showHint("modal-hint", "Purchase successful! Voucher sent. Check SMS for PIN.", "success");
          }

          // Sanitize the received voucher code by removing spaces
          if (receivedVoucherCode) {
            receivedVoucherCode = sanitizeVoucherCode(receivedVoucherCode);
            document.getElementById("voucherCode").value = receivedVoucherCode;
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

        } else if (response.status === "failed") {
          clearInterval(pollingInterval);
          let failMsg = "Payment Failed.";
          if (response.error_details) failMsg += ` Reason: ${response.error_details}`;
          else if (response.payment_details && response.payment_details.failure_reason) failMsg += ` Reason: ${response.payment_details.failure_reason}`;
          showHint("modal-hint", failMsg, "error");
          btnSubmitEcocash.textContent = "Pay Now";
          btnSubmitEcocash.disabled = false;
        } else {
          showHint("modal-hint", `Payment ${response.status}. Waiting for confirmation... Attempt ${pollAttempts}/${MAX_POLL_ATTEMPTS}`, "info");
        }
      },
      function (errorResponse, status) {
        console.error("Error polling status:", status, errorResponse);
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

  // Fetch and display voucher packages with fallback for Android compatibility
  fetchPackagesWithFallback();

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
    if (event.target === modal) {
      modal.classList.remove("active");
      resetModal();
    }
  });
  btnSubmitEcocash.addEventListener("click", handleEcocashSubmit);

  // Original /portal/getPortalPageSetting call
  var xhrPortalSettings = new XMLHttpRequest();
  xhrPortalSettings.open("POST", "/portal/getPortalPageSetting", true);
  xhrPortalSettings.setRequestHeader("Content-Type", "application/json");
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