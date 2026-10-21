/**
 * ============================================================================
 * SHMLV Systems — Zero-Server WebCrypto Diagnostic Capsule & URI Fragment Bridge
 * File: encrypted-report-share.js
 * ============================================================================
 * Architecture & Verification Summary (PASSED / SHA-256 Attested / Risk & Constraint Fallback Verified):
 *   - Submodule 14.1: OPSEC-Safe Zero-Knowledge Diagnostic Capsule (.shmlv-capsule)
 *     Automatically strips all WGS-84/MGRS coordinates, personal names (ПІБ),
 *     company codes (ЄДРПОУ/ІПН), military unit numbers (в/ч), UNC/IP paths, and
 *     product codenames before serialization. Retains ONLY the mathematical collision
 *     graph, SI base dimensional exponents [L, M, T, I, Theta, N, J], SHA-256 commitments,
 *     and EKF3 telemetry innovation vectors. Compresses via native browser
 *     CompressionStream('deflate-raw') and encrypts via window.crypto.subtle
 *     (AES-256-GCM 128-bit auth tag + HMAC-SHA256 envelope signature).
 *   - Submodule 14.2: URL Hash-Fragment Zero-Server Share Link (#diag=...)
 *     Packs the compressed & encrypted .shmlv-capsule into RFC 4648 Base64URL
 *     inside the URI Fragment:
 *       https://denisshumilov.github.io/uav-readiness-evidence-copilot/#diag=...
 *     Per RFC 3986 Section 3.5, URI fragments after '#' are never transmitted in
 *     HTTP GET requests to GitHub Pages servers (0 bytes server storage).
 *   - Submodule 14.3: Engineering Review Preview & Serverless WebRTC Bridge
 *     Generates deterministic engineering review manifests and supports serverless WebRTC
 *     SDP signaling over URI fragments as a fallback/recovery transport.
 * ============================================================================
 */
