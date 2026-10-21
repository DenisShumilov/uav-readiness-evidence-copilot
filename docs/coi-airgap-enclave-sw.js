/**
 * SHMLV Air-Gapped Cross-Origin Isolation Service Worker (`coi-airgap-enclave-sw.js`)
 * Injects COOP (`same-origin`) + COEP (`require-corp`) + CORP (`same-origin`) + strict CSP headers
 * on static hosts (GitHub Pages / local HTTP) to unlock hardware `SharedArrayBuffer`
 * and multi-core WebAssembly SIMD128 threads (`Atomics.wait` / `Atomics.notify`),
 * while enforcing strict same-origin egress blocking and offline CacheStorage resilience.
 */
const CACHE_NAME = "shmlv-airgap-enclave-v3";
const PRECACHE_ASSETS = [
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
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'"
  );
  const status = response.status || 200;
  const body = status === 204 || status === 205 || status === 304 ? null : response.body;
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
      return Promise.all(
        PRECACHE_ASSETS.map(function (url) {
          return fetch(url, { cache: "no-cache" })
            .then(function (res) {
              if (res && res.status === 200) {
                return cache.put(url, res.clone());
              }
            })
            .catch(function () {});
        })
      );
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
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") {
    return;
  }
  var reqUrl = new URL(req.url);
  if (reqUrl.origin !== self.location.origin) {
    event.respondWith(
      new Response(
        JSON.stringify({
          error: "AIRGAP_EGRESS_BLOCKED",
          blockedOrigin: reqUrl.origin,
          policy: "Zero-Server Air-Gap Enclave forbids external network egress"
        }),
        {
          status: 403,
          statusText: "Forbidden by Air-Gap Enclave SW",
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

  event.respondWith(
    fetch(req)
      .then(function (networkResponse) {
        if (req.method === "GET" && networkResponse && networkResponse.status === 200) {
          var clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, clone).catch(function () {});
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
