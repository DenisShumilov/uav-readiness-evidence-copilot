/**
 * SHMLV Air-Gapped Cross-Origin Isolation Service Worker (`coi-airgap-enclave-sw.js`)
 * Injects COOP (`same-origin`) + COEP (`require-corp`) + CORP (`same-origin`) + strict CSP headers
 * on static hosts (GitHub Pages / local HTTP) to unlock hardware `SharedArrayBuffer`
 * and multi-core WebAssembly SIMD128 threads (`Atomics.wait` / `Atomics.notify`),
 * while enforcing strict same-origin egress blocking, read-only method enforcement,
 * and offline CacheStorage resilience.
 */
var CACHE_PREFIX = "shmlv-airgap-enclave-";
var CACHE_NAME = "shmlv-airgap-enclave-v2.5.0";
var PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./tools-engine.js",
  "./real-samples-bundle.js",
  "./browser-isolation-runtime.js",
  "./multi-file-verifier-bundle.js",
  "./encrypted-report-share.js",
  "./pdf-scan-ocr-engine.js",
  "./social-card.png",
  "./real-samples/PROVENANCE.json",
  "./tools/doc-auditor.html",
  "./tools/cross-verify.html",
  "./tools/telemetry-analyzer.html",
  "./tools/cyber-forensics.html",
  "./tools/opsec-sanitizer.html",
  "./tools/readiness-matrix.html",
  "./tools/zero-trust-sandbox.html",
  "./tools/universal-ai-cockpit.html"
];

var precacheComplete = false;
var failedPrecacheUrls = [];
var precachedCount = 0;
var blockedExternalRequests = 0;
var blockedMethodRequests = 0;

function withCoopCoepHeaders(response) {
  if (
    !response ||
    response.status === 0 ||
    response.type === "opaque" ||
    response.type === "opaqueredirect" ||
    response.redirected
  ) {
    return response;
  }
  var headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'"
  );
  var status = response.status || 200;
  var body = status === 204 || status === 205 || status === 304 ? null : response.body;
  return new Response(body, {
    status: status,
    statusText: response.statusText,
    headers: headers
  });
}

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      failedPrecacheUrls = [];
      precachedCount = 0;
      return Promise.all(
        PRECACHE_ASSETS.map(function (url) {
          return fetch(url, { cache: "no-cache" })
            .then(function (res) {
              if (res && res.status === 200) {
                precachedCount += 1;
                return cache.put(url, res.clone());
              }
              failedPrecacheUrls.push(url);
              return null;
            })
            .catch(function (err) {
              var reason = err && err.message ? err.message : "precache_error";
              failedPrecacheUrls.push(url + " (" + reason + ")");
              return null;
            });
        })
      ).then(function () {
        precacheComplete = failedPrecacheUrls.length === 0;
      });
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("message", function (event) {
  var data = event.data || {};
  var cmd = typeof data === "string" ? data : data.type;
  if (cmd === "GET_ENCLAVE_STATUS") {
    var statusReport = {
      type: "ENCLAVE_STATUS",
      cachePrefix: CACHE_PREFIX,
      cacheName: CACHE_NAME,
      precacheComplete: precacheComplete,
      precachedCount: precachedCount,
      totalPrecacheAssets: PRECACHE_ASSETS.length,
      failedPrecacheUrls: failedPrecacheUrls.slice(),
      blockedExternalRequests: blockedExternalRequests,
      blockedMethodRequests: blockedMethodRequests,
      scope: self.registration ? self.registration.scope : "./"
    };
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(statusReport);
    } else if (event.source && typeof event.source.postMessage === "function") {
      event.source.postMessage(statusReport);
    }
  }
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") {
    return;
  }
  var reqUrl = new URL(req.url);
  if (reqUrl.origin !== self.location.origin) {
    blockedExternalRequests += 1;
    event.respondWith(
      new Response(
        JSON.stringify({
          error: "403 Air-Gap Policy Blocked",
          code: "AIRGAP_EGRESS_BLOCKED",
          blockedOrigin: reqUrl.origin,
          blockedExternalRequests: blockedExternalRequests,
          policy: "Zero-Server Air-Gap Enclave forbids external network egress"
        }),
        {
          status: 403,
          statusText: "403 Air-Gap Policy Blocked",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Resource-Policy": "same-origin"
          }
        }
      )
    );
    return;
  }

  var method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    blockedMethodRequests += 1;
    event.respondWith(
      new Response(
        JSON.stringify({
          error: "405 Method Not Allowed",
          code: "AIRGAP_MUTATING_METHOD_BLOCKED",
          method: method,
          blockedMethodRequests: blockedMethodRequests,
          policy: "Zero-Server Air-Gap Enclave permits read-only GET and HEAD requests only"
        }),
        {
          status: 405,
          statusText: "405 Method Not Allowed",
          headers: {
            "Allow": "GET, HEAD",
            "Content-Type": "application/json; charset=utf-8",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Resource-Policy": "same-origin"
          }
        }
      )
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then(function (networkResponse) {
        if (method === "GET" && networkResponse && networkResponse.status === 200) {
          var clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            return cache.put(req, clone).catch(function (putErr) {
              return Boolean(putErr);
            });
          });
        }
        return withCoopCoepHeaders(networkResponse);
      })
      .catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (cached) {
          if (cached) {
            return withCoopCoepHeaders(cached);
          }
          if (req.mode === "navigate") {
            return caches.match("./index.html").then(function (indexCached) {
              if (indexCached) {
                return withCoopCoepHeaders(indexCached);
              }
              return new Response("Offline Air-Gap Enclave: Resource unavailable", {
                status: 503,
                statusText: "Service Unavailable"
              });
            });
          }
          return new Response("Offline Air-Gap Enclave: Resource unavailable", {
            status: 503,
            statusText: "Service Unavailable"
          });
        });
      })
  );
});
