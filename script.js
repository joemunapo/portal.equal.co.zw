
// Configuration
const API_BASE_URL = (function () {
  // Get the current protocol (http: or https:)
  const protocol = window.location.protocol;

  // Base URL with the appropriate protocol
  let baseUrl = "https://ecocash.eql.co.zw/api/v1/wifi-vouchers";

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

// Parse a JSON response body without throwing (empty or non-JSON bodies give {})
function parseJsonSafely(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

// Plain XMLHttpRequest, used only where fetch is unavailable (or as a GET fallback)
function xhrRequest(url, options, successCallback, errorCallback) {
  const xhr = new XMLHttpRequest();
  xhr.open(options.method || 'GET', url, true);

  // Set headers
  if (options.headers) {
    Object.keys(options.headers).forEach(key => {
      xhr.setRequestHeader(key, options.headers[key]);
    });
  } else {
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "application/json");
  }

  // Add timeout handling (status 0: no answer, the outcome is unknown)
  xhr.timeout = options.timeout || 15000;
  xhr.ontimeout = function () {
    errorCallback({ message: "Request timed out. Please check your connection and try again.", timedOut: true }, 0);
  };

  xhr.onreadystatechange = function () {
    // status 0 is a network error or timeout, reported by onerror / ontimeout
    if (xhr.readyState === 4 && xhr.status !== 0) {
      const responseData = parseJsonSafely(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        successCallback(responseData, xhr.status);
      } else {
        errorCallback(responseData, xhr.status);
      }
    }
  };

  xhr.onerror = function () {
    errorCallback({ message: "Network error. Please check your connection." }, 0);
  };

  // Send the request
  if (options.method && options.method !== 'GET' && options.body) {
    xhr.send(JSON.stringify(options.body));
  } else {
    xhr.send();
  }
}

// Fetch with an XMLHttpRequest fallback.
// successCallback(data, status) gets 2xx answers; errorCallback(data, status) gets everything
// else, with status 0 when no answer arrived (network error or timeout).
// Only GET requests are ever sent a second time (via XHR after a failed fetch). Any other
// method is sent exactly once: a POST that may have reached the server is never re-sent.
function improvedFetchWithFallback(url, options, successCallback, errorCallback) {
  const method = options.method || 'GET';
  const timeoutMs = options.timeout || 15000;
  // Add cache-busting parameter more reliably
  const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + '_cb=' + new Date().getTime();

  if (typeof window.fetch !== 'function') {
    console.warn("Fetch not supported, using XMLHttpRequest directly");
    xhrRequest(cacheBustUrl, options, successCallback, errorCallback);
    return;
  }

  // Each request reports exactly once, even if a late answer arrives after the timeout
  let settled = false;
  function settle(callback, data, status) {
    if (settled) return;
    settled = true;
    callback(data, status);
  }

  function noAnswer(error) {
    if (method === 'GET') {
      console.warn("Fetch failed, falling back to XMLHttpRequest:", error);
      settled = true;
      xhrRequest(cacheBustUrl, options, successCallback, errorCallback);
    } else {
      console.warn("Request got no answer (not re-sent):", error);
      settle(errorCallback, {
        message: "Network error. Please check your connection.",
        timedOut: !!(error && error.message === 'Request timeout'),
      }, 0);
    }
  }

  // Set a timeout for fetch (since fetch doesn't support timeout natively)
  const timeoutId = setTimeout(() => {
    if (!settled) noAnswer(new Error('Request timeout'));
  }, timeoutMs);

  let request;
  try {
    request = fetch(cacheBustUrl, {
      method: method,
      headers: options.headers || {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store'
    });
  } catch (e) {
    // fetch threw before sending anything
    clearTimeout(timeoutId);
    console.warn("Fetch threw, using XMLHttpRequest directly:", e);
    settled = true;
    xhrRequest(cacheBustUrl, options, successCallback, errorCallback);
    return;
  }

  request
    .then(response => {
      return response.text().then(text => {
        clearTimeout(timeoutId);
        const data = parseJsonSafely(text);
        if (response.ok) {
          settle(successCallback, data, response.status);
        } else {
          settle(errorCallback, data, response.status);
        }
      });
    })
    .catch(error => {
      clearTimeout(timeoutId);
      if (!settled) noAnswer(error);
    });
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

var WIFI_ADS_ENDPOINT = API_BASE_URL.replace("/wifi-vouchers", "/wifi-ads");
var WIFI_ADS_TTL_DAYS = 3;
var WIFI_ADS_DISMISS_KEY = "wifi_ad_dismissed_until";

function getAdContextParams() {
  var params = new URLSearchParams();
  if (clientMac) params.set("clientMac", clientMac);
  if (apMac) params.set("apMac", apMac);
  if (gatewayMac) params.set("gatewayMac", gatewayMac);
  if (ssidName) params.set("ssid", ssidName);
  if (radioId !== undefined) params.set("radioId", String(radioId));
  if (vid !== undefined) params.set("vid", String(vid));
  return params.toString();
}

function isAdDismissed() {
  try {
    var until = localStorage.getItem(WIFI_ADS_DISMISS_KEY);
    if (!until) return false;
    return Date.now() < Number(until);
  } catch (e) {
    return false;
  }
}

function dismissAdForTtl() {
  try {
    var ttlMs = WIFI_ADS_TTL_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(WIFI_ADS_DISMISS_KEY, String(Date.now() + ttlMs));
  } catch (e) {
    // Ignore storage errors
  }
}

function showAdOverlay(adData) {
  var overlay = document.getElementById("ad-overlay");
  var iframe = document.getElementById("ad-iframe");
  var image = document.getElementById("ad-image");
  var message = document.getElementById("ad-message");
  var closeBtn = document.getElementById("ad-close");
  var continueBtn = document.getElementById("ad-continue");
  if (!overlay || !iframe || !image || !message || !closeBtn || !continueBtn) return;

  overlay.classList.add("active");
  overlay.setAttribute("aria-hidden", "false");
  var normalizedHtml = normalizeAdHtml(adData.html);
  if (normalizedHtml) {
    iframe.style.display = "block";
    image.style.display = "none";
    iframe.src = "about:blank";
    iframe.srcdoc =
      "<!doctype html><html><head><meta charset=\"utf-8\"></head>" +
      "<body style=\"margin:0;\">" +
      normalizedHtml +
      "</body></html>";
  } else if (adData.imageBase64 || adData.image) {
    iframe.style.display = "none";
    iframe.src = "about:blank";
    iframe.srcdoc = "";
    image.style.display = "block";
    var base64 = adData.imageBase64 || adData.image;
    if (base64 && base64.startsWith("data:")) {
      image.src = base64;
    } else {
      var mime = adData.imageMime || "image/jpeg";
      image.src = "data:" + mime + ";base64," + base64;
    }
  }
  if (adData.message) message.textContent = adData.message;
  if (adData.cta) continueBtn.textContent = adData.cta;

  function closeAd() {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    iframe.src = "about:blank";
    iframe.srcdoc = "";
    image.src = "";
    dismissAdForTtl();
    logAdEvent(adData.id, "close");
  }

  closeBtn.onclick = closeAd;
  continueBtn.onclick = closeAd;
}

function logAdEvent(adId, eventName) {
  if (!adId) return;
  var url = WIFI_ADS_ENDPOINT + "/log";
  var payload = {
    adId: adId,
    event: eventName,
    clientMac: clientMac,
    apMac: apMac,
    gatewayMac: gatewayMac,
    ssidName: ssidName,
    radioId: radioId,
    vid: vid,
  };

  try {
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
  } catch (e) {
    // Ignore and fall back to fetch
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(function () {});
}

function fetchWifiAd() {
  if (isAdDismissed()) return;

  var overlay = document.getElementById("ad-overlay");
  if (!overlay) return;

  var params = getAdContextParams();
  var url = WIFI_ADS_ENDPOINT + "/active" + (params ? "?" + params : "");

  improvedFetchWithFallback(
    url,
    { method: "GET" },
    function (response) {
      var adData = normalizeAdResponse(response);
      if (!adData) return;
      if (!normalizeAdHtml(adData.html) && !adData.imageBase64 && !adData.image) return;
      if (adData.ttlSeconds && !isNaN(adData.ttlSeconds)) {
        WIFI_ADS_TTL_DAYS = Math.max(1, Math.round(adData.ttlSeconds / 86400));
      }
      showAdOverlay(adData);
      logAdEvent(adData.id, "impression");
    },
    function () {}
  );
}

function normalizeAdResponse(response) {
  if (!response) return null;
  var data = response.data || response.result || response.ad || response;
  if (Array.isArray(data)) {
    data = data[0];
  }
  if (!data) return null;
  if (data.enabled === false) return null;
  if (data.enabled === undefined) data.enabled = true;
  return data;
}

function normalizeAdHtml(html) {
  if (!html) return "";
  return html
    .replace(/<\?xml[^>]*\?>/gi, "")
    .replace(/<!doctype[^>]*>/gi, "")
    .trim();
}

// Function to check if we are online and can reach the API
function checkConnectivityAndRecover() {
  let isOnline = navigator.onLine;

  // Display network status
  if (!isOnline) {
    showHint("oper-hint", "You appear to be offline. Please check your connection.", "error");
    // return false;
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
        highlightPopularPackageRow();
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

function highlightPopularPackageRow() {
  const displayTbody = document.getElementById("voucher-display-tbody");
  if (!displayTbody) return;

  const rows = Array.from(displayTbody.querySelectorAll("tr"));
  rows.forEach(row => {
    row.classList.remove("package-highlight");
    row.classList.remove("package-popular");
    const tag = row.querySelector(".popular-tag");
    if (tag) tag.remove();
    const bestTag = row.querySelector(".best-tag");
    if (bestTag) bestTag.remove();
  });

  for (const row of rows) {
    const dataCell = row.children[0];
    const durationCell = row.children[1];
    if (!dataCell || !durationCell) continue;
    const dataText = dataCell.textContent.toLowerCase();
    const durationText = durationCell.textContent.toLowerCase();
    if (dataText.includes("unlimited") && durationText.includes("7")) {
      row.classList.add("package-highlight");
      const tag = document.createElement("span");
      tag.className = "best-tag";
      tag.textContent = "Best Value";
      dataCell.appendChild(tag);
      break;
    }
  }

  for (const row of rows) {
    const dataCell = row.children[0];
    const priceCell = row.children[2];
    if (!dataCell || !priceCell) continue;
    const match = priceCell.textContent.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (!match) continue;
    const price = parseFloat(match[1]);
    if (Math.abs(price - 2) < 0.001) {
      row.classList.add("package-popular");
      const tag = document.createElement("span");
      tag.className = "popular-tag";
      tag.textContent = "Popular";
      dataCell.appendChild(tag);
      break;
    }
  }
}

// Modal functionality
var modal = document.getElementById("ecocash-modal");
var btnEcocash = document.getElementById("button-ecocash");
var closeModalBtn = document.getElementById("close-modal");
var btnSubmitEcocash = document.getElementById("submit-ecocash");
var selectPackage = document.getElementById("voucher-package");
var ecocashForm = document.getElementById("ecocash-form");
var btnCheckAgain = document.getElementById("check-again");

function resetModal() {
  ecocashForm.reset();
  showHint("modal-hint", "", "info");
  stopPolling();
  showCheckAgain(false);
  // A /buy request still on its way keeps the button locked until it answers
  if (paymentRequestInFlight) {
    setPayButton("Processing...", false);
  } else {
    setPayButton("Pay Now", true);
  }
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

// Payment flow state
// One /buy request per user action: nothing here re-sends it automatically. The backend keeps one
// open EcoCash prompt per phone, so a manual "Try again" from this device returns the waiting purchase.
let paymentRequestInFlight = false;
let pollTimer = null;
let pollingActive = false;
let pollRun = 0; // bumped on every start/stop so answers from an earlier run are ignored
let pollStartedAt = 0;
let completedPolls = 0;
let currentPurchaseId = null;
let currentStatusUrl = null;
let lastServerMessage = "";

const BUY_TIMEOUT_MS = 75000; // the server waits up to ~60 s for EcoCash to accept the request
const POLL_FAST_MS = 3000; // every 3 s ...
const POLL_FAST_FOR_MS = 2 * 60 * 1000; // ... for the first 2 minutes
const POLL_SLOW_MS = 10000; // then every 10 s ...
const POLL_MAX_WAIT_MS = 15 * 60 * 1000; // ... for up to 15 minutes

const MSG_START_UNCONFIRMED = "We couldn't confirm your payment started. If a prompt appears on your phone, approve it.";
const MSG_START_FAILED = "We couldn't start your payment right now. If a prompt appears on your phone, approve it; otherwise please try again in a moment.";
const MSG_WAITING = "Waiting for payment confirmation... Do not close this window.";
const MSG_STILL_CHECKING = "Still checking. If you approved the payment, your voucher will also be sent by SMS.";
const MSG_STOPPED_CHECKING = "We haven't had a final answer yet. If you approved the payment, your voucher will be sent by SMS. Tap \"Check again\" to look again.";
const MSG_PURCHASE_NOT_FOUND = "We couldn't find this purchase. If you approved a payment, your voucher will be sent by SMS.";

function setPayButton(label, enabled) {
  btnSubmitEcocash.textContent = label;
  btnSubmitEcocash.disabled = !enabled;
}

function showCheckAgain(show) {
  if (btnCheckAgain) btnCheckAgain.style.display = show ? "" : "none";
}

// First readable message in an error body (server message, or the first validation error)
function serverErrorMessage(errorResponse, fallback) {
  if (errorResponse && errorResponse.message) return errorResponse.message;
  if (errorResponse && errorResponse.errors) {
    const firstErrorKey = Object.keys(errorResponse.errors)[0];
    const firstError = firstErrorKey && errorResponse.errors[firstErrorKey];
    if (Array.isArray(firstError) && firstError[0]) return firstError[0];
    if (typeof firstError === 'string') return firstError;
  }
  return fallback;
}

// Handle EcoCash payment submission: sends exactly one /buy request per tap
function handleEcocashSubmit() {
  if (paymentRequestInFlight) {
    showHint("modal-hint", "Your payment request is still being sent. Please wait.", "info");
    return;
  }
  if (pollingActive) return;

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

  // Normalize and validate EcoCash number before submit
  ecocashNumber = formatEcocashNumber(ecocashNumber);
  ecocashNumberInput.value = ecocashNumber;
  if (!ecocashNumberInput.checkValidity()) {
    showHint("modal-hint", "Enter a valid EcoCash number starting with 077, 078 or 079.", "error");
    ecocashNumberInput.focus();
    return;
  }

  var buyData = {
    selected_voucher_id: selectedVoucherId,
    ecocash_phone: ecocashNumber,
    client_mac: clientMac,
  };

  paymentRequestInFlight = true;
  showCheckAgain(false);
  setPayButton("Processing...", false);
  showHint("modal-hint", "Sending the payment request to EcoCash... Please wait.", "info");

  improvedFetchWithFallback(
    `${API_BASE_URL}/buy`,
    {
      method: 'POST',
      body: buyData,
      timeout: BUY_TIMEOUT_MS
    },
    function (response, status) {
      paymentRequestInFlight = false;
      // 201: new purchase. 202: the start's outcome is not known yet, or this device already
      // has a prompt waiting. Either way there is a purchase to follow: poll it.
      if (response && response.check_status_url) {
        startPolling(
          response.reference || response.transaction_id,
          response.check_status_url,
          response.message || "EcoCash payment initiated. Please authorize on your phone."
        );
      } else {
        console.warn("Buy answered " + status + " without a status URL:", response);
        showHint("modal-hint", MSG_START_UNCONFIRMED, "info");
        setPayButton("Try again", true);
      }
    },
    function (errorResponse, status) {
      paymentRequestInFlight = false;
      console.error("Error buying voucher:", status, errorResponse);
      handleBuyError(errorResponse || {}, status);
    }
  );
}

// Show why /buy did not start a purchase. Never re-sends the request.
function handleBuyError(errorResponse, status) {
  if (status === 409) {
    // Another prompt is already waiting for this number: approve or decline it first
    showHint("modal-hint", serverErrorMessage(errorResponse, "A payment prompt for this number is already waiting. Approve it on your phone, or try again in a few minutes."), "info");
    setPayButton("Pay Now", true);
  } else if (status === 422 || status === 400) {
    // Definite refusal (low balance, bad number, invalid input): fix and try again
    showHint("modal-hint", serverErrorMessage(errorResponse, "We couldn't start your payment. Please check your details and try again."), "error");
    setPayButton("Pay Now", true);
  } else if (status === 503) {
    // Payment start is paused: nothing was created or charged
    showHint("modal-hint", serverErrorMessage(errorResponse, "We couldn't start your payment right now. Please try again in a moment."), "info");
    setPayButton("Pay Now", true);
  } else if (status === 429) {
    showHint("modal-hint", "Too many attempts. Please wait a minute, then try again.", "info");
    setPayButton("Pay Now", true);
  } else if (status === 500) {
    showHint("modal-hint", MSG_START_FAILED, "info");
    setPayButton("Try again", true);
  } else if (status >= 400 && status < 500 && status !== 408) {
    showHint("modal-hint", serverErrorMessage(errorResponse, "We couldn't start your payment. Please try again."), "error");
    setPayButton("Pay Now", true);
  } else {
    // No answer (network error, timeout) or a gateway error: the request may have reached
    // the server, so the outcome is unknown. The user decides whether to try again.
    showHint("modal-hint", MSG_START_UNCONFIRMED, "info");
    setPayButton("Try again", true);
  }
}

function savePendingPurchase(purchaseId, statusUrl) {
  try {
    localStorage.setItem('pendingTransactionId', String(purchaseId));
    localStorage.setItem('pendingStatusUrl', statusUrl);
    localStorage.setItem('pendingTimestamp', Date.now().toString());
  } catch (e) {
    console.warn("Could not save transaction details to localStorage:", e);
  }
}

function clearPendingPurchase() {
  try {
    localStorage.removeItem('pendingTransactionId');
    localStorage.removeItem('pendingStatusUrl');
    localStorage.removeItem('pendingTimestamp');
  } catch (e) {
    console.warn("Could not clear transaction from localStorage:", e);
  }
}

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  pollingActive = false;
  pollRun++;
}

// Follow a purchase until it completes or fails: every 3 s for 2 minutes, then every 10 s,
// for up to 15 minutes. Waiting longer is never reported as a failure.
function startPolling(purchaseId, statusUrl, initialMessage) {
  stopPolling();
  currentPurchaseId = purchaseId;
  currentStatusUrl = statusUrl;
  lastServerMessage = initialMessage || "";
  pollStartedAt = Date.now();
  completedPolls = 0;
  pollingActive = true;

  showCheckAgain(false);
  setPayButton("Processing...", false);
  showHint("modal-hint", lastServerMessage || MSG_WAITING, "info");
  savePendingPurchase(purchaseId, statusUrl);

  scheduleNextPoll(POLL_FAST_MS);
}

function isLongWait() {
  return Date.now() - pollStartedAt >= POLL_FAST_FOR_MS;
}

function nextPollDelay() {
  return isLongWait() ? POLL_SLOW_MS : POLL_FAST_MS;
}

function scheduleNextPoll(delay) {
  const run = pollRun;
  pollTimer = setTimeout(function () {
    pollTimer = null;
    pollTransactionStatus(run);
  }, delay);
}

// Latest server message, plus a calm line once the wait gets long
function showWaitingHint() {
  let text = lastServerMessage || MSG_WAITING;
  if (isLongWait()) text += "\n" + MSG_STILL_CHECKING;
  showHint("modal-hint", text, "info");
}

// Max wait reached: stop asking, but don't claim anything failed
function stopAfterMaxWait() {
  stopPolling();
  showHint("modal-hint", (lastServerMessage ? lastServerMessage + "\n" : "") + MSG_STOPPED_CHECKING, "info");
  showCheckAgain(true);
  setPayButton("Pay Now", true);
}

function pollTransactionStatus(run) {
  if (run !== pollRun) return;
  if (Date.now() - pollStartedAt >= POLL_MAX_WAIT_MS) {
    stopAfterMaxWait();
    return;
  }

  improvedFetchWithFallback(
    currentStatusUrl,
    { method: 'GET' },
    function (response) {
      if (run !== pollRun) return; // modal closed or a newer run started
      handleStatusResponse(response || {}, run);
    },
    function (errorResponse, status) {
      if (run !== pollRun) return;
      console.error("Error polling status:", status, errorResponse);

      if (status === 404) {
        stopPolling();
        clearPendingPurchase();
        showHint("modal-hint", MSG_PURCHASE_NOT_FOUND, "info");
        setPayButton("Pay Now", true);
        return;
      }

      // Temporary problem (connection, server busy): keep the last message and check again later
      showWaitingHint();
      scheduleNextPoll(POLL_SLOW_MS);
    }
  );
}

function handleStatusResponse(response, run) {
  if (response.message) lastServerMessage = response.message;

  if (response.status === "completed") {
    completedPolls++;

    // Wait for two consecutive successful "completed" statuses to avoid race conditions
    if (completedPolls < 2) {
      showHint("modal-hint", "Received completion status. Confirming...", "info");
      scheduleNextPoll(POLL_FAST_MS);
      return;
    }

    stopPolling();
    clearPendingPurchase();
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
  } else if (response.status === "failed") {
    // Only returned when the server knows no money was taken: show its message as given
    stopPolling();
    clearPendingPurchase();
    let failMsg = response.message || "Payment Failed.";
    if (response.error_details && failMsg.indexOf(response.error_details) === -1) {
      failMsg += ` Reason: ${response.error_details}`;
    }
    showHint("modal-hint", failMsg, "error");
    setPayButton("Pay Now", true);
  } else {
    // pending / processing (or anything else): keep waiting, this can take minutes
    completedPolls = 0;
    showWaitingHint();
    scheduleNextPoll(nextPollDelay());
  }
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
          // Start polling with the saved information
          startPolling(pendingTransactionId, pendingStatusUrl, "Checking status of previous payment...");
        } else {
          // User declined, clear the stored transaction
          clearPendingPurchase();
        }
      } else {
        // Transaction is too old, clear it
        clearPendingPurchase();
      }
    }
  } catch (e) {
    console.warn("Error checking for interrupted transactions:", e);
  }
}

// Initialize the page
document.addEventListener("DOMContentLoaded", function () {
  const yearEl = document.getElementById("dynamic-year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

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
    fetchWifiAd();
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

  btnSubmitEcocash.addEventListener("click", handleEcocashSubmit);

  if (btnCheckAgain) {
    btnCheckAgain.addEventListener("click", function () {
      if (currentStatusUrl) {
        startPolling(currentPurchaseId, currentStatusUrl, lastServerMessage);
      }
    });
  }

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
