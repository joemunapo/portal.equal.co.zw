/**
 * Equal WiFi Promotions System
 * Optimized for older phones and slower connections
 */

var EqualWifiPromotion = (function () {
  // Private variables
  var promotionData = null;
  var promotionShown = false;
  var initialized = false;
  var promotionContainer = null;
  var testMode = true;

  // Test promotion data for development without backend
  var mockPromotion = {
    active: true,
    isFullPage: true,
    title: "Limited Time Offer!",
    description: "Get 50% OFF on all WiFi packages today only!",
    imageBase64: "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",
    backgroundColor: "#3a1d6b",
    textColor: "#ffffff",
    callToAction: "Claim Now",
    callToActionUrl: "#",
    durationSeconds: 15
  };

  // Mock banner ad
  var mockBanner = {
    active: true,
    isFullPage: false,
    title: "Weekend Special",
    description: "Buy 1 day, get 1 day free!",
    imageBase64: "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",
    backgroundColor: "#1c7ed6",
    textColor: "#ffffff",
    callToAction: "Get Offer",
    callToActionUrl: "#",
    durationSeconds: 0
  };

  // Public methods
  return {
    /**
     * Initialize the promotion system
     */
    initialize: function (options) {
      if (initialized) return;

      // Check if we should run in test mode
      if (options && options.testMode) {
        console.log("Promotion system running in TEST MODE");
        testMode = true;
      }

      // Create promotion container if it doesn't exist
      if (!document.getElementById('promotion-container')) {
        promotionContainer = document.createElement('div');
        promotionContainer.id = 'promotion-container';
        document.body.appendChild(promotionContainer);
      } else {
        promotionContainer = document.getElementById('promotion-container');
      }

      // Check if we've already shown a promotion in this session
      var promotionShownInSession = false;
      try {
        promotionShownInSession = sessionStorage.getItem('promotionShown') === 'true';
      } catch (e) {
        // Check cookies as fallback
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
          var cookie = cookies[i].trim();
          if (cookie.indexOf('promotionShown=true') === 0) {
            promotionShownInSession = true;
            break;
          }
        }
      }

      if (promotionShownInSession) {
        promotionShown = true;
        return;
      }

      if (testMode) {
        // In test mode, use the mock data directly
        if (options && options.useBanner) {
          promotionData = mockBanner;
        } else {
          promotionData = mockPromotion;
        }
        this.displayPromotion();
        initialized = true;
      } else {
        // In normal mode, fetch from server
        this.fetchPromotionData();
      }
    },

    /**
     * Fetch promotion data from server with basic fallback mechanism
     */
    fetchPromotionData: function () {
      var self = this;

      // Use XHR instead of fetch for better compatibility with older phones
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/promotions', true);
      xhr.setRequestHeader('Content-Type', 'application/json');

      // Add a unique timestamp to prevent caching
      var timestamp = new Date().getTime();
      var url = '/promotions' + (xhr.url && xhr.url.indexOf('?') !== -1 ? '&' : '?') + '_t=' + timestamp;

      xhr.timeout = 8000; // 8 second timeout

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          try {
            if (xhr.status === 200) {
              var response = JSON.parse(xhr.responseText);
              if (response && response.active) {
                promotionData = response;
                self.displayPromotion();
                initialized = true;
              }
            } else {
              console.error("Failed to fetch promotion data. Status: " + xhr.status);
            }
          } catch (error) {
            console.error("Error processing promotion data:", error);
          }
        }
      };

      xhr.onerror = function () {
        console.error("Network error when fetching promotions");
      };

      xhr.ontimeout = function () {
        console.error("Timeout when fetching promotions");
      };

      try {
        xhr.send();
      } catch (e) {
        console.error("Error sending promotion request:", e);
      }
    },

    /**
     * Display the promotion based on its type
     */
    displayPromotion: function () {
      if (!promotionData || promotionShown) return;

      var isFullPage = promotionData.isFullPage;
      var title = promotionData.title;
      var description = promotionData.description;
      var imageBase64 = promotionData.imageBase64;
      var callToAction = promotionData.callToAction;
      var callToActionUrl = promotionData.callToActionUrl;
      var backgroundColor = promotionData.backgroundColor;
      var textColor = promotionData.textColor;
      var durationSeconds = promotionData.durationSeconds;

      // Create promotion element
      var promotionElement = document.createElement('div');
      promotionElement.className = isFullPage ? 'promotion-fullpage' : 'promotion-banner';

      // Apply custom styles if provided
      if (backgroundColor) {
        promotionElement.style.backgroundColor = backgroundColor;
      }

      if (textColor) {
        promotionElement.style.color = textColor;
      }

      // Create close button
      var closeButton = document.createElement('button');
      closeButton.className = 'promotion-close';
      closeButton.innerHTML = '&times;';
      var self = this;
      closeButton.onclick = function () {
        self.closePromotion();
      };

      // Create content wrapper
      var contentWrapper = document.createElement('div');
      contentWrapper.className = 'promotion-content';

      // Add title if provided
      if (title) {
        var titleElement = document.createElement('h2');
        titleElement.className = 'promotion-title';
        titleElement.textContent = title;
        contentWrapper.appendChild(titleElement);
      }

      // Add image if provided
      if (imageBase64) {
        var imageElement = document.createElement('img');
        imageElement.className = 'promotion-image';
        imageElement.src = 'data:image/jpeg;base64,' + imageBase64;
        imageElement.alt = title || 'Promotion';

        // Add error handling for image
        imageElement.onerror = function () {
          console.error("Error loading promotion image");
          this.style.display = 'none';
        };

        contentWrapper.appendChild(imageElement);
      }

      // Add description if provided
      if (description) {
        var descriptionElement = document.createElement('p');
        descriptionElement.className = 'promotion-description';
        descriptionElement.textContent = description;
        contentWrapper.appendChild(descriptionElement);
      }

      // Add call to action button if provided
      if (callToAction) {
        var ctaElement = document.createElement('a');
        ctaElement.className = 'promotion-cta';
        ctaElement.textContent = callToAction;

        if (callToActionUrl) {
          ctaElement.href = callToActionUrl;
          ctaElement.target = '_blank';
          if (ctaElement.setAttribute) {
            ctaElement.setAttribute('rel', 'noopener noreferrer');
          }
        } else {
          ctaElement.href = '#';
          ctaElement.onclick = function (e) {
            if (e && e.preventDefault) e.preventDefault();
            self.closePromotion();
            return false;
          };
        }

        contentWrapper.appendChild(ctaElement);
      }

      // Assemble the promotion
      promotionElement.appendChild(closeButton);
      promotionElement.appendChild(contentWrapper);
      promotionContainer.appendChild(promotionElement);

      // Show the promotion - with a slight delay to allow for rendering
      setTimeout(function () {
        if (promotionContainer && promotionContainer.classList) {
          promotionContainer.classList.add('active');
        } else {
          // Fallback for older browsers
          promotionContainer.className += ' active';
        }

        if (promotionElement && promotionElement.classList) {
          promotionElement.classList.add('active');
        } else {
          // Fallback for older browsers
          promotionElement.className += ' active';
        }
      }, 100);

      // Auto-close after specified duration (if provided)
      if (durationSeconds && durationSeconds > 0) {
        setTimeout(function () {
          self.closePromotion();
        }, durationSeconds * 1000);
      }

      promotionShown = true;
      try {
        sessionStorage.setItem('promotionShown', 'true');
      } catch (e) {
        console.warn("sessionStorage error:", e);
        // Create a cookie fallback for browsers without sessionStorage
        document.cookie = "promotionShown=true; path=/";
      }
    },

    /**
     * Close the promotion
     */
    closePromotion: function () {
      var promotionElements = document.querySelectorAll('.promotion-fullpage, .promotion-banner');

      for (var i = 0; i < promotionElements.length; i++) {
        var element = promotionElements[i];

        // Remove active class
        if (element.classList) {
          element.classList.remove('active');
        } else {
          // Fallback for older browsers
          element.className = element.className.replace(/\bactive\b/, '');
        }

        // Set up removal after transition (if supported)
        if (typeof element.addEventListener === 'function') {
          element.addEventListener('transitionend', function handleTransitionEnd() {
            if (this.parentNode) {
              this.parentNode.removeChild(this);
            }
            this.removeEventListener('transitionend', handleTransitionEnd);
          });

          // Safety fallback if transitionend doesn't fire
          setTimeout(function () {
            if (element.parentNode) {
              element.parentNode.removeChild(element);
            }
          }, 1000);
        } else {
          // Direct removal for browsers without transition support
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
        }
      }

      // Remove active class from container
      if (promotionContainer) {
        if (promotionContainer.classList) {
          promotionContainer.classList.remove('active');
        } else {
          promotionContainer.className = promotionContainer.className.replace(/\bactive\b/, '');
        }
      }
    },

    /**
     * Test method to show a promotion without server setup
     * @param {Object} options - Configuration options
     * @param {boolean} options.isFullPage - Whether to show full-page ad (true) or banner (false)
     * @param {string} options.title - Optional custom title
     * @param {string} options.description - Optional custom description
     */
    testPromotion: function (options) {
      // Reset session storage to allow showing promo again for testing
      try {
        sessionStorage.removeItem('promotionShown');
      } catch (e) {
        // Clear cookie fallback
        document.cookie = "promotionShown=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }

      // Reset promotion status
      promotionShown = false;

      // Default to full page if not specified
      var useFullPage = options && options.isFullPage === false ? false : true;

      // Create a copy of either the full page or banner mock
      var testPromo = useFullPage ? JSON.parse(JSON.stringify(mockPromotion)) : JSON.parse(JSON.stringify(mockBanner));

      // Override with any provided options
      if (options) {
        if (options.title) testPromo.title = options.title;
        if (options.description) testPromo.description = options.description;
        if (options.callToAction) testPromo.callToAction = options.callToAction;
        if (options.backgroundColor) testPromo.backgroundColor = options.backgroundColor;
        if (options.textColor) testPromo.textColor = options.textColor;
        if (options.durationSeconds !== undefined) testPromo.durationSeconds = options.durationSeconds;
      }

      // Set the promotion data and display
      promotionData = testPromo;

      // If the container doesn't exist yet, create it
      if (!promotionContainer) {
        promotionContainer = document.createElement('div');
        promotionContainer.id = 'promotion-container';
        document.body.appendChild(promotionContainer);
      }

      this.displayPromotion();
    }
  };
})();

// Initialize the promotion system when the page loads
if (document.addEventListener) {
  document.addEventListener("DOMContentLoaded", function () {
    // Initialize the promotion system
    if (EqualWifiPromotion && EqualWifiPromotion.initialize) {
      EqualWifiPromotion.initialize();
    }
  });
} else {
  // Fallback for older IE
  window.onload = function () {
    // Initialize the promotion system
    if (EqualWifiPromotion && EqualWifiPromotion.initialize) {
      EqualWifiPromotion.initialize();
    }
  };
}

// Explicitly expose the promotion system to the window object
// This ensures it's accessible from anywhere, including test buttons
window.EqualWifiPromotion = EqualWifiPromotion;

function testFullPageAd() {
  if (window.EqualWifiPromotion) {
    window.EqualWifiPromotion.testPromotion({isFullPage: true});
  }
}

function testBannerAd() {
  if (window.EqualWifiPromotion) {
    window.EqualWifiPromotion.testPromotion({isFullPage: false});
  }
}