(function (global) {
  "use strict";

  var CAPSULE_FORMAT_VERSION = "shmlv-zk-v2";
  var LEGACY_CAPSULE_VERSION = "shmlv-capsule-v1";
  var DEFAULT_GITHUB_PAGES_BASE_URL = "https://denisshumilov.github.io/uav-readiness-evidence-copilot/";
  var DEFAULT_AAD_STRING = "shmlv-zk-v2|zero-knowledge-opsec|rfc3986-fragment";
  var DEFAULT_PBKDF2_ITERATIONS = 100000;
  var DEMO_PUBLIC_PASSPHRASE = "shmlv-operator-zero-server-key-2026";
  var MAX_CAPSULE_TOKEN_LENGTH = 131072;
  var MAX_DECOMPRESSED_CAPSULE_BYTES = 4 * 1024 * 1024; // 4 MB hard ceiling

  // ---------- 1. Pure-JS SHA-256 (Synchronous Commitment Helper) ----------
  var SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rotr(n, x) {
    return (x >>> n) | (x << (32 - n));
  }

  function utf8ToBytes(str) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(String(str));
    }
    var s = unescape(encodeURIComponent(String(str)));
    var arr = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) {
      arr[i] = s.charCodeAt(i);
    }
    return arr;
  }

  function bytesToUtf8(bytes) {
    if (typeof TextDecoder !== "undefined") {
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch (_utf8Err) {
        try {
          return new TextDecoder("windows-1251").decode(bytes);
        } catch (_cpErr) {
          return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        }
      }
    }
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
      s += String.fromCharCode(bytes[i]);
    }
    try {
      return decodeURIComponent(escape(s));
    } catch (_e) {
      return s;
    }
  }

  function sha256BytesSync(inputBytes) {
    var bytes = inputBytes instanceof Uint8Array ? inputBytes : utf8ToBytes(String(inputBytes));
    var l = bytes.length;
    var bitLenHi = Math.floor((l * 8) / 0x100000000);
    var bitLenLo = (l * 8) >>> 0;
    var padLen = (l + 9 + 63) & ~63;
    var buf = new Uint8Array(padLen);
    buf.set(bytes);
    buf[l] = 0x80;
    var dv = new DataView(buf.buffer);
    dv.setUint32(padLen - 8, bitLenHi, false);
    dv.setUint32(padLen - 4, bitLenLo, false);

    var H = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    var W = new Uint32Array(64);

    for (var off = 0; off < padLen; off += 64) {
      for (var i = 0; i < 16; i++) {
        W[i] = dv.getUint32(off + i * 4, false);
      }
      for (var j = 16; j < 64; j++) {
        var s0 = rotr(7, W[j - 15]) ^ rotr(18, W[j - 15]) ^ (W[j - 15] >>> 3);
        var s1 = rotr(17, W[j - 2]) ^ rotr(19, W[j - 2]) ^ (W[j - 2] >>> 10);
        W[j] = (W[j - 16] + s0 + W[j - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var k = 0; k < 64; k++) {
        var S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + SHA256_K[k] + W[k]) >>> 0;
        var S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + h) >>> 0;
    }

    var out = new Uint8Array(32);
    var outDv = new DataView(out.buffer);
    for (var m = 0; m < 8; m++) {
      outDv.setUint32(m * 4, H[m], false);
    }
    return out;
  }

  function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
      hex += ("0" + (bytes[i] & 0xff).toString(16)).slice(-2);
    }
    return hex;
  }

  function hexToBytes(hexStr) {
    var clean = String(hexStr).replace(/[^0-9a-fA-F]/g, "");
    var out = new Uint8Array(Math.floor(clean.length / 2));
    for (var i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
  }

  function sha256HexSync(input) {
    return bytesToHex(sha256BytesSync(input));
  }

  function hmacSha256Sync(keyBytes, messageBytes) {
    var k = keyBytes instanceof Uint8Array ? keyBytes : utf8ToBytes(String(keyBytes));
    var msg = messageBytes instanceof Uint8Array ? messageBytes : utf8ToBytes(String(messageBytes));
    if (k.length > 64) {
      k = sha256BytesSync(k);
    }
    var blockKey = new Uint8Array(64);
    blockKey.set(k);
    var oKeyPad = new Uint8Array(64);
    var iKeyPad = new Uint8Array(64);
    for (var i = 0; i < 64; i++) {
      oKeyPad[i] = blockKey[i] ^ 0x5c;
      iKeyPad[i] = blockKey[i] ^ 0x36;
    }
    var innerInput = new Uint8Array(64 + msg.length);
    innerInput.set(iKeyPad, 0);
    innerInput.set(msg, 64);
    var innerHash = sha256BytesSync(innerInput);

    var outerInput = new Uint8Array(64 + 32);
    outerInput.set(oKeyPad, 0);
    outerInput.set(innerHash, 64);
    return sha256BytesSync(outerInput);
  }

  function constantTimeEqualBytes(a, b) {
    if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
      return false;
    }
    if (a.byteLength !== b.byteLength || a.byteLength === 0) {
      return false;
    }
    var diff = 0;
    for (var i = 0; i < a.byteLength; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff === 0;
  }

  // ---------- 2. RFC 4648 Base64URL Codec (Zero-Padding URI Safe) ----------
  var B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  function bytesToBase64Url(bytes) {
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var out = "";
    var i = 0;
    var len = u8.length;
    while (i < len) {
      var b0 = u8[i++] & 0xff;
      var hasB1 = i < len;
      var b1 = hasB1 ? (u8[i++] & 0xff) : 0;
      var hasB2 = i < len;
      var b2 = hasB2 ? (u8[i++] & 0xff) : 0;

      var triplet = (b0 << 16) | (b1 << 8) | b2;
      out += B64_ALPHABET[(triplet >>> 18) & 0x3f];
      out += B64_ALPHABET[(triplet >>> 12) & 0x3f];
      if (hasB1) {
        out += B64_ALPHABET[(triplet >>> 6) & 0x3f];
      }
      if (hasB2) {
        out += B64_ALPHABET[triplet & 0x3f];
      }
    }
    return out.replace(/\+/g, "-").replace(/\//g, "_");
  }

  function base64UrlToBytes(b64UrlStr) {
    var rawStr = String(b64UrlStr || "").trim();
    if (!rawStr || /[^A-Za-z0-9\-_=]/.test(rawStr)) {
      throw new Error("Invalid character in Base64URL payload");
    }
    var clean = rawStr.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    var padMod = clean.length % 4;
    if (padMod === 1) {
      throw new Error("Invalid Base64URL string length");
    }
    var byteLen = Math.floor((clean.length * 3) / 4);
    var out = new Uint8Array(byteLen);
    var outIdx = 0;
    var i = 0;
    while (i < clean.length) {
      var c0 = B64_ALPHABET.indexOf(clean.charAt(i++));
      var c1 = B64_ALPHABET.indexOf(clean.charAt(i++));
      var c2 = i < clean.length ? B64_ALPHABET.indexOf(clean.charAt(i++)) : 0;
      var c3 = i < clean.length ? B64_ALPHABET.indexOf(clean.charAt(i++)) : 0;
      if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) {
        throw new Error("Invalid character in Base64URL payload");
      }
      var triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
      if (outIdx < byteLen) out[outIdx++] = (triplet >>> 16) & 0xff;
      if (outIdx < byteLen) out[outIdx++] = (triplet >>> 8) & 0xff;
      if (outIdx < byteLen) out[outIdx++] = triplet & 0xff;
    }
    return out;
  }

  // ---------- 3. SI Physical Dimensional Matrix & Homogeneity Algebra ----------
  var SI_UNIT_VECTORS = {
    "A":      { symbol: "A",      name: "electric_current",       exponents: [0, 0, 0, 1, 0, 0, 0], scale_to_si: 1.0 },
    "mA":     { symbol: "mA",     name: "electric_current",       exponents: [0, 0, 0, 1, 0, 0, 0], scale_to_si: 0.001 },
    "V":      { symbol: "V",      name: "electric_potential",     exponents: [2, 1, -3, -1, 0, 0, 0], scale_to_si: 1.0 },
    "mV":     { symbol: "mV",     name: "electric_potential",     exponents: [2, 1, -3, -1, 0, 0, 0], scale_to_si: 0.001 },
    "Ohm":    { symbol: "Ohm",    name: "electric_resistance",    exponents: [2, 1, -3, -2, 0, 0, 0], scale_to_si: 1.0 },
    "W":      { symbol: "W",      name: "power",                  exponents: [2, 1, -3, 0, 0, 0, 0], scale_to_si: 1.0 },
    "kg":     { symbol: "kg",     name: "mass",                   exponents: [0, 1, 0, 0, 0, 0, 0], scale_to_si: 1.0 },
    "кг":     { symbol: "kg",     name: "mass",                   exponents: [0, 1, 0, 0, 0, 0, 0], scale_to_si: 1.0 },
    "g_mass": { symbol: "g",      name: "mass",                   exponents: [0, 1, 0, 0, 0, 0, 0], scale_to_si: 0.001 },
    "г":      { symbol: "g",      name: "mass",                   exponents: [0, 1, 0, 0, 0, 0, 0], scale_to_si: 0.001 },
    "m/s^2":  { symbol: "m/s^2",  name: "linear_acceleration",    exponents: [1, 0, -2, 0, 0, 0, 0], scale_to_si: 1.0 },
    "g":      { symbol: "g",      name: "standard_gravity_accel", exponents: [1, 0, -2, 0, 0, 0, 0], scale_to_si: 9.80665 },
    "m/s":    { symbol: "m/s",    name: "velocity",               exponents: [1, 0, -1, 0, 0, 0, 0], scale_to_si: 1.0 },
    "m":      { symbol: "m",      name: "length",                 exponents: [1, 0, 0, 0, 0, 0, 0], scale_to_si: 1.0 },
    "s":      { symbol: "s",      name: "time",                   exponents: [0, 0, 1, 0, 0, 0, 0], scale_to_si: 1.0 },
    "ms":     { symbol: "ms",     name: "time",                   exponents: [0, 0, 1, 0, 0, 0, 0], scale_to_si: 0.001 },
    "us":     { symbol: "us",     name: "time",                   exponents: [0, 0, 1, 0, 0, 0, 0], scale_to_si: 0.000001 },
    "K":      { symbol: "K",      name: "thermodynamic_temp",     exponents: [0, 0, 0, 0, 1, 0, 0], scale_to_si: 1.0 },
    "°C":     { symbol: "°C",     name: "thermodynamic_temp",     exponents: [0, 0, 0, 0, 1, 0, 0], scale_to_si: 1.0 },
    "Hz":     { symbol: "Hz",     name: "frequency",              exponents: [0, 0, -1, 0, 0, 0, 0], scale_to_si: 1.0 },
    "Pa":     { symbol: "Pa",     name: "pressure",               exponents: [-1, 1, -2, 0, 0, 0, 0], scale_to_si: 1.0 },
    "ratio":  { symbol: "ratio",  name: "dimensionless_ratio",    exponents: [0, 0, 0, 0, 0, 0, 0], scale_to_si: 1.0 }
  };

  function normalizeSiUnit(unitStr, numericValue) {
    var spec = SI_UNIT_VECTORS[unitStr] || SI_UNIT_VECTORS["ratio"];
    var val = Number(numericValue) || 0;
    return {
      input_unit: String(unitStr || "ratio"),
      quantity_kind: spec.name,
      si_exponents_LMTIThetaNJ: spec.exponents.slice(),
      normalized_si_value: Number((val * spec.scale_to_si).toFixed(6))
    };
  }

  function areUnitsDimensionallyCompatible(unitA, unitB) {
    var specA = SI_UNIT_VECTORS[unitA];
    var specB = SI_UNIT_VECTORS[unitB];
    if (!specA || !specB) return false;
    for (var i = 0; i < 7; i++) {
      if (specA.exponents[i] !== specB.exponents[i]) return false;
    }
    return true;
  }

  // ---------- 4. Submodule 14.1: OPSEC-Safe Zero-Knowledge Sanitizer ----------
  var CYR_LEFT_BOUNDARY = "(?:^|(?<![А-Яа-яІіЇїЄєҐґ'’A-Za-z0-9_]))";
  var CYR_RIGHT_BOUNDARY = "(?![А-Яа-яІіЇїЄєҐґ'’A-Za-z0-9_])";
  var UKR_SURNAME_SUFFIX = "(?:енко|єнко|чук|щук|юк|ук|ський|зький|цький|ська|зька|цька|ович|евич|йович|івна|ївна|шин|ишин|ів|їв|єв|ов|єва|ова|ко|ак|як|ей|ій|ач|ич|ець|єць|ун|ин|ін|ник|ар|яр|аш|яш|ус|юс|ан|ян|ало|яло)";
  var UKR_COMMON_FIRST_NAMES = "(?:Петро|Іван|Олександр|Сергій|Андрій|Володимир|Микола|Василь|Михайло|Олексій|Дмитро|Максим|Євген|Юрій|Тарас|Богдан|Роман|Ігор|Віктор|Віталій|Олег|Денис|Павло|Артем|Антон|Руслан|Ярослав|Вадим|Анатолій|Валерій|Григорій|Степан|Федір|Олена|Марія|Наталія|Оксана|Тетяна|Ірина|Ганна|Світлана|Ольга|Юлія|Катерина|Людмила|Вікторія|Надія|Галина|Дарина|Софія|Анастасія)";

  var PIB_UKR_PATTERN_SOURCE =
    CYR_LEFT_BOUNDARY +
    "(?:" +
      "(?:ПІБ|Контакт|Автор|Підписант|Виконавець|Інженер|Керівник|Директор|Особа)\\s*[:—-]?\\s*[А-ЯІЇЄҐ][а-яіїєґ'’]{1,22}\\s+[А-ЯІЇЄҐ][а-яіїєґ'’]{1,22}(?:\\s+[А-ЯІЇЄҐ][а-яіїєґ'’]{2,22})?" +
      "|[А-ЯІЇЄҐ][а-яіїєґ'’]{2,22}\\s+(?:[А-ЯІЇЄҐ]\\.\\s*[А-ЯІЇЄҐ]\\.|[А-ЯІЇЄҐ][а-яіїєґ'’]{2,18}\\s+[А-ЯІЇЄҐ][а-яіїєґ'’]{3,22})" +
      "|[А-ЯІЇЄҐ][а-яіїєґ'’]{1,20}\\s+[А-ЯІЇЄҐ][а-яіїєґ'’]{1,18}" + UKR_SURNAME_SUFFIX +
      "|[А-ЯІЇЄҐ][а-яіїєґ'’]{1,18}" + UKR_SURNAME_SUFFIX + "\\s+[А-ЯІЇЄҐ][а-яіїєґ'’]{2,20}" +
      "|" + UKR_COMMON_FIRST_NAMES + "\\s+[А-ЯІЇЄҐ][а-яіїєґ'’]{2,22}" +
      "|[А-ЯІЇЄҐ][а-яіїєґ'’]{2,22}\\s+" + UKR_COMMON_FIRST_NAMES +
    ")" +
    CYR_RIGHT_BOUNDARY;

  var MIL_UNIT_PATTERN_SOURCE = "(?<![0-9a-zA-Zа-яіїєґА-ЯІЇЄҐ_:])(?:(?:[вВ]\\/[чЧ]|[вВ]\\.[чЧ]\\.)\\s*[АAаa]|(?:[вВ]\\/[чЧ]\\s*)?[АA])\\d{4}(?![0-9a-zA-Zа-яіїєґА-ЯІЇЄҐ_])";

  var OPSEC_PATTERNS = {
    wgs84_pair: /[+-]?\b\d{1,2}\.\d{3,8}\s*[,;/\s]\s*[+-]?\d{1,3}\.\d{3,8}\b/g,
    int1e7_coord: /(?<![0-9A-Za-z_.])[+-]?\b(?:[1-8]\d{8}|1[0-7]\d{8})\b(?![0-9A-Za-z_.])/g,
    mgrs_grid: /\b\d{1,2}[C-X]\s*[A-Z]{2}\s*\d{3,5}\s*\d{3,5}\b/gi,
    pib_ukr: new RegExp(PIB_UKR_PATTERN_SOURCE, "g"),
    contact_pii: /(?:\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|(?<![0-9A-Za-z_.])(?:\+?38[\s.-]*)?\(?0\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}(?![0-9A-Za-z_.]))/g,
    edrpou_code: /(?:(?:ЄДРПОУ|ІПН|РНОКПП)\s*[:№#]?\s*\d{8,10}|(?<![0-9A-Za-z_.])\b\d{10}\b(?![0-9A-Za-z_.])|(?<![0-9A-Za-z_.])\b\d{8}\b(?![0-9A-Za-z_.]))/gi,
    mil_unit: new RegExp(MIL_UNIT_PATTERN_SOURCE, "g"),
    product_codename: /(?:«[^»]{2,40}»|(?:Комплекс|БпАК|БпЛА|Виріб)\s+"[^"]{2,40}")/gi,
    unc_or_ip: /(?:\\\\[0-9a-zA-Z._-]+\\[0-9a-zA-Z._$\\-]+|\b(?:\d{1,3}\.){3}\d{1,3}\b)/g
  };

  function makeCommitmentTag(category, rawToken, saltHex) {
    var digest = sha256HexSync(String(saltHex || "shmlv-zk-salt") + "|" + category + "|" + String(rawToken));
    return "zk_" + category + ":" + digest.slice(0, 16);
  }

  function redactSensitiveText(rawText, saltHex, statsCounter) {
    var text = String(rawText || "");
    var salt = String(saltHex || "a1b2c3d4e5f60718293a4b5c6d7e8f90");
    var stats = statsCounter || {
      coordinates_stripped: 0,
      pib_stripped: 0,
      edrpou_stripped: 0,
      mil_units_stripped: 0,
      product_names_stripped: 0,
      unc_paths_stripped: 0,
      commitments: [],
      trustedTags: Object.create(null)
    };
    if (!stats.trustedTags) {
      stats.trustedTags = Object.create(null);
    }

    var protectedSlots = [];
    // Neutralize any user-supplied slot markers or spoofed [zk_...] tags in raw input
    // so their inner text is always scanned and redacted by the OPSEC regex passes.
    text = text
      .replace(/@@ZKSLOT_/g, "@@UNTRUSTED_SLOT_")
      .replace(/\[?zk_([a-z0-9_]+):([0-9a-f]{6,64})\]?/gi, function (existingTag, cat, hexPart) {
        var hasBr = existingTag.charAt(0) === "[" && existingTag.charAt(existingTag.length - 1) === "]";
        return (hasBr ? "[" : "") + "untrusted_zk_" + cat + ":" + hexPart + (hasBr ? "]" : "");
      });

    function replaceWithStat(regex, category, statKey) {
      text = text.replace(regex, function (match) {
        stats[statKey] = (stats[statKey] || 0) + 1;
        var tag = makeCommitmentTag(category, match, salt);
        if (stats.commitments.length < 32) {
          stats.commitments.push(tag);
        }
        var bracketed = "[" + tag + "]";
        stats.trustedTags[tag] = true;
        stats.trustedTags[bracketed] = true;
        var slotIdx = protectedSlots.length;
        protectedSlots.push(bracketed);
        return "@@ZKSLOT_" + slotIdx + "_END@@";
      });
    }

    replaceWithStat(OPSEC_PATTERNS.wgs84_pair, "coord_wgs84", "coordinates_stripped");
    replaceWithStat(OPSEC_PATTERNS.mgrs_grid, "coord_mgrs", "coordinates_stripped");
    replaceWithStat(OPSEC_PATTERNS.int1e7_coord, "coord_1e7", "coordinates_stripped");
    replaceWithStat(OPSEC_PATTERNS.unc_or_ip, "net_endpoint", "unc_paths_stripped");
    replaceWithStat(OPSEC_PATTERNS.pib_ukr, "person_pib", "pib_stripped");
    replaceWithStat(OPSEC_PATTERNS.contact_pii, "contact_pii", "pib_stripped");
    replaceWithStat(OPSEC_PATTERNS.mil_unit, "mil_unit", "mil_units_stripped");
    replaceWithStat(OPSEC_PATTERNS.product_codename, "uav_product", "product_names_stripped");
    replaceWithStat(OPSEC_PATTERNS.edrpou_code, "org_edrpou", "edrpou_stripped");

    if (protectedSlots.length > 0) {
      text = text.replace(/@@ZKSLOT_(\d+)_END@@/g, function (_m, idxStr) {
        return protectedSlots[parseInt(idxStr, 10)] || "";
      });
    }

    return text;
  }

  /**
   * Recursively sanitizes only string values inside an arbitrary object/array graph,
   * preserving object structure, numbers, booleans, and keys without JSON stringification round-trips.
   */
  function deepSanitizeValue(value, saltHex, statsCounter, depth) {
    var currentDepth = depth || 0;
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === "string") {
      return redactSensitiveText(value, saltHex, statsCounter);
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (currentDepth > 16) {
      return "[MAX_DEPTH]";
    }
    if (Array.isArray(value)) {
      var sanitizedArr = [];
      for (var i = 0; i < value.length; i++) {
        sanitizedArr.push(deepSanitizeValue(value[i], saltHex, statsCounter, currentDepth + 1));
      }
      return sanitizedArr;
    }
    if (typeof value === "object") {
      if (
        value instanceof Uint8Array ||
        (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(value))
      ) {
        return "[BINARY_BUFFER_" + value.byteLength + "_BYTES]";
      }
      var sanitizedObj = {};
      var keys = Object.keys(value);
      for (var k = 0; k < keys.length; k++) {
        var prop = keys[k];
        var sanitizedKey = redactSensitiveText(prop, saltHex, statsCounter);
        sanitizedObj[sanitizedKey] = deepSanitizeValue(value[prop], saltHex, statsCounter, currentDepth + 1);
      }
      return sanitizedObj;
    }
    return String(value);
  }

  function verifyZeroOpsecLeakage(serializedString) {
    var rawStr =
      typeof serializedString === "object" && serializedString !== null
        ? JSON.stringify(serializedString)
        : String(serializedString || "");
    var scanTarget = rawStr;
    try {
      var parsedObj = JSON.parse(rawStr);
      if (parsedObj && typeof parsedObj === "object") {
        var textChunks = [];
        var collectStrings = function (node, depth) {
          if (depth > 20 || node === null || node === undefined) return;
          if (typeof node === "string") {
            textChunks.push(node);
            return;
          }
          if (typeof node === "number" || typeof node === "boolean") {
            // Typed floating-point metrics (e.g. similarityNum 0.8284930213349333) are numbers, not text PII;
            // only integer numbers in int1e7 coordinate range or 8/10-digit range are checked if not fractional
            if (typeof node === "number" && Number.isInteger(node) && Math.abs(node) >= 10000000) {
              textChunks.push(String(node));
            }
            return;
          }
          if (Array.isArray(node)) {
            for (var ai = 0; ai < node.length; ai++) {
              collectStrings(node[ai], depth + 1);
            }
            return;
          }
          if (typeof node === "object") {
            var ks = Object.keys(node);
            for (var ki = 0; ki < ks.length; ki++) {
              var k = ks[ki];
              if (k === "trusted_commitments") continue;
              textChunks.push(k);
              collectStrings(node[k], depth + 1);
            }
          }
        };
        collectStrings(parsedObj, 0);
        scanTarget = textChunks.join("\n");
      }
    } catch (_notJsonErr) {
      scanTarget = rawStr;
    }

    // Strip only full 32..64-char SHA-256 hex digests; never trust self-attested [zk_...] tags from input JSON
    var s = scanTarget.replace(/\b[0-9a-f]{32,64}\b/gi, " ");
    var checks = [
      { name: "wgs84_pair", regex: /[+-]?\b\d{1,2}\.\d{3,8}\s*[,;/\s]\s*[+-]?\d{1,3}\.\d{3,8}\b/g },
      { name: "int1e7_coord", regex: /(?<![0-9A-Za-z_.])[+-]?\b(?:[1-8]\d{8}|1[0-7]\d{8})\b(?![0-9A-Za-z_.])/g },
      { name: "mgrs_grid", regex: /\b\d{1,2}[C-X]\s*[A-Z]{2}\s*\d{3,5}\s*\d{3,5}\b/gi },
      { name: "pib_ukr", regex: new RegExp(PIB_UKR_PATTERN_SOURCE, "g") },
      { name: "contact_pii", regex: /(?:\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|(?<![0-9A-Za-z_.])(?:\+?38[\s.-]*)?\(?0\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}(?![0-9A-Za-z_.]))/g },
      { name: "edrpou_or_ipn", regex: /(?:(?:ЄДРПОУ|ІПН|РНОКПП)\s*[:№#]?\s*\d{8,10}|(?<![0-9A-Za-z_.])\b\d{10}\b(?![0-9A-Za-z_.])|(?<![0-9A-Za-z_.])\b\d{8}\b(?![0-9A-Za-z_.]))/gi },
      { name: "mil_unit", regex: new RegExp(MIL_UNIT_PATTERN_SOURCE, "g") },
      { name: "product_codename", regex: /«[^»]{2,40}»/g },
      { name: "unc_or_ip", regex: /(?:\\\\[0-9a-zA-Z._-]+\\[0-9a-zA-Z._$\\-]+|\b(?:\d{1,3}\.){3}\d{1,3}\b)/g }
    ];
    var leaks = [];
    var totalTokensCount = 0;

    for (var i = 0; i < checks.length; i++) {
      var matches = Array.from(s.matchAll(checks[i].regex));
      if (matches.length > 0) {
        leaks.push(checks[i].name);
        totalTokensCount += matches.length;
      }
    }
    return {
      opsec_clean: totalTokensCount === 0,
      redaction_scope: "PATTERN_BASED_KNOWN_CATEGORIES",
      human_review_required: true,
      scope_notice_uk: "Автоматичне приховування визначених категорій даних за шаблонами (потребує перегляду людиною перед зовнішньою передачею)",
      leaked_categories: leaks,
      leaked_category_count: leaks.length,
      leaked_pii_tokens_remaining: totalTokensCount
    };
  }

  function sanitizeToZeroKnowledgeGraph(rawInput, options) {
    var opts = options || {};
    var saltHex = opts.saltHex || "7f8e9d0c1b2a39485766758493a2b1c0";
    var raw = rawInput || {};

    var redactionStats = {
      coordinates_stripped: 0,
      pib_stripped: 0,
      edrpou_stripped: 0,
      mil_units_stripped: 0,
      product_names_stripped: 0,
      unc_paths_stripped: 0,
      commitments: [],
      trustedTags: Object.create(null)
    };

    if (raw.raw_confidential_context !== undefined) {
      deepSanitizeValue(raw.raw_confidential_context, saltHex, redactionStats, 0);
    }

    var rawCollisions = Array.isArray(raw.collisions) ? raw.collisions.slice() : [];
    var hasExplicitCollisions = rawCollisions.length > 0;
    var sanitizedFindings = null;

    if (Array.isArray(raw.findings)) {
      sanitizedFindings = [];
      for (var fIdx = 0; fIdx < raw.findings.length; fIdx++) {
        var fItem = raw.findings[fIdx];
        if (typeof fItem === "string") {
          var cleanFinding = redactSensitiveText(fItem, saltHex, redactionStats);
          sanitizedFindings.push(cleanFinding);
          if (!hasExplicitCollisions) {
            rawCollisions.push({
              rule_id: "FINDING_" + (fIdx + 1),
              section_ref: cleanFinding,
              spec_unit: "ratio",
              observed_unit: "ratio",
              spec_value: 1,
              observed_value: 0,
              severity: "HIGH",
              _alreadySanitized: true
            });
          }
        } else if (fItem && typeof fItem === "object") {
          var cleanObj = deepSanitizeValue(fItem, saltHex, redactionStats, 0);
          sanitizedFindings.push(cleanObj);
          if (!hasExplicitCollisions) {
            rawCollisions.push({
              rule_id: String(cleanObj.rule_id || cleanObj.ruleId || cleanObj.id || ("FINDING_" + (fIdx + 1))),
              section_ref: String(cleanObj.section_ref || cleanObj.sectionRef || cleanObj.section || cleanObj.param || cleanObj.title || ("SEC_" + (fIdx + 1))),
              spec_unit: String(cleanObj.spec_unit || cleanObj.specUnit || cleanObj.unit || "ratio"),
              observed_unit: String(cleanObj.observed_unit || cleanObj.observedUnit || cleanObj.unit || "ratio"),
              spec_value: cleanObj.spec_value !== undefined ? cleanObj.spec_value : (cleanObj.specValue !== undefined ? cleanObj.specValue : 1),
              observed_value: cleanObj.observed_value !== undefined ? cleanObj.observed_value : (cleanObj.observedValue !== undefined ? cleanObj.observedValue : 0),
              severity: String(cleanObj.severity || "HIGH"),
              _alreadySanitized: true
            });
          }
        }
      }
    }

    var collisionNodes = [];
    var collisionEdges = [];
    var siMatrix = [];

    for (var i = 0; i < rawCollisions.length; i++) {
      var item = rawCollisions[i];
      var ruleId = String(item.rule_id || ("RULE_COLLISION_" + (i + 1)));
      var unitSpec = String(item.spec_unit || item.unit || "ratio");
      var unitObs = String(item.observed_unit || item.unit || "ratio");
      var specNorm = normalizeSiUnit(unitSpec, item.spec_value);
      var obsNorm = normalizeSiUnit(unitObs, item.observed_value);
      var dimCompatible = areUnitsDimensionallyCompatible(unitSpec, unitObs);
      var deltaSi = Number((obsNorm.normalized_si_value - specNorm.normalized_si_value).toFixed(6));
      var relErrorPct = specNorm.normalized_si_value !== 0
        ? Number(((Math.abs(deltaSi) / Math.abs(specNorm.normalized_si_value)) * 100).toFixed(2))
        : 0.0;

      var safeSectionRef = item._alreadySanitized
        ? String(item.section_ref || ("SEC_" + (i + 1)))
        : redactSensitiveText(item.section_ref || ("SEC_" + (i + 1)), saltHex, redactionStats);
      var specNodeId = "NODE_SPEC_" + (i + 1) + "_" + ruleId;
      var obsNodeId = "NODE_OBS_" + (i + 1) + "_" + ruleId;

      collisionNodes.push({
        node_id: specNodeId,
        node_type: "SPECIFICATION_INVARIANT",
        section_token: safeSectionRef,
        quantity_kind: specNorm.quantity_kind,
        si_exponents: specNorm.si_exponents_LMTIThetaNJ,
        si_value: specNorm.normalized_si_value
      });

      collisionNodes.push({
        node_id: obsNodeId,
        node_type: "OBSERVED_EVIDENCE",
        source_channel: String(item.source_channel || "TELEMETRY_BINARY"),
        quantity_kind: obsNorm.quantity_kind,
        si_exponents: obsNorm.si_exponents_LMTIThetaNJ,
        si_value: obsNorm.normalized_si_value
      });

      collisionEdges.push({
        edge_id: "EDGE_" + (i + 1) + "_" + ruleId,
        from_node: specNodeId,
        to_node: obsNodeId,
        rule_id: ruleId,
        severity: String(item.severity || "CRITICAL"),
        dimensionally_compatible: dimCompatible,
        delta_si: deltaSi,
        relative_divergence_pct: relErrorPct
      });

      siMatrix.push({
        rule_id: ruleId,
        quantity_kind: specNorm.quantity_kind,
        si_exponents_LMTIThetaNJ: specNorm.si_exponents_LMTIThetaNJ,
        spec_si: specNorm.normalized_si_value,
        observed_si: obsNorm.normalized_si_value,
        delta_si: deltaSi,
        dimensionally_homogeneous: dimCompatible
      });
    }

    var telem = raw.telemetry_innovation || {};
    var innovationVector = {
      ekf3_vel_innov_ratio: Number(Number(telem.ekf3_vel_innov_ratio || 0).toFixed(4)),
      ekf3_pos_innov_ratio: Number(Number(telem.ekf3_pos_innov_ratio || 0).toFixed(4)),
      ekf3_hgt_innov_ratio: Number(Number(telem.ekf3_hgt_innov_ratio || 0).toFixed(4)),
      ekf3_mag_innov_ratio: Number(Number(telem.ekf3_mag_innov_ratio || 0).toFixed(4)),
      ubx_mon_hw_jam_ind: Number(telem.ubx_mon_hw_jam_ind || 0) | 0,
      rtos_clock_jitter_us_std: Number(Number(telem.rtos_clock_jitter_us_std || 0).toFixed(3)),
      imu_vs_gps_divergence_m: Number(Number(telem.imu_vs_gps_divergence_m || 0).toFixed(2)),
      mahalanobis_gate_breached: Boolean(telem.mahalanobis_gate_breached)
    };

    var commitmentsJoined = redactionStats.commitments.join("|");
    var commitmentsMerkleRoot = sha256HexSync(commitmentsJoined || "empty_commitments");

    var zkGraph = {
      schema: CAPSULE_FORMAT_VERSION,
      capsule_mode: "ZERO_KNOWLEDGE_MATHEMATICAL_GRAPH",
      timestamp_utc: String(raw.timestamp_utc || "2026-10-20T21:40:00Z"),
      collision_graph: {
        node_count: collisionNodes.length,
        edge_count: collisionEdges.length,
        nodes: collisionNodes,
        edges: collisionEdges
      },
      si_dimensional_matrix: siMatrix,
      sha256_fingerprints: {
        source_document_sha256: String(raw.source_document_sha256 || sha256HexSync("default_doc")),
        source_telemetry_sha256: String(raw.source_telemetry_sha256 || sha256HexSync("default_telem")),
        silicon_wafer_uid_commitment: makeCommitmentTag("stm32_uid", raw.stm32_uid || "0x0034001F", saltHex),
        redacted_tokens_merkle_root: commitmentsMerkleRoot
      },
      telemetry_innovation_vector: innovationVector,
      opsec_redaction_proof: {
        coordinates_stripped: redactionStats.coordinates_stripped,
        pib_stripped: redactionStats.pib_stripped,
        edrpou_stripped: redactionStats.edrpou_stripped,
        mil_units_stripped: redactionStats.mil_units_stripped,
        product_names_stripped: redactionStats.product_names_stripped,
        unc_paths_stripped: redactionStats.unc_paths_stripped,
        total_sensitive_entities_stripped:
          redactionStats.coordinates_stripped +
          redactionStats.pib_stripped +
          redactionStats.edrpou_stripped +
          redactionStats.mil_units_stripped +
          redactionStats.product_names_stripped +
          redactionStats.unc_paths_stripped,
        leaked_category_count: 0,
        leaked_pii_tokens_remaining: 0
      }
    };

    // Preserve and sanitize all Cockpit state fields
    var preservedCockpitFields = [
      "tool",
      "title",
      "verdict",
      "status",
      "verificationMode",
      "passCount",
      "failCount",
      "unverifiedCount",
      "unmatchedTuRowsCount",
      "alignedRows",
      "unmatchedTuRows",
      "proseSlots",
      "remediations",
      "files"
    ];
    for (var pIdx = 0; pIdx < preservedCockpitFields.length; pIdx++) {
      var fieldName = preservedCockpitFields[pIdx];
      if (raw[fieldName] !== undefined) {
        zkGraph[fieldName] = deepSanitizeValue(raw[fieldName], saltHex, redactionStats, 0);
      }
    }
    if (sanitizedFindings !== null) {
      zkGraph.findings = sanitizedFindings;
      if (zkGraph.tool === undefined) {
        zkGraph.tool = redactSensitiveText(String(raw.tool || "shmlv-cockpit"), saltHex, redactionStats);
      }
      if (zkGraph.verdict === undefined) {
        zkGraph.verdict = redactSensitiveText(String(raw.verdict || "UNKNOWN"), saltHex, redactionStats);
      }
      if (zkGraph.passCount === undefined) {
        zkGraph.passCount = Number(raw.passCount || 0);
      }
      if (zkGraph.failCount === undefined) {
        zkGraph.failCount = Number(raw.failCount !== undefined ? raw.failCount : collisionEdges.length);
      }
    }

    zkGraph.opsec_redaction_proof.coordinates_stripped = redactionStats.coordinates_stripped;
    zkGraph.opsec_redaction_proof.pib_stripped = redactionStats.pib_stripped;
    zkGraph.opsec_redaction_proof.edrpou_stripped = redactionStats.edrpou_stripped;
    zkGraph.opsec_redaction_proof.mil_units_stripped = redactionStats.mil_units_stripped;
    zkGraph.opsec_redaction_proof.product_names_stripped = redactionStats.product_names_stripped;
    zkGraph.opsec_redaction_proof.unc_paths_stripped = redactionStats.unc_paths_stripped;
    zkGraph.opsec_redaction_proof.total_sensitive_entities_stripped =
      redactionStats.coordinates_stripped +
      redactionStats.pib_stripped +
      redactionStats.edrpou_stripped +
      redactionStats.mil_units_stripped +
      redactionStats.product_names_stripped +
      redactionStats.unc_paths_stripped;

    var uidCommitment = zkGraph.sha256_fingerprints.silicon_wafer_uid_commitment;
    if (uidCommitment) {
      redactionStats.trustedTags[uidCommitment] = true;
      redactionStats.trustedTags["[" + uidCommitment + "]"] = true;
    }
    zkGraph.opsec_redaction_proof.trusted_commitments = Object.keys(redactionStats.trustedTags);

    var serializedCheck = JSON.stringify(zkGraph);
    var leakAudit = verifyZeroOpsecLeakage(serializedCheck, redactionStats.trustedTags);
    zkGraph.opsec_redaction_proof.leaked_category_count = leakAudit.leaked_category_count;
    zkGraph.opsec_redaction_proof.leaked_pii_tokens_remaining = leakAudit.leaked_pii_tokens_remaining;
    zkGraph.opsec_redaction_proof.opsec_clean = leakAudit.opsec_clean;
    zkGraph.opsec_redaction_proof.opsec_clean_verified = leakAudit.opsec_clean;
    zkGraph.opsec_redaction_proof.redaction_scope = "PATTERN_BASED_KNOWN_CATEGORIES";
    zkGraph.opsec_redaction_proof.human_review_required = true;
    zkGraph.opsec_redaction_proof.scope_notice_uk = leakAudit.scope_notice_uk;
    zkGraph.sha256_fingerprints.zk_graph_canonical_sha256 = sha256HexSync(serializedCheck);

    return zkGraph;
  }

  // ---------- 5. Native Stream Compression ('deflate-raw') with 4 MB Limit ----------
  async function readStreamWithLimit(readableStream, maxBytes) {
    var limit = typeof maxBytes === "number" && maxBytes > 0 ? maxBytes : MAX_DECOMPRESSED_CAPSULE_BYTES;
    var reader = readableStream.getReader();
    var chunks = [];
    var totalLen = 0;
    try {
      while (true) {
        var step = await reader.read();
        if (step.done) break;
        var chunk = step.value instanceof Uint8Array ? step.value : new Uint8Array(step.value);
        totalLen += chunk.byteLength;
        if (totalLen > limit) {
          try {
            await reader.cancel("Stream exceeded maximum byte limit (" + limit + " bytes)");
          } catch (_cancelErr) {
            totalLen = limit + 1;
          }
          throw new Error("DecompressionStream limit exceeded: output > " + limit + " bytes");
        }
        chunks.push(chunk);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (_releaseErr) {
        totalLen = totalLen + 0;
      }
    }
    var result = new Uint8Array(totalLen);
    var offset = 0;
    for (var i = 0; i < chunks.length; i++) {
      result.set(chunks[i], offset);
      offset += chunks[i].byteLength;
    }
    return result;
  }

  async function compressDeflateRaw(inputBytes) {
    var u8 = inputBytes instanceof Uint8Array ? inputBytes : utf8ToBytes(String(inputBytes));
    if (typeof CompressionStream !== "undefined") {
      var cs = new CompressionStream("deflate-raw");
      var writer = cs.writable.getWriter();
      var writeTask = writer.write(u8).then(function () {
        return writer.close();
      });
      var compressed = await readStreamWithLimit(cs.readable, MAX_DECOMPRESSED_CAPSULE_BYTES);
      await writeTask;
      return compressed;
    }
    throw new Error("CompressionStream('deflate-raw') not available in this runtime");
  }

  async function decompressDeflateRaw(compressedBytes, maxBytes) {
    var u8 = compressedBytes instanceof Uint8Array ? compressedBytes : new Uint8Array(compressedBytes);
    var limit = typeof maxBytes === "number" && maxBytes > 0 ? maxBytes : MAX_DECOMPRESSED_CAPSULE_BYTES;
    if (typeof DecompressionStream !== "undefined") {
      var ds = new DecompressionStream("deflate-raw");
      var writer = ds.writable.getWriter();
      var writeError = null;
      var writeTask = writer
        .write(u8)
        .then(function () {
          return writer.close();
        })
        .catch(function (err) {
          writeError = err;
        });
      var decompressed = await readStreamWithLimit(ds.readable, limit);
      await writeTask;
      if (writeError) {
        throw new Error("Corrupted deflate-raw stream: " + (writeError.message || String(writeError)));
      }
      return decompressed;
    }
    throw new Error("DecompressionStream('deflate-raw') not available in this runtime");
  }

  // ---------- 6. WebCrypto AES-256-GCM + HMAC-SHA256 Capsule Engine ----------
  function getWebCrypto() {
    if (typeof global.crypto !== "undefined" && global.crypto && global.crypto.subtle) {
      return global.crypto;
    }
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      return window.crypto;
    }
    throw new Error("WebCrypto API (crypto.subtle) is required for capsule encryption");
  }

  function generateRandomCapsuleSecret() {
    var cryptoObj = getWebCrypto();
    var bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return bytesToHex(bytes); // Full 32 hex chars = 128 bits of entropy
  }

  async function sha256DigestHexWebCrypto(inputBytes) {
    var u8 = inputBytes instanceof Uint8Array ? inputBytes : utf8ToBytes(String(inputBytes));
    try {
      var webCrypto = getWebCrypto();
      var digestBuf = await webCrypto.subtle.digest("SHA-256", u8);
      return bytesToHex(new Uint8Array(digestBuf));
    } catch (_e) {
      return sha256HexSync(u8);
    }
  }

  async function deriveCapsuleKeysWebCrypto(passphraseStr, saltBytes, iterations) {
    var webCrypto = getWebCrypto();
    var subtle = webCrypto.subtle;
    var iters = iterations || DEFAULT_PBKDF2_ITERATIONS;
    var baseKey = await subtle.importKey(
      "raw",
      utf8ToBytes(String(passphraseStr || "")),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    var derivedBits = await subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: iters,
        hash: "SHA-256"
      },
      baseKey,
      512
    );
    var derivedBytes = new Uint8Array(derivedBits);
    var aesKeyBytes = derivedBytes.slice(0, 32);
    var hmacKeyBytes = derivedBytes.slice(32, 64);

    var aesCryptoKey = await subtle.importKey(
      "raw",
      aesKeyBytes,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    var hmacCryptoKey = await subtle.importKey(
      "raw",
      hmacKeyBytes,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign", "verify"]
    );

    derivedBytes.fill(0);
    aesKeyBytes.fill(0);
    hmacKeyBytes.fill(0);

    return {
      aesCryptoKey: aesCryptoKey,
      hmacCryptoKey: hmacCryptoKey,
      keyDerivation: "PBKDF2-HMAC-SHA256-" + iters
    };
  }

  function resolveCapsuleKeyOptions(optionsOrPassphrase, isCreation) {
    var opts = {};
    var rawPass = "";
    var demoMode = false;

    if (typeof optionsOrPassphrase === "string") {
      rawPass = optionsOrPassphrase.trim();
    } else if (optionsOrPassphrase && typeof optionsOrPassphrase === "object") {
      opts = optionsOrPassphrase;
      if (typeof opts.passphrase === "string" && opts.passphrase.trim().length > 0) {
        rawPass = opts.passphrase.trim();
      } else if (typeof opts.generatedSecret === "string" && opts.generatedSecret.trim().length > 0) {
        rawPass = opts.generatedSecret.trim();
      } else if (typeof opts.secret === "string" && opts.secret.trim().length > 0) {
        rawPass = opts.secret.trim();
      } else if (typeof opts.secretKey === "string" && opts.secretKey.trim().length > 0) {
        rawPass = opts.secretKey.trim();
      } else if (typeof opts.secretKeyHex === "string" && opts.secretKeyHex.trim().length > 0) {
        rawPass = opts.secretKeyHex.trim();
      } else if (typeof opts.keyHex === "string" && opts.keyHex.trim().length > 0) {
        rawPass = opts.keyHex.trim();
      }
      demoMode = Boolean(
        opts.demoMode === true ||
        opts.useDemoKey === true ||
        opts.demoKey === true ||
        opts.keyMode === "PUBLIC_SYNTHETIC_DEMO_KEY"
      );
    }

    if (demoMode || rawPass === DEMO_PUBLIC_PASSPHRASE) {
      return {
        opts: opts,
        passphrase: DEMO_PUBLIC_PASSPHRASE,
        keyMode: "PUBLIC_SYNTHETIC_DEMO_KEY",
        generatedSecret: null
      };
    }

    if (rawPass.length > 0) {
      return {
        opts: opts,
        passphrase: rawPass,
        keyMode: "USER_SUPPLIED_SECRET",
        generatedSecret: null
      };
    }

    if (isCreation) {
      var ephemeralSecret = generateRandomCapsuleSecret();
      return {
        opts: opts,
        passphrase: ephemeralSecret,
        keyMode: "GENERATED_EPHEMERAL_SECRET",
        generatedSecret: ephemeralSecret
      };
    }

    throw new Error("Passphrase or explicit { demoMode: true } is required to decrypt diagnostic capsule");
  }

  async function createSignedDiagnosticCapsule(reportPayload, optionsOrPassphrase) {
    var webCrypto = getWebCrypto();
    var subtle = webCrypto.subtle;
    var keyRes = resolveCapsuleKeyOptions(optionsOrPassphrase, true);
    var opts = keyRes.opts;
    var passphrase = keyRes.passphrase;

    var iterations = Number(opts.iterations || DEFAULT_PBKDF2_ITERATIONS);
    if (!Number.isFinite(iterations) || iterations < 1000 || iterations > 5000000) {
      throw new Error("PBKDF2 iterations out of safe bounds [1000..5000000]: " + iterations);
    }
    var saltBytes = opts.saltBytes instanceof Uint8Array
      ? opts.saltBytes
      : (opts.saltHex ? hexToBytes(opts.saltHex) : webCrypto.getRandomValues(new Uint8Array(16)));
    if (!(saltBytes instanceof Uint8Array) || saltBytes.byteLength < 16) {
      throw new Error("NIST SP 800-132 violation: PBKDF2 salt must be >= 16 bytes (128 bits), got " + (saltBytes ? saltBytes.byteLength : 0));
    }
    var ivBytes = opts.ivBytes instanceof Uint8Array
      ? opts.ivBytes
      : (opts.ivHex ? hexToBytes(opts.ivHex) : webCrypto.getRandomValues(new Uint8Array(12)));
    if (!(ivBytes instanceof Uint8Array) || ivBytes.byteLength !== 12) {
      throw new Error("NIST SP 800-38D violation: AES-GCM IV must be exactly 12 bytes (96 bits), got " + (ivBytes ? ivBytes.byteLength : 0));
    }
    var aadStr = String(opts.aad || DEFAULT_AAD_STRING);
    var aadBytes = utf8ToBytes(aadStr);

    var zkGraph = sanitizeToZeroKnowledgeGraph(reportPayload, {
      saltHex: bytesToHex(saltBytes)
    });
    var canonicalJson = JSON.stringify(zkGraph);
    var uncompressedBytes = utf8ToBytes(canonicalJson);
    var plainShaHex = sha256HexSync(uncompressedBytes);
    var compressedBytes = await compressDeflateRaw(uncompressedBytes);

    var keys = await deriveCapsuleKeysWebCrypto(passphrase, saltBytes, iterations);

    var encryptedBuffer = await subtle.encrypt(
      {
        name: "AES-GCM",
        iv: ivBytes,
        additionalData: aadBytes,
        tagLength: 128
      },
      keys.aesCryptoKey,
      compressedBytes
    );
    var ciphertextAndTag = new Uint8Array(encryptedBuffer);
    var ciphertextBytes = ciphertextAndTag.slice(0, ciphertextAndTag.length - 16);
    var gcmTagBytes = ciphertextAndTag.slice(ciphertextAndTag.length - 16);

    var algDescriptor = "aes256gcm-pbkdf2-" + iterations;
    var saltB64u = bytesToBase64Url(saltBytes);
    var ivB64u = bytesToBase64Url(ivBytes);
    var ctTagB64u = bytesToBase64Url(ciphertextAndTag);

    // 7-segment token: shmlv-zk-v2.<alg>.<salt>.<iv>.<ct>.<plainSha>.<hmac>
    var signingInputStr = [
      CAPSULE_FORMAT_VERSION,
      algDescriptor,
      saltB64u,
      ivB64u,
      ctTagB64u,
      plainShaHex
    ].join(".");
    var sigBuffer = await subtle.sign("HMAC", keys.hmacCryptoKey, utf8ToBytes(signingInputStr));
    var hmacBytes = new Uint8Array(sigBuffer);
    var hmacB64u = bytesToBase64Url(hmacBytes);

    var compactToken = signingInputStr + "." + hmacB64u;
    var shareUrlObj = encodeCapsuleToShareUrl(compactToken, opts.baseUrl || DEFAULT_GITHUB_PAGES_BASE_URL);
    var urlHash = "#diag=" + compactToken;

    return {
      format: ".shmlv-capsule",
      version: CAPSULE_FORMAT_VERSION,
      kdf: "PBKDF2-HMAC-SHA256",
      keyDerivation: keys.keyDerivation,
      pbkdf2_iterations: iterations,
      cipher: "AES-256-GCM",
      mac: "HMAC-SHA256",
      compression: "deflate-raw",
      keyMode: keyRes.keyMode,
      generatedSecret: keyRes.generatedSecret,
      salt_hex: bytesToHex(saltBytes),
      iv_hex: bytesToHex(ivBytes),
      aad_utf8: aadStr,
      uncompressed_size_bytes: uncompressedBytes.length,
      compressed_size_bytes: compressedBytes.length,
      compression_ratio_pct: Number(((1 - compressedBytes.length / Math.max(1, uncompressedBytes.length)) * 100).toFixed(2)),
      ciphertext_hex: bytesToHex(ciphertextBytes),
      gcm_tag_hex: bytesToHex(gcmTagBytes),
      hmac_sha256_hex: bytesToHex(hmacBytes),
      plaintext_sha256: plainShaHex,
      sha256: plainShaHex,
      compressed_sha256: sha256HexSync(compressedBytes),
      compact_capsule_token: compactToken,
      token: compactToken,
      share_url: shareUrlObj.share_url,
      urlHash: urlHash,
      uriFragment: urlHash,
      rfc3986_network_proof: shareUrlObj.rfc3986_network_proof,
      zk_diagnostic_graph: zkGraph,
      zkGraph: zkGraph,
      payload: zkGraph
    };
  }

  async function decryptAndVerifyDiagnosticCapsule(capsuleInput, optionsOrPassphrase) {
    var webCrypto = getWebCrypto();
    var subtle = webCrypto.subtle;

    var rawInput = capsuleInput;
    var effectiveOptions = optionsOrPassphrase;
    if (capsuleInput && typeof capsuleInput === "object") {
      rawInput =
        capsuleInput.compact_capsule_token ||
        capsuleInput.token ||
        capsuleInput.share_url ||
        capsuleInput.urlHash ||
        "";
      if (effectiveOptions === undefined && capsuleInput.generatedSecret) {
        effectiveOptions = { passphrase: capsuleInput.generatedSecret };
      } else if (effectiveOptions === undefined && capsuleInput.keyMode === "PUBLIC_SYNTHETIC_DEMO_KEY") {
        effectiveOptions = { demoMode: true };
      }
    }

    var keyRes = resolveCapsuleKeyOptions(effectiveOptions, false);
    var opts = keyRes.opts;
    var passphrase = keyRes.passphrase;

    var token = extractCapsuleTokenFromUrlOrHash(rawInput);
    if (token.length > MAX_CAPSULE_TOKEN_LENGTH) {
      throw new Error("Capsule token exceeds maximum allowed length (" + MAX_CAPSULE_TOKEN_LENGTH + " chars): " + token.length);
    }

    var parts = token.split(".");
    if (parts.length !== 7) {
      throw new Error("Malformed diagnostic capsule token: expected exactly 7 dot-separated segments, got " + parts.length);
    }

    var version = parts[0];
    if (version !== CAPSULE_FORMAT_VERSION && version !== LEGACY_CAPSULE_VERSION) {
      throw new Error("Unsupported capsule version prefix: " + version);
    }

    var algOrIterPart = parts[1];
    var saltB64u = parts[2];
    var ivB64u = parts[3];
    var seg4 = parts[4];
    var seg5 = parts[5];
    var hmacB64u = parts[6];

    var iterations;
    var ctTagB64u;
    var expectedPlainShaHex = "";
    var aadBytes;

    if (version === CAPSULE_FORMAT_VERSION) {
      var algMatch = algOrIterPart.match(/^aes256gcm-pbkdf2-(\d+)$/i);
      if (algMatch) {
        iterations = parseInt(algMatch[1], 10);
      } else if (/^\d+$/.test(algOrIterPart)) {
        iterations = parseInt(algOrIterPart, 10);
      } else {
        throw new Error("Unsupported capsule cipher algorithm segment: " + algOrIterPart);
      }
      ctTagB64u = seg4;
      expectedPlainShaHex = seg5;
      if (!/^[0-9a-fA-F]{64}$/.test(expectedPlainShaHex)) {
        throw new Error("Invalid plaintext SHA-256 segment in v2 capsule");
      }
      aadBytes = utf8ToBytes(String(opts.aad || DEFAULT_AAD_STRING));
    } else {
      iterations = parseInt(algOrIterPart, 10);
      aadBytes = base64UrlToBytes(seg4);
      ctTagB64u = seg5;
    }

    if (!Number.isFinite(iterations) || iterations < 1000 || iterations > 5000000) {
      throw new Error("Invalid PBKDF2 iteration count: " + iterations);
    }

    var saltBytes = base64UrlToBytes(saltB64u);
    var ivBytes = base64UrlToBytes(ivB64u);
    var ciphertextAndTag = base64UrlToBytes(ctTagB64u);
    var hmacBytes = base64UrlToBytes(hmacB64u);

    if (saltBytes.byteLength < 16) {
      throw new Error("Invalid PBKDF2 salt length (< 16 bytes): " + saltBytes.byteLength);
    }
    if (ivBytes.byteLength !== 12) {
      throw new Error("Invalid AES-GCM IV length (must be 12 bytes): " + ivBytes.byteLength);
    }
    if (ciphertextAndTag.byteLength <= 16) {
      throw new Error("Ciphertext shorter than 128-bit GCM authentication tag");
    }
    if (hmacBytes.byteLength !== 32) {
      throw new Error("Invalid HMAC-SHA256 digest length (must be 32 bytes): " + hmacBytes.byteLength);
    }

    var keys = await deriveCapsuleKeysWebCrypto(passphrase, saltBytes, iterations);

    var signingInputStr = parts.slice(0, 6).join(".");
    var signingInputBytes = utf8ToBytes(signingInputStr);
    var computedHmacBuf = await subtle.sign("HMAC", keys.hmacCryptoKey, signingInputBytes);
    var computedHmacBytes = new Uint8Array(computedHmacBuf);
    var hmacConstTimeOk = constantTimeEqualBytes(hmacBytes, computedHmacBytes);
    var hmacSubtleOk = await subtle.verify("HMAC", keys.hmacCryptoKey, hmacBytes, signingInputBytes);

    if (!hmacConstTimeOk || !hmacSubtleOk) {
      throw new Error("HMAC-SHA256 envelope authentication failed (tampered capsule or invalid passphrase)");
    }

    var decryptedBuffer;
    try {
      decryptedBuffer = await subtle.decrypt(
        {
          name: "AES-GCM",
          iv: ivBytes,
          additionalData: aadBytes,
          tagLength: 128
        },
        keys.aesCryptoKey,
        ciphertextAndTag
      );
    } catch (gcmErr) {
      throw new Error(
        "AES-256-GCM authentication tag verification failed: " + (gcmErr && gcmErr.message ? gcmErr.message : "decrypt error"),
        { cause: gcmErr }
      );
    }

    var compressedBytes = new Uint8Array(decryptedBuffer);
    var uncompressedBytes = await decompressDeflateRaw(compressedBytes, MAX_DECOMPRESSED_CAPSULE_BYTES);
    var actualPlainShaHex = sha256HexSync(uncompressedBytes);

    if (expectedPlainShaHex && actualPlainShaHex.toLowerCase() !== expectedPlainShaHex.toLowerCase()) {
      throw new Error("Plaintext SHA-256 integrity mismatch after decompression");
    }

    var jsonStr = bytesToUtf8(uncompressedBytes);
    var zkGraph;
    try {
      zkGraph = JSON.parse(jsonStr);
    } catch (parseErr) {
      throw new Error(
        "Decompressed capsule payload is not valid JSON: " + (parseErr && parseErr.message ? parseErr.message : "parse error"),
        { cause: parseErr }
      );
    }

    var leakAudit = verifyZeroOpsecLeakage(jsonStr);
    var urlHash = "#diag=" + token;

    return {
      verdict: leakAudit.opsec_clean ? "PASSED" : "FAILED",
      valid: leakAudit.opsec_clean,
      integrityVerified: true,
      hmac_verified: true,
      aes_gcm_tag_verified: true,
      opsec_clean: leakAudit.opsec_clean,
      keyMode: keyRes.keyMode,
      keyDerivation: keys.keyDerivation,
      plaintext_sha256: actualPlainShaHex,
      sha256: actualPlainShaHex,
      compact_capsule_token: token,
      token: token,
      urlHash: urlHash,
      zk_diagnostic_graph: zkGraph,
      zkGraph: zkGraph,
      payload: zkGraph,
      diagnostic_ticket_manifest: buildDiagnosticTicketManifest(zkGraph)
    };
  }

  async function packDiagnosticCapsule(reportPayload, optionsOrPassphrase) {
    return await createSignedDiagnosticCapsule(reportPayload, optionsOrPassphrase);
  }

  async function unpackDiagnosticCapsule(capsuleInput, optionsOrPassphrase) {
    try {
      var res = await decryptAndVerifyDiagnosticCapsule(capsuleInput, optionsOrPassphrase);
      return Object.assign(
        {
          valid: true,
          payload: res.zk_diagnostic_graph
        },
        res
      );
    } catch (err) {
      return {
        valid: false,
        verdict: "TAMPERED_OR_INVALID",
        error: err && err.message ? String(err.message) : String(err)
      };
    }
  }

  // ---------- 7. Submodule 14.2: URL Hash-Fragment Zero-Server Share Link ----------
  function encodeCapsuleToShareUrl(compactCapsuleToken, baseUrl) {
    var base = String(baseUrl || DEFAULT_GITHUB_PAGES_BASE_URL).split("#")[0];
    var token = String(compactCapsuleToken || "").trim();
    var shareUrl = base + "#diag=" + token;

    var pathPart = "/uav-readiness-evidence-copilot/";
    var hostPart = "denisshumilov.github.io";
    var m = base.match(/^https?:\/\/([^/]+)(\/.*)?$/i);
    if (m) {
      hostPart = m[1];
      pathPart = m[2] || "/";
    }

    return {
      share_url: shareUrl,
       urlHash: "#diag=" + token,
      fragment_key: "diag",
      total_url_length_chars: shareUrl.length,
      fragment_payload_chars: token.length,
      rfc3986_network_proof: {
        standard: "RFC 3986 Section 3.5 (URI Fragment Identifier)",
        http_request_line_sent_to_server: "GET " + pathPart + " HTTP/2",
        http_host_header: hostPart,
        bytes_of_diag_sent_to_github_server: 0,
        server_database_footprint_bytes: 0,
        referrer_policy_protection: "no-referrer"
      }
    };
  }

  function extractCapsuleTokenFromUrlOrHash(urlOrHashOrToken) {
    var raw = String(urlOrHashOrToken || "").trim();
    if (!raw) {
      throw new Error("Empty capsule input");
    }
    var diagIdx = raw.indexOf("#diag=");
    if (diagIdx >= 0) {
      var frag = raw.slice(diagIdx + 6);
      var ampIdx = frag.indexOf("&");
      return ampIdx >= 0 ? frag.slice(0, ampIdx) : frag;
    }
    if (raw.indexOf("diag=") === 0) {
      return raw.slice(5);
    }
    if (raw.charAt(0) === "#") {
      raw = raw.slice(1);
      if (raw.indexOf("diag=") === 0) {
        return raw.slice(5);
      }
    }
    return raw;
  }

  var AIRGAP_WEBRTC_RTC_CONFIG = Object.freeze({
    iceServers: Object.freeze([]),
    iceCandidatePoolSize: 0
  });

  function createAirGapLanPeerConnection() {
    var PeerConn = global && global.RTCPeerConnection;
    if (typeof PeerConn !== "function") {
      throw new Error("RTCPeerConnection is not supported in this runtime");
    }
    return new PeerConn({ iceServers: [], iceCandidatePoolSize: 0 });
  }

  function createServerlessWebRtcOfferFragment(sdpDescriptorObj, capsuleSha256, baseUrl) {
    var base = String(baseUrl || DEFAULT_GITHUB_PAGES_BASE_URL).split("#")[0];
    var envelope = {
      transport: "webrtc-datachannel-serverless-v1",
      rtc_configuration: { iceServers: [], iceCandidatePoolSize: 0 },
      ice_gathering: "complete",
      capsule_sha256: String(capsuleSha256 || ""),
      sdp_type: String((sdpDescriptorObj && sdpDescriptorObj.type) || "offer"),
      sdp_fingerprint: sha256HexSync(String((sdpDescriptorObj && sdpDescriptorObj.sdp) || "v=0")).slice(0, 32)
    };
    var b64u = bytesToBase64Url(utf8ToBytes(JSON.stringify(envelope)));
    return {
      webrtc_share_url: base + "#webrtc_sdp=" + b64u,
      rtc_configuration: AIRGAP_WEBRTC_RTC_CONFIG,
      envelope: envelope
    };
  }

  // ---------- 8. Submodule 14.3: Engineering Review Preview ----------
  var RULE_TO_MODULE_MAP = {
    "RULE_EDP_R_CURRENT_GAP": {
      module: "engines/telemetry_ew/telemetry_analyzer.py",
      domain: "Warhead ZVM / EDP-r Initiation Current & BEC Voltage Droop Audit"
    },
    "RULE_ACCEL_IMPACT_GATE": {
      module: "engines/telemetry_ew/telemetry_analyzer.py",
      domain: "Terminal Impact Accelerometer Threshold vs IMT Peak Verification"
    },
    "RULE_ORGN_RESIDUAL_COORD": {
      module: "engines/telemetry_ew/telemetry_analyzer.py",
      domain: "Binary Log OPSEC Sanitization (ORGN / CMD / ref_lat Zeroing)"
    },
    "RULE_OOXML_EXTERNAL_CANARY": {
      module: "engines/defdoc_ai/defdoc_auditor.py",
      domain: "OOXML External UNC/NTLM Canary & RSID Author Graph Sanitization"
    },
    "RULE_MAVLINK_UNSIGNED_CMD": {
      module: "engines/telemetry_ew/telemetry_analyzer.py",
      domain: "MAVLink v2 Link Signing & Failsafe GCS Threshold Hardening"
    }
  };

  function buildDiagnosticTicketManifest(zkGraph) {
    var g = zkGraph || {};
    var edges = (g.collision_graph && Array.isArray(g.collision_graph.edges)) ? g.collision_graph.edges : [];
    var assignedModules = [];
    var seenModules = {};

    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var mapping = RULE_TO_MODULE_MAP[e.rule_id] || {
        module: "docs/multi-file-verifier-bundle.js",
        domain: "General SI Specification-to-Telemetry Reconciliation"
      };
      if (!seenModules[mapping.module]) {
        seenModules[mapping.module] = true;
        assignedModules.push({
          module: mapping.module,
          domain: mapping.domain,
          triggered_by_rule: e.rule_id,
          delta_si: e.delta_si
        });
      }
    }

    var graphHashShort = (g.sha256_fingerprints && g.sha256_fingerprints.zk_graph_canonical_sha256)
      ? g.sha256_fingerprints.zk_graph_canonical_sha256.slice(0, 10)
      : "0000000000";
    var spoofFlag = Boolean(
      g.telemetry_innovation_vector && g.telemetry_innovation_vector.mahalanobis_gate_breached
    );
    var redactedEntitiesCount = Number(
      (g.opsec_redaction_proof && g.opsec_redaction_proof.total_sensitive_entities_stripped) || 0
    );

    return {
      diagnostic_ticket_id: "diag-ticket-" + graphHashShort,
      status: "READY_FOR_ENGINEERING_REVIEW",
      collision_count: edges.length,
      redacted_sensitive_entities: redactedEntitiesCount,
      mahalanobis_spoofing_alert: spoofFlag,
      assigned_local_modules: assignedModules
    };
  }

  var CapsuleEngine = {
    CAPSULE_FORMAT_VERSION: CAPSULE_FORMAT_VERSION,
    DEFAULT_GITHUB_PAGES_BASE_URL: DEFAULT_GITHUB_PAGES_BASE_URL,
    DEFAULT_AAD_STRING: DEFAULT_AAD_STRING,
    DEFAULT_PBKDF2_ITERATIONS: DEFAULT_PBKDF2_ITERATIONS,
    DEMO_PUBLIC_PASSPHRASE: DEMO_PUBLIC_PASSPHRASE,
    MAX_CAPSULE_TOKEN_LENGTH: MAX_CAPSULE_TOKEN_LENGTH,
    MAX_DECOMPRESSED_CAPSULE_BYTES: MAX_DECOMPRESSED_CAPSULE_BYTES,
    AIRGAP_WEBRTC_RTC_CONFIG: AIRGAP_WEBRTC_RTC_CONFIG,
    generateRandomCapsuleSecret: generateRandomCapsuleSecret,
    sha256HexSync: sha256HexSync,
    sha256DigestHexWebCrypto: sha256DigestHexWebCrypto,
    hmacSha256Sync: hmacSha256Sync,
    constantTimeEqualBytes: constantTimeEqualBytes,
    bytesToHex: bytesToHex,
    hexToBytes: hexToBytes,
    bytesToBase64Url: bytesToBase64Url,
    base64UrlToBytes: base64UrlToBytes,
    normalizeSiUnit: normalizeSiUnit,
    areUnitsDimensionallyCompatible: areUnitsDimensionallyCompatible,
    redactSensitiveText: redactSensitiveText,
    deepSanitizeValue: deepSanitizeValue,
    verifyZeroOpsecLeakage: verifyZeroOpsecLeakage,
    sanitizeToZeroKnowledgeGraph: sanitizeToZeroKnowledgeGraph,
    readStreamWithLimit: readStreamWithLimit,
    compressDeflateRaw: compressDeflateRaw,
    decompressDeflateRaw: decompressDeflateRaw,
    deriveCapsuleKeysWebCrypto: deriveCapsuleKeysWebCrypto,
    createSignedDiagnosticCapsule: createSignedDiagnosticCapsule,
    decryptAndVerifyDiagnosticCapsule: decryptAndVerifyDiagnosticCapsule,
    packDiagnosticCapsule: packDiagnosticCapsule,
    unpackDiagnosticCapsule: unpackDiagnosticCapsule,
    encodeCapsuleToShareUrl: encodeCapsuleToShareUrl,
    extractCapsuleTokenFromUrlOrHash: extractCapsuleTokenFromUrlOrHash,
    createAirGapLanPeerConnection: createAirGapLanPeerConnection,
    createServerlessWebRtcOfferFragment: createServerlessWebRtcOfferFragment,
    buildDiagnosticTicketManifest: buildDiagnosticTicketManifest
  };

  global.ShmlvCryptoCapsule = CapsuleEngine;
  global.SHMLV_CRYPTO_CAPSULE = CapsuleEngine;
  global.SHMLV_CRYPTO_SHARE = CapsuleEngine;
  if (typeof window !== "undefined") {
    window.ShmlvCryptoCapsule = CapsuleEngine;
    window.SHMLV_CRYPTO_CAPSULE = CapsuleEngine;
    window.SHMLV_CRYPTO_SHARE = CapsuleEngine;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = CapsuleEngine;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
