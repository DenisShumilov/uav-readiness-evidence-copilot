import { createServer, type Server } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".p7s": "application/pkcs7-signature",
  ".bin": "application/octet-stream",
  ".ulg": "application/octet-stream",
  ".tlog": "application/octet-stream",
  ".ubx": "application/octet-stream"
};

let server: Server;
let baseUrl = "";
let browser: Browser;

beforeAll(async () => {
  const docsRoot = join(process.cwd(), "docs");
  server = createServer((req, res) => {
    const reqUrl = new URL(req.url || "/", "http://127.0.0.1");
    let relPath = decodeURIComponent(reqUrl.pathname);
    if (relPath === "/") relPath = "/index.html";
    const safeRel = normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
    let fullPath = join(docsRoot, safeRel);
    if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
      fullPath = join(fullPath, "index.html");
    }
    if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    const ext = extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Service-Worker-Allowed": "/"
    });
    res.end(readFileSync(fullPath));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Failed to bind local HTTP server");
  }
  baseUrl = `http://127.0.0.1:${addr.port}`;
  browser = await chromium.launch({ headless: true });
}, 30000);

afterAll(async () => {
  if (browser) await browser.close();
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("Sector A15 Layer 2 — Real Headless Chromium E2E Suite", () => {
  it("Group 1: loads all catalog pages without console/page errors, runs Presets 1..5 in Cockpit, and executes live N=3 15-case benchmark", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    const pagesToVisit = [
      "/index.html",
      "/tools/doc-auditor.html",
      "/tools/cross-verify.html",
      "/tools/telemetry-analyzer.html",
      "/tools/cyber-forensics.html",
      "/tools/opsec-sanitizer.html",
      "/tools/readiness-matrix.html",
      "/tools/zero-trust-sandbox.html",
      "/tools/universal-ai-cockpit.html"
    ];

    for (const rel of pagesToVisit) {
      const resp = await page.goto(`${baseUrl}${rel}`, { waitUntil: "domcontentloaded" });
      expect(resp?.status()).toBe(200);
    }

    // Sequentially click Presets 1..5 in Universal AI Cockpit
    for (const presetBtnId of [
      "#btnWow11Preset1",
      "#btnWow11Preset2",
      "#btnWow11Preset3",
      "#btnWow11Preset4",
      "#btnWow11Preset5"
    ]) {
      await page.click(presetBtnId);
      await page.waitForTimeout(80);
      const rowCount = await page.locator("#wow11AlignmentBody tr").count();
      expect(rowCount).toBeGreaterThan(0);
    }

    // Check 4-column table headers on Preset 5
    const thTexts = await page.locator("#wow11AlignmentBody").locator("..").locator("thead th").allTextContents();
    expect(thTexts).toEqual([
      "Параметр",
      "Результат / статус",
      "Джерела",
      "Наступна дія"
    ]);

    // Run live N=3 15-case benchmark on readiness-matrix.html
    await page.goto(`${baseUrl}/tools/readiness-matrix.html`, { waitUntil: "domcontentloaded" });
    await page.click('[data-real-sample="sample-full-package-15files"]');
    await page.waitForFunction(
      () => {
        const el = document.getElementById("localCheckResult");
        return Boolean(el && el.textContent && el.textContent.includes("15/15"));
      },
      { timeout: 15000 }
    );
    const benchText = (await page.locator("#localCheckResult").textContent()) || "";
    expect(benchText).toContain("15/15");
    expect(benchText).toContain("Предметний вердикт входу");
    expect(benchText).toContain("Звірка з еталоном (Тест)");

    expect(errors).toEqual([]);
    await context.close();
  }, 30000);

  it("Group 2: negative file uploads via setInputFiles return UNVERIFIED / 0/100 and never return false PASS or 100/100", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    // 2.1: readiness-matrix.html with 0-byte CSV, header-only CSV, and "не підтверджено" row
    await page.goto(`${baseUrl}/tools/readiness-matrix.html`, { waitUntil: "domcontentloaded" });

    // 0-byte file
    await page.locator("#localFileInput").setInputFiles({
      name: "empty.csv",
      mimeType: "text/csv",
      buffer: Buffer.alloc(0)
    });
    await page.waitForTimeout(100);
    const emptyMatrixText = (await page.locator("#localCheckResult").textContent()) || "";
    expect(emptyMatrixText).toContain("0/100");
    expect(emptyMatrixText).toContain("UNVERIFIED");
    expect(emptyMatrixText).not.toContain("100/100");

    // Header-only CSV
    await page.locator("#localFileInput").setInputFiles({
      name: "header_only.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("\uFEFFВимога,Джерело,Статус\n", "utf8")
    });
    await page.waitForTimeout(100);
    const headerMatrixText = (await page.locator("#localCheckResult").textContent()) || "";
    expect(headerMatrixText).toContain("0/100");
    expect(headerMatrixText).toContain("UNVERIFIED");

    // Row with "не підтверджено"
    await page.locator("#localFileInput").setInputFiles({
      name: "unconfirmed.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Вимога,Джерело,Статус\nТяга двигуна,Протокол №1,не підтверджено\n", "utf8")
    });
    await page.waitForTimeout(100);
    const unconfText = (await page.locator("#localCheckResult").textContent()) || "";
    expect(unconfText).toContain("0/100");
    expect(unconfText).toContain("UNVERIFIED");

    // 2.2: opsec-sanitizer.html with whitespace-only file
    await page.goto(`${baseUrl}/tools/opsec-sanitizer.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#localFileInput").setInputFiles({
      name: "spaces.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("   \n\t  ", "utf8")
    });
    await page.waitForTimeout(100);
    const opsecEmptyText = (await page.locator("#localCheckResult").textContent()) || "";
    expect(opsecEmptyText).toContain("UNVERIFIED");

    // 2.3: zero-trust-sandbox.html with corrupted .p7s
    await page.goto(`${baseUrl}/tools/zero-trust-sandbox.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#localFileInput").setInputFiles({
      name: "corrupted_sign.p7s",
      mimeType: "application/pkcs7-signature",
      buffer: Buffer.from([0x30, 0x80, 0x01, 0x02])
    });
    await page.waitForTimeout(100);
    const badKepText = (await page.locator("#localCheckResult").textContent()) || "";
    expect(badKepText).toContain("FAIL");

    // 2.4: Cockpit with single 2-column .docx without a second file -> SINGLE_SOURCE_UNVERIFIED (0 PASS)
    await page.goto(`${baseUrl}/tools/universal-ai-cockpit.html`, { waitUntil: "domcontentloaded" });
    const docxBytes = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      return Array.from(w.getRealSampleBytes("prozorro_matrice4t_docx") as Uint8Array);
    });
    await page.locator("#wow11FileInput").setInputFiles({
      name: "single_spec.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from(docxBytes)
    });
    await page.waitForTimeout(150);
    const summaryText = (await page.locator("#wow11AlignmentSummary").textContent()) || "";
    expect(summaryText).toContain("Збігається (PASS): 0");
    expect(summaryText).toContain("UNVERIFIED");

    await context.close();
  }, 25000);

  it("Group 3: #diag= crypto capsule roundtrip in a clean browser.newContext() restores state and detects 1-char ciphertext tampering", async () => {
    const context1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page1 = await context1.newPage();
    await page1.goto(`${baseUrl}/tools/universal-ai-cockpit.html`, { waitUntil: "domcontentloaded" });

    // Generate capsule with 32-hex secret
    const capsuleInfo = await page1.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const cap = await w.generateAndVerifyZeroServerCryptoUri({
        baseUrl: `${window.location.origin}/tools/universal-ai-cockpit.html`
      });
      return {
        shareUrl: cap.share_url as string,
        secretKey: (cap.generatedSecret || cap.secret_key_hex) as string
      };
    });

    expect(capsuleInfo.secretKey).toMatch(/^[0-9a-f]{32}$/);
    expect(capsuleInfo.shareUrl).toContain("#diag=shmlv-zk-v2.");

    // Open in a brand-new isolated browser context
    const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await context2.newPage();
    await page2.goto(capsuleInfo.shareUrl, { waitUntil: "domcontentloaded" });
    await page2.waitForTimeout(150);

    // Supply the 32-hex secret key and click Decrypt
    await page2.fill("#wow11IncomingSecretKeyInput", capsuleInfo.secretKey);
    await page2.click("#btnWow11DecryptIncomingDiag");
    await page2.waitForFunction(() => {
      const tbody = document.getElementById("wow11AlignmentBody");
      return Boolean(
        tbody &&
          tbody.textContent &&
          tbody.textContent.includes("Доступний збережений витяг; вихідний файл не передано")
      );
    });

    const restoredTableText = (await page2.locator("#wow11AlignmentBody").textContent()) || "";
    expect(restoredTableText).toContain("Доступний збережений витяг; вихідний файл не передано");

    // Mutate 1 character in the ciphertext segment of #diag= and open in a 3rd clean context
    const [basePart, hashPart] = capsuleInfo.shareUrl.split("#diag=");
    const segs = hashPart.split(".");
    segs[4] = (segs[4][0] === "A" ? "B" : "A") + segs[4].slice(1);
    const tamperedUrl = `${basePart}#diag=${segs.join(".")}`;

    const context3 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page3 = await context3.newPage();
    await page3.goto(tamperedUrl, { waitUntil: "domcontentloaded" });
    await page3.fill("#wow11IncomingSecretKeyInput", capsuleInfo.secretKey);
    await page3.click("#btnWow11DecryptIncomingDiag");
    await page3.waitForTimeout(150);

    const detailsText = (await page3.locator("#wow11CryptoTelemetryDetails").textContent()) || "";
    expect(detailsText).toContain("VERIFIER_ERROR");

    // Verify Tool 07 (zero-trust-sandbox.html) #btnApplyDiagHashNow demo roundtrip succeeds without passphrase error
    await page1.goto(`${baseUrl}/tools/zero-trust-sandbox.html`, { waitUntil: "domcontentloaded" });
    await page1.click('[data-real-sample="sample-encrypted-diag-capsule"]');
    await page1.waitForSelector("#btnApplyDiagHashNow", { state: "attached" });
    await page1.click("#btnApplyDiagHashNow");
    await page1.waitForFunction(() => {
      const box = document.getElementById("localCheckResult");
      return Boolean(box && box.textContent && box.textContent.includes("КАПСУЛУ #diag= ВЕРИФІКОВАНО"));
    });
    const tool07CapsuleText = (await page1.locator("#localCheckResult").textContent()) || "";
    expect(tool07CapsuleText).toContain("КАПСУЛУ #diag= ВЕРИФІКОВАНО");
    expect(tool07CapsuleText).not.toContain("ПОМИЛКА ВЕРИФІКАЦІЇ КАПСУЛИ");

    await context1.close();
    await context2.close();
    await context3.close();
  }, 25000);

  it("Group 4: verifies report download (waitForEvent('download')), XSS neutrality, and CSV formula injection escaping", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    let dialogFired = false;
    page.on("dialog", async (d) => {
      dialogFired = true;
      await d.dismiss();
    });

    await page.goto(`${baseUrl}/tools/universal-ai-cockpit.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(100);

    const downloadPromise = page.waitForEvent("download");
    await page.click("#btnWow11DownloadAutoFix");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("uav_verification_checklist_and_report.md");

    // Test XSS & CSV formula escaping via exportAlignmentMatrixCsv and DOM rendering
    const csvOutput = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const verifier = w.SHMLV_MULTIFILE_VERIFIER;
      const customState = {
        alignedRows: [
          {
            tuParam: "=CMD|' /C calc'!A0 <img src=x onerror=alert(1)>",
            tuValue: "-20 °C",
            targetParam: "Температура",
            targetValue: "=1+1",
            tuSource: "+evil.docx",
            targetSource: "evil.xlsx",
            siDimension: "[°C]",
            status: "FAIL_VALUE_CONFLICT",
            deltaExplain: "-20 °C vs +40 °C",
            remediationHint: { requiredValue: "=HYPERLINK(\"http://evil\")" }
          }
        ],
        blockedByPhysicsSamples: []
      };
      verifier.renderModuleBAlignmentMatrix(customState);
      return {
        csv: verifier.exportAlignmentMatrixCsv(customState) as string,
        negCell: verifier.sanitizeCsvCell("-20 °C") as string,
        formulaCell: verifier.sanitizeCsvCell("=SUM(A1:A2)") as string
      };
    });

    expect(dialogFired).toBe(false);
    expect(csvOutput.formulaCell).toBe("'=SUM(A1:A2)");
    expect(csvOutput.negCell).toBe("-20 °C");
    expect(csvOutput.csv).toContain("'=CMD");
    expect(csvOutput.csv).toContain("'+evil.docx");
    expect(csvOutput.csv).toContain("'=HYPERLINK");
    expect(csvOutput.csv).toContain("-20 °C");

    await context.close();
  }, 20000);

  it("Group 5: verifies responsive layout (320px, 375px, 768px, 1280px) without horizontal overflow, filter toggle, and keyboard focus restoration", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    for (const rel of ["/index.html", "/tools/universal-ai-cockpit.html"]) {
      await page.goto(`${baseUrl}${rel}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(80);
      for (const vp of [
        { width: 320, height: 640 },
        { width: 375, height: 812 },
        { width: 768, height: 1024 },
        { width: 1280, height: 800 }
      ]) {
        await page.setViewportSize(vp);
        await page.waitForTimeout(40);
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth - document.documentElement.clientWidth;
        });
        expect(overflow).toBeLessThanOrEqual(2);
      }
    }

    // Filter toggle button in Cockpit
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.click("#btnWow11Preset1");
    await page.waitForTimeout(80);

    const counterBefore = (await page.locator("#matrixHiddenPassCounter").textContent()) || "";
    expect(counterBefore).toContain("Приховано підтверджених збігів (PASS): 0");

    await page.click("#btnToggleMatrixFilter");
    const counterAfter = (await page.locator("#matrixHiddenPassCounter").textContent()) || "";
    expect(counterAfter).not.toContain("Приховано підтверджених збігів (PASS): 0");

    // Keyboard accessibility: focus .source-excerpt-btn, open modal with Enter, close with Escape, verify focus restored
    await page.click("#btnToggleMatrixFilter"); // show all rows again
    const firstExcerptBtn = page.locator("#wow11AlignmentBody .source-excerpt-btn").first();
    await firstExcerptBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(50);

    const modalVisible = await page.evaluate(() => {
      const m = document.getElementById("wow11SourceExcerptModal");
      return Boolean(m && m.style.display !== "none");
    });
    expect(modalVisible).toBe(true);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(50);

    const focusRestored = await page.evaluate(() => {
      const active = document.activeElement;
      return Boolean(active && active.classList.contains("source-excerpt-btn"));
    });
    expect(focusRestored).toBe(true);

    await context.close();
  }, 25000);

  it("Group 6: registers Service Worker coi-airgap-enclave-sw.js, reports precache status, and reloads page in offline mode", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/tools/universal-ai-cockpit.html`, { waitUntil: "domcontentloaded" });

    const swReady = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await navigator.serviceWorker.register("../coi-airgap-enclave-sw.js");
      await navigator.serviceWorker.ready;
      return Boolean(reg.active || reg.installing || reg.waiting);
    });
    expect(swReady).toBe(true);

    // Reload once while online so SW controls the page and caches requests
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);

    // Switch context to offline and verify reload succeeds from Service Worker cache
    await context.setOffline(true);
    const offlineResp = await page.reload({ waitUntil: "domcontentloaded" });
    expect(offlineResp?.status()).toBe(200);
    const title = await page.title();
    expect(title).toContain("shmlv systems");

    await context.setOffline(false);
    await context.close();
  }, 25000);
});
