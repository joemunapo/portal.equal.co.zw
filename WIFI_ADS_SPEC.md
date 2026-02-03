# Wi-Fi Ads API Spec (Portal)

This document defines the Wi‑Fi ads endpoint used by the portal. The portal requests an ad based on the connected device context, renders it inside an iframe, and logs impressions/close events. If no ad is available, the portal stays silent.

## 1) Fetch Active Ad

**Endpoint**
- `GET /api/v1/wifi-ads/active`

**Query Parameters**
- `clientMac` (string, required): Connected device MAC.
- `apMac` (string, optional): Access point MAC.
- `gatewayMac` (string, optional): Gateway MAC.
- `ssid` (string, optional): SSID name.
- `radioId` (integer, optional)
- `vid` (integer, optional)

**Response (200)**
```json
{
  "data": {
    "enabled": true,
    "id": "ad_9f2c8b",
    "html": "<div style=\"font-family:Arial,sans-serif;padding:16px;color:#fff;background:#1a2a60;border-radius:12px\"><h2>Summer Sale</h2><p>Get 20% off this week only.</p></div>",
    "imageBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
    "imageMime": "image/png",
    "type": "html",
    "message": "Promote your business here. Ask about Wi‑Fi ads.",
    "cta": "Continue",
    "ttlSeconds": 259200,
    "closable": true
  }
}
```

**Notes**
- `enabled=false` means no ad should be shown.
- `html` or `imageBase64` is required when `enabled=true`.
- `imageBase64` should be raw base64 **without** the data URL prefix. Use `imageMime` to describe the type.
- `message` is shown **below** the iframe.
- `cta` is the label for the Continue button (optional; defaults to “Continue”).
- `ttlSeconds` controls the portal’s session dismissal window (default 259200 = 3 days).
- `type` is reserved for future (`html`, `image`, etc.). Portal currently uses `html` via `srcdoc`.

## 4) Notes / Recommendations

- **Security:** Treat `html` as untrusted. Sanitize it server‑side to avoid script injection.
- **Size:** Base64 images grow ~33%. Keep `imageBase64` under ~200KB for fast loads.
- **Storage:** Dismissal uses `localStorage` so it persists across sessions.

## 2) Log Ad Event

**Endpoint**
- `POST /api/v1/wifi-ads/log`

**Body**
```json
{
  "adId": "ad_9f2c8b",
  "event": "impression",
  "clientMac": "AA:BB:CC:DD:EE:FF",
  "apMac": "11:22:33:44:55:66",
  "gatewayMac": "77:88:99:AA:BB:CC",
  "ssidName": "Equal WiFi",
  "radioId": 1,
  "vid": 10
}
```

**Events**
- `impression` (portal shows ad)
- `close` (user closes ad or taps Continue)

## 3) Backend Prompt (Laravel)

Build a Wi‑Fi ads API with two endpoints:

1. `GET /api/v1/wifi-ads/active`
   - Accept `clientMac`, `apMac`, `gatewayMac`, `ssid`, `radioId`, `vid`.
   - Decide if an ad is active for this device/context.
   - Return JSON: `{ data: { enabled, id, html, imageBase64, imageMime, message, cta, ttlSeconds, closable } }`.
   - If no ad, return `{ data: { enabled: false } }`.

2. `POST /api/v1/wifi-ads/log`
   - Accept `adId`, `event`, and device context.
   - Store impression/close events (timestamp, IP, UA).

Please implement in Laravel:
- Routes in `routes/api.php`
- Controller `WifiAdsController`
- Optional model `WifiAdEvent`
- Basic validation and throttling
