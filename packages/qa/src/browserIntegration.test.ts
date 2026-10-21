import { join } from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let multiVerifier: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ocrEngine: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cryptoShare: any;
let getRealSampleBytes: (key: string) => Uint8Array;

beforeAll(async () => {
  await import(pathToFileURL(join(process.cwd(), "docs", "real-samples-bundle.js")).href);
  await import(pathToFileURL(join(process.cwd(), "docs", "multi-file-verifier-bundle.js")).href);
  await import(pathToFileURL(join(process.cwd(), "docs", "pdf-scan-ocr-engine.js")).href);
  await import(pathToFileURL(join(process.cwd(), "docs", "encrypted-report-share.js")).href);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  getRealSampleBytes = g.getRealSampleBytes || g.window?.getRealSampleBytes;
  multiVerifier = g.SHMLV_MULTI_FILE_VERIFIER || g.window?.SHMLV_MULTI_FILE_VERIFIER;
  ocrEngine = g.SHMLV_WASM_RASTER_OCR || g.window?.SHMLV_WASM_RASTER_OCR;
  cryptoShare =
    g.SHMLV_CRYPTO_SHARE ||
    g.ShmlvCryptoCapsule ||
    g.window?.SHMLV_CRYPTO_SHARE ||
    g.window?.ShmlvCryptoCapsule;
});

describe("Sector A15 Layer 1 — Anti-Substitution & Browser Engine Integration Tests", () => {
  it("Anti-Substitution #1: mutating <c r=\"C31\"> to <c r=\"C42\"> in sheet1.xml updates the parsed source cell coordinate to C42", () => {
    const xlsxBytes = getRealSampleBytes("prozorro_protocol_xlsx");
    expect(xlsxBytes.byteLength).toBeGreaterThan(1000);

    const entries = multiVerifier.unpackZipEntriesSync(xlsxBytes) as Array<{
      name: string;
      data: Uint8Array;
    }>;
    const mutatedEntries = entries.map((e) => {
      if (e.name === "xl/worksheets/sheet1.xml") {
        const xmlText = new TextDecoder("utf-8").decode(e.data);
        expect(xmlText).toContain('r="C31"');
        const mutatedXml = xmlText.replace(/r="C31"/g, 'r="C42"');
        return {
          name: e.name,
          data: new TextEncoder().encode(mutatedXml)
        };
      }
      return e;
    });

    const parsed = multiVerifier.parseXlsxFromEntries(mutatedEntries, "mutated_protocol.xlsx");
    const refs = parsed.protocolItems.map(
      (item: { factRef?: string; cellRef?: string }) => item.factRef || item.cellRef
    );
    expect(refs).toContain("C42");
    expect(refs).not.toContain("C31");
  });

  it("Anti-Substitution #2: renaming and reversing uploaded file order [b.xlsx, a.docx] still detects cross-document collisions", () => {
    const tuBytes = getRealSampleBytes("prozorro_matrice4t_docx");
    const pmvBytes = getRealSampleBytes("prozorro_protocol_xlsx");

    const reversedState = multiVerifier.analyzeFileBatchSync(
      [
        { filename: "b.xlsx", bytes: pmvBytes },
        { filename: "a.docx", bytes: tuBytes }
      ],
      "reversed_neutral_names"
    );

    expect(reversedState.verificationMode).toBe("CROSS_DOCUMENT");
    expect(reversedState.alignedRows.length).toBeGreaterThanOrEqual(5);
    const conflictRows = reversedState.alignedRows.filter((r: { status: string }) =>
      String(r.status).includes("FAIL")
    );
    expect(conflictRows.length).toBeGreaterThanOrEqual(2);
  });

  it("Anti-Substitution #3: uploading two identical copies of a single file under different names [tu.docx, pmv.docx] flags DUPLICATE_FILE_SHA256 and never returns PASS (100/100)", () => {
    const tuBytes = getRealSampleBytes("prozorro_matrice4t_docx");

    const dupState = multiVerifier.analyzeFileBatchSync(
      [
        { filename: "tu.docx", bytes: tuBytes },
        { filename: "pmv.docx", bytes: new Uint8Array(tuBytes) }
      ],
      "duplicate_sha256_test"
    );

    expect(dupState.files.some((f: { isDuplicate?: boolean }) => f.isDuplicate === true)).toBe(
      true
    );
    expect(
      dupState.extraRemediations.some(
        (rem: { code?: string }) => rem.code === "DUPLICATE_FILE_SHA256"
      )
    ).toBe(true);
    expect(dupState.verificationMode).toBe("SINGLE_SOURCE_UNVERIFIED");

    const passRows = dupState.alignedRows.filter(
      (r: { status: string }) => r.status === "PASS" || r.status === "UNIT_CONVERTED_PASS"
    );
    expect(passRows.length).toBe(0);
    expect(
      dupState.alignedRows.every((r: { status: string }) => r.status === "UNVERIFIED")
    ).toBe(true);
  });

  it("Anti-Substitution #4: mutating pixel text in raster PDF scan ('16.20 В' instead of '14.76 В') dynamically recognizes '16.20 В' and computes +1.44 В delta", () => {
    const customSpecRows = ocrEngine.PROTOCOL_SPEC_ROWS.map(
      (row: {
        rowIndex: number;
        parameter: string;
        normTu: string;
        factPmv: string;
        deltaStatus: string;
        overlappedByWetStamp: boolean;
      }) => {
        if (String(row.parameter).toLowerCase().includes("напруга")) {
          return {
            ...row,
            normTu: "14.76 В",
            factPmv: "16.20 В"
          };
        }
        return row;
      }
    );

    const mutatedPdfBytes = ocrEngine.buildStampedRasterScanPdfBytes(customSpecRows);
    const ocrReport = ocrEngine.runFullStampedPdfOcrPipeline(mutatedPdfBytes);

    expect(ocrReport.rows).toHaveLength(5);
    const voltageRow = ocrReport.rows.find((r: { parameter: string }) =>
      String(r.parameter).toLowerCase().includes("напруга")
    );
    expect(voltageRow).toBeDefined();
    expect(voltageRow.factPmv).toBe("16.20 В");
    expect(voltageRow.status).toBe("FAIL");
    expect(voltageRow.deltaStatus).toContain("+1.44");
    expect(voltageRow.deltaStatus).not.toContain("+0.64");
    expect(voltageRow.bbox).toMatchObject({
      page: 1,
      x: 12,
      width: 536,
      height: 24
    });

    // Corrupted / truncated PDF must be rejected without silent fallback
    const rejected = ocrEngine.runFullStampedPdfOcrPipeline(
      new TextEncoder().encode("%PDF-1.4\n%%EOF")
    );
    expect(rejected.verdict).toBe("REJECTED_UNSUPPORTED_OR_CORRUPTED_SCAN");
    expect(rejected.status).toBe("UNVERIFIED");
    expect(rejected.rows).toHaveLength(0);
  });

  it("Sector A07: ASN.1 DER CMS SignedData parser validates real .p7s structure, marks cryptoStatus as UNVERIFIED, and rejects malformed DER/BER", () => {
    const realKepBytes = getRealSampleBytes("prozorro_kep_p7s");
    const parsedReal = multiVerifier.parseP7sSignature(realKepBytes, "08_Prozorro_Real_KEP_Sign.p7s");

    expect(parsedReal.structuralStatus).toBe("PASS");
    expect(parsedReal.cryptoStatus).toBe("UNVERIFIED");
    expect(parsedReal.cryptoDisclaimer).toContain("UNVERIFIED_CRYPTO");

    // Fake DER with PKCS#7 OID inside OCTET STRING (0x04) must fail with missing_signed_data_oid
    const fakeOidInOctetString = new Uint8Array([
      0x30, 0x0d, 0x04, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02, 0x05, 0x00
    ]);
    const fakeParsed = multiVerifier.parseCmsSignedDataDer(fakeOidInOctetString);
    expect(fakeParsed.valid).toBe(false);
    expect(fakeParsed.reasonCode).toBe("missing_signed_data_oid");

    // Indefinite length BER (0x80) must fail with unsupported_ber
    const berIndefinite = new Uint8Array([0x30, 0x80, 0x00, 0x00]);
    const berParsed = multiVerifier.parseCmsSignedDataDer(berIndefinite);
    expect(berParsed.valid).toBe(false);
    expect(berParsed.reasonCode).toBe("unsupported_ber");

    // Trailing garbage bytes after root SEQUENCE must fail with trailing_bytes
    const withTrailing = new Uint8Array(realKepBytes.length + 2);
    withTrailing.set(realKepBytes, 0);
    withTrailing[realKepBytes.length] = 0xde;
    withTrailing[realKepBytes.length + 1] = 0xad;
    const trailingParsed = multiVerifier.parseCmsSignedDataDer(withTrailing);
    expect(trailingParsed.valid).toBe(false);
    expect(trailingParsed.reasonCode).toBe("trailing_bytes");

    // 53-byte dummy DER without RFC 5652 SignedData fields (version, digestAlgorithms, encapContentInfo, signerInfos) must FAIL
    const dummy53 = Uint8Array.from(
      Buffer.from(
        "303306092a864886f70d010702a0263024302206035504030c1bd09fd0b5d182d180d0be20d086d0b2d0b0d0bdd0b5d0bdd0bad0be",
        "hex"
      )
    );
    const dummyParsed = multiVerifier.parseP7sSignature(dummy53, "dummy.p7s");
    expect(dummyParsed.validPkcs7).toBe(false);
    expect(dummyParsed.structuralStatus).toBe("FAIL");

    // Mutating SignerInfo.sid serial number so it no longer matches the embedded certificate must FAIL with unmatched_signer_sid
    const realParsedDer = multiVerifier.parseCmsSignedDataDer(realKepBytes);
    expect(realParsedDer.sidMatched).toBe(true);
    const certSerialHex = realParsedDer.certificates[0].serialHex.toLowerCase();
    const serialByteLen = certSerialHex.length / 2;
    const sidHeaderHex = "02" + serialByteLen.toString(16).padStart(2, "0") + certSerialHex;
    const rawDerBuf =
      realKepBytes[0] === 0x30
        ? Buffer.from(realKepBytes)
        : Buffer.from(Buffer.from(realKepBytes).toString("utf8").replace(/\s+/g, ""), "base64");
    const realHex = rawDerBuf.toString("hex").toLowerCase();
    const firstIdx = realHex.indexOf(sidHeaderHex);
    const secondIdx = realHex.indexOf(sidHeaderHex, firstIdx + 2);
    expect(secondIdx).toBeGreaterThan(firstIdx);
    const mutatedBytes = new Uint8Array(rawDerBuf);
    mutatedBytes[secondIdx / 2 + 2] ^= 0xff;
    const mutatedParsed = multiVerifier.parseP7sSignature(mutatedBytes, "mutated_sid.p7s");
    expect(mutatedParsed.validPkcs7).toBe(false);
    expect(mutatedParsed.structuralStatus).toBe("FAIL");
    expect(mutatedParsed.reasonCode).toBe("unmatched_signer_sid");
    expect(mutatedParsed.signerCn).toBe("unknown");
    expect(mutatedParsed.edrpou).toBe("unknown");
  });

  it("Sector A09 & A10.4: 7-segment shmlv-zk-v2 capsule encrypts with 32-hex secret, strips PII tokens via matchAll, and rejects 1-byte tampering", async () => {
    const secret = cryptoShare.generateRandomCapsuleSecret();
    expect(secret).toMatch(/^[0-9a-f]{32}$/);

    // Verify 2-word Ukrainian PIB, phone number, and email redaction + explicit scope notice
    const contactSanitized = cryptoShare.sanitizeToZeroKnowledgeGraph({
      findings: [
        {
          note: "Контакт: Петро Іваненко, тел. +380501234567, email test@firma.ua"
        }
      ]
    });
    const sanitizedNote = String(contactSanitized.findings[0].note);
    expect(sanitizedNote).not.toContain("Петро Іваненко");
    expect(sanitizedNote).not.toContain("+380501234567");
    expect(sanitizedNote).not.toContain("test@firma.ua");
    expect(sanitizedNote).toContain("[zk_person_pib:");
    expect(sanitizedNote).toContain("[zk_contact_pii:");
    expect(contactSanitized.opsec_redaction_proof.leaked_pii_tokens_remaining).toBe(0);
    expect(contactSanitized.opsec_redaction_proof.redaction_scope).toBe(
      "PATTERN_BASED_KNOWN_CATEGORIES"
    );
    expect(contactSanitized.opsec_redaction_proof.human_review_required).toBe(true);

    const rawPayload = {
      title: "Перевірка комплексу «Перун-М» в/ч А1234",
      verdict: "REQUIRES_ENGINEERING_REVISION",
      status: "FAIL",
      verificationMode: "CROSS_DOCUMENT",
      passCount: 5,
      failCount: 2,
      unverifiedCount: 0,
      alignedRows: [
        {
          parameter: "Стандартна напруга АКБ",
          tuParam: "Стандартна напруга АКБ",
          tuValue: "14.76 В",
          targetValue: "15.40 В",
          status: "FAIL_VALUE_CONFLICT"
        }
      ],
      findings: [
        {
          rule_id: "VOLT_MISMATCH",
          section_ref: "Координати 50.450100, 30.523400 та 49.839700, 24.029700, ЄДРПОУ 12345678, Іваненко Іван Іванович",
          severity: "CRITICAL"
        }
      ]
    };

    const capsule = await cryptoShare.createSignedDiagnosticCapsule(rawPayload);
    expect(capsule.keyMode).toBe("GENERATED_EPHEMERAL_SECRET");
    expect(capsule.generatedSecret).toMatch(/^[0-9a-f]{32}$/);
    expect(capsule.compact_capsule_token.split(".")).toHaveLength(7);
    expect(capsule.compact_capsule_token.startsWith("shmlv-zk-v2.")).toBe(true);
    expect(capsule.zk_diagnostic_graph.opsec_redaction_proof.leaked_pii_tokens_remaining).toBe(0);
    expect(capsule.zk_diagnostic_graph.alignedRows).toHaveLength(1);

    // Decrypting without passphrase or demoMode must throw
    await expect(
      cryptoShare.decryptAndVerifyDiagnosticCapsule(capsule.share_url, {})
    ).rejects.toThrow();

    // Decrypting with the generated 32-hex secret succeeds
    const verified = await cryptoShare.decryptAndVerifyDiagnosticCapsule(capsule.share_url, {
      passphrase: capsule.generatedSecret
    });
    expect(verified.verdict).toBe("PASSED");
    expect(verified.zk_diagnostic_graph.alignedRows).toHaveLength(1);

    // Mutating 1 character in the ciphertext segment must reject
    const segs = capsule.compact_capsule_token.split(".");
    const ctSeg = segs[4];
    const flippedChar = ctSeg[0] === "A" ? "B" : "A";
    segs[4] = flippedChar + ctSeg.slice(1);
    const tamperedToken = segs.join(".");
    await expect(
      cryptoShare.decryptAndVerifyDiagnosticCapsule(tamperedToken, {
        passphrase: capsule.generatedSecret
      })
    ).rejects.toThrow();

    // Multi-token PII count in verifyZeroOpsecLeakage uses matchAll
    const multiLeak = cryptoShare.verifyZeroOpsecLeakage(
      "Точка 1: 50.450100, 30.523400; Точка 2: 49.839700, 24.029700; в/ч А1234 та в/ч А5678"
    );
    expect(multiLeak.opsec_clean).toBe(false);
    expect(multiLeak.leaked_category_count).toBe(2);
    expect(multiLeak.leaked_pii_tokens_remaining).toBe(4);

    // Standalone 2-word Ukrainian name without "Контакт:" prefix must be redacted
    const standaloneNameSanitized = cryptoShare.sanitizeToZeroKnowledgeGraph({
      title: "Петро Іваненко"
    });
    expect(standaloneNameSanitized.title).toMatch(/^\[zk_person_pib:[0-9a-f]{16}\]$/);
    expect(standaloneNameSanitized.opsec_redaction_proof.pib_stripped).toBe(1);
    expect(standaloneNameSanitized.opsec_redaction_proof.opsec_clean).toBe(true);
    expect(standaloneNameSanitized.opsec_redaction_proof.leaked_pii_tokens_remaining).toBe(0);

    // Own [zk_<category>:<16hex>] commitment tags ending in a\d{4} must NOT trigger false-positive mil_unit leak
    const ownTagCheck = cryptoShare.verifyZeroOpsecLeakage("[zk_uav_product:c7ab511111ca2308]");
    expect(ownTagCheck.opsec_clean).toBe(true);
    expect(ownTagCheck.leaked_pii_tokens_remaining).toBe(0);

    // User-injected spoofed [zk_...] token containing a phone number must NOT be trusted:
    // sanitizeToZeroKnowledgeGraph rewrites untrusted [zk_...] and strips the phone number inside
    const spoofedZkSanitized = cryptoShare.sanitizeToZeroKnowledgeGraph({
      title: "[zk_contact_pii:0501234567]"
    });
    expect(String(spoofedZkSanitized.title)).not.toContain("0501234567");
    expect(String(spoofedZkSanitized.title)).toContain("[untrusted_zk_contact_pii:[zk_contact_pii:");
    expect(spoofedZkSanitized.opsec_redaction_proof.pib_stripped).toBe(1);
    expect(spoofedZkSanitized.opsec_redaction_proof.total_sensitive_entities_stripped).toBe(1);
    expect(spoofedZkSanitized.opsec_redaction_proof.opsec_clean).toBe(true);
    expect(spoofedZkSanitized.opsec_redaction_proof.leaked_pii_tokens_remaining).toBe(0);

    // Raw unverified [zk_contact_pii:0501234567] passed directly to verifyZeroOpsecLeakage must fail,
    // even if the caller tries to spoof opsec_redaction_proof.trusted_commitments inside the JSON string
    const rawSpoofedLeak = cryptoShare.verifyZeroOpsecLeakage(
      '{"title":"[zk_contact_pii:0501234567]","opsec_redaction_proof":{"trusted_commitments":["[zk_contact_pii:0501234567]"]}}'
    );
    expect(rawSpoofedLeak.opsec_clean).toBe(false);
    expect(rawSpoofedLeak.leaked_pii_tokens_remaining).toBeGreaterThanOrEqual(1);

    // Floating-point numbers like 0.8284930213349333 or 0.41885390829169544 must NOT trigger false-positive phone/edrpou leaks
    const floatPrecisionCheck = cryptoShare.verifyZeroOpsecLeakage(
      JSON.stringify({
        alignedRows: [
          { similarityNum: 0.8284930213349333, note: "score=0.41885390829169544" }
        ]
      })
    );
    expect(floatPrecisionCheck.opsec_clean).toBe(true);
    expect(floatPrecisionCheck.leaked_pii_tokens_remaining).toBe(0);

    // Deterministic salt "3fa34a33aa9b72791a35f44188212af2" that produces a2308 in zk_uav_product must pass cleanly
    const capsuleFixedSalt = await cryptoShare.createSignedDiagnosticCapsule(rawPayload, {
      saltHex: "3fa34a33aa9b72791a35f44188212af2"
    });
    expect(capsuleFixedSalt.zk_diagnostic_graph.opsec_redaction_proof.opsec_clean).toBe(true);
    expect(capsuleFixedSalt.zk_diagnostic_graph.opsec_redaction_proof.leaked_pii_tokens_remaining).toBe(0);
  });

  it("Sector A04 & A18: rejects .p7s outer [0] EXPLICIT (0xA0 -> 0xA1) mutation and verifies Preset 1 Before (45 PASS / 2 FAIL at C31, C48) vs After Remediation (47 PASS / 0 FAIL)", async () => {
    const mfv = multiVerifier as {
      parseCmsSignedDataDer: (bytes: Uint8Array) => {
        valid: boolean;
        validPkcs7: boolean;
        structuralStatus: string;
        reasonCode: string;
      };
      runPreset1RealProzorroMatrice4T: (docxBytes: Uint8Array, xlsxBytes: Uint8Array) => {
        alignedRows: Array<{
          status: string;
          tuRef?: string | null;
          targetRef?: string | null;
          tuValue?: string;
          targetValue?: string;
        }>;
        unmatchedTuRows?: Array<{
          tuParam: string;
          tuValue: string;
          tuRef: string;
          status: string;
        }>;
      };
      runPreset1RemediatedProzorroMatrice4T: (docxBytes: Uint8Array, xlsxBytes: Uint8Array) => {
        alignedRows: Array<{ status: string; targetRef?: string | null }>;
        unmatchedTuRows?: Array<{
          tuParam: string;
          tuValue: string;
          tuRef: string;
          status: string;
        }>;
      };
    };

    const realP7sBase64 = readFileSync(
      join(process.cwd(), "docs", "real-samples", "08_Prozorro_Real_KEP_Sign.p7s"),
      "utf8"
    ).replace(/\s+/g, "");
    const realDer = new Uint8Array(Buffer.from(realP7sBase64, "base64"));
    const validParsed = mfv.parseCmsSignedDataDer(realDer);
    expect(validParsed.valid).toBe(true);
    expect(validParsed.structuralStatus).toBe("PASS");

    // Mutate outer ContentInfo [0] EXPLICIT tag 0xA0 -> 0xA1 (immediately after signedData OID 06 09 2A 86 48 86 F7 0D 01 07 02)
    const mutatedOuterTagDer = new Uint8Array(realDer);
    let a0Offset = -1;
    for (let i = 0; i + 11 < mutatedOuterTagDer.length; i++) {
      if (
        mutatedOuterTagDer[i] === 0x06 &&
        mutatedOuterTagDer[i + 1] === 0x09 &&
        mutatedOuterTagDer[i + 2] === 0x2a &&
        mutatedOuterTagDer[i + 10] === 0x02 &&
        mutatedOuterTagDer[i + 11] === 0xa0
      ) {
        a0Offset = i + 11;
        break;
      }
    }
    expect(a0Offset).toBeGreaterThan(0);
    mutatedOuterTagDer[a0Offset] = 0xa1;
    const rejectedOuterTag = mfv.parseCmsSignedDataDer(mutatedOuterTagDer);
    expect(rejectedOuterTag.valid).toBe(false);
    expect(rejectedOuterTag.validPkcs7).toBe(false);
    expect(rejectedOuterTag.structuralStatus).toBe("FAIL");
    expect(rejectedOuterTag.reasonCode).toBe("invalid_signed_data_structure");

    // Mutate SignedData.version INTEGER 1 (02 01 01) -> 127 (02 01 7F) and verify RFC 5652 CMSVersion bounds reject it
    const mutatedVersionDer = new Uint8Array(realDer);
    let versionValueOffset = -1;
    for (let i = a0Offset; i + 4 < mutatedVersionDer.length; i++) {
      if (
        mutatedVersionDer[i] === 0x02 &&
        mutatedVersionDer[i + 1] === 0x01 &&
        mutatedVersionDer[i + 2] === 0x01
      ) {
        versionValueOffset = i + 2;
        break;
      }
    }
    expect(versionValueOffset).toBeGreaterThan(a0Offset);
    mutatedVersionDer[versionValueOffset] = 0x7f;
    const rejectedVersion = mfv.parseCmsSignedDataDer(mutatedVersionDer);
    expect(rejectedVersion.valid).toBe(false);
    expect(rejectedVersion.validPkcs7).toBe(false);
    expect(rejectedVersion.structuralStatus).toBe("FAIL");

    // Verify Preset 1 Before (45 PASS / 2 FAIL in C31 and C48 + 5 unmatchedTuRows) vs After Remediation (47 PASS / 0 FAIL)
    const docx06Bytes = new Uint8Array(
      readFileSync(join(process.cwd(), "docs", "real-samples", "06_Prozorro_UAV_TechVymogy_DJI_Matrice_4T.docx"))
    );
    const xlsx07Bytes = new Uint8Array(
      readFileSync(join(process.cwd(), "docs", "real-samples", "07_Prozorro_UAV_Protocol_DJI_Matrice_4T.xlsx"))
    );

    const beforeState = mfv.runPreset1RealProzorroMatrice4T(docx06Bytes, xlsx07Bytes);
    expect(beforeState.alignedRows).toHaveLength(47);
    const beforeFails = beforeState.alignedRows.filter((r) => r.status.startsWith("FAIL"));
    expect(beforeFails).toHaveLength(2);
    expect(beforeFails.map((r) => r.targetRef).sort()).toEqual(["C31", "C48"]);
    expect(beforeFails.map((r) => r.tuRef)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("w:tr 36 (запис ТТХ #31)"),
        expect.stringContaining("w:tr 56 (запис ТТХ #48)")
      ])
    );
    expect(beforeState.unmatchedTuRows).toBeDefined();
    expect(beforeState.unmatchedTuRows).toHaveLength(5);
    expect(beforeState.unmatchedTuRows?.[0]?.tuValue).toContain("55 комплект");
    expect(beforeState.unmatchedTuRows?.[0]?.status).toBe("UNVERIFIED_UNPAIRED_TU_ROW");

    const afterState = mfv.runPreset1RemediatedProzorroMatrice4T(docx06Bytes, xlsx07Bytes);
    expect(afterState.alignedRows).toHaveLength(47);
    const afterFails = afterState.alignedRows.filter((r) => r.status.startsWith("FAIL"));
    const afterPasses = afterState.alignedRows.filter(
      (r) => r.status === "PASS" || r.status === "UNIT_CONVERTED_PASS"
    );
    expect(afterFails).toHaveLength(0);
    expect(afterPasses).toHaveLength(47);
    expect(afterState.unmatchedTuRows).toHaveLength(5);

    // Verify CSV export includes both 47 paired rows and 5 unmatched TU rows (1 header + 52 rows = 53 lines)
    const csvExportFn = (multiVerifier as { exportAlignmentMatrixCsv: (s: unknown) => string }).exportAlignmentMatrixCsv;
    const fullCsvLines = csvExportFn(afterState).trim().split("\n");
    expect(fullCsvLines).toHaveLength(53);

    // Verify full Preset 1 capsule roundtrip preserves all 5 unmatchedTuRows and passes OPSEC cleanly (no float false-positive)
    const fullPresetCapsule = await cryptoShare.createSignedDiagnosticCapsule(afterState);
    expect(fullPresetCapsule.zk_diagnostic_graph.opsec_redaction_proof.opsec_clean).toBe(true);
    expect(fullPresetCapsule.zk_diagnostic_graph.opsec_redaction_proof.leaked_pii_tokens_remaining).toBe(0);
    const verifiedPresetCapsule = await cryptoShare.decryptAndVerifyDiagnosticCapsule(
      fullPresetCapsule.share_url,
      { passphrase: fullPresetCapsule.generatedSecret }
    );
    expect(verifiedPresetCapsule.opsec_clean).toBe(true);
    expect(verifiedPresetCapsule.verdict).toBe("PASSED");
    expect(verifiedPresetCapsule.zk_diagnostic_graph.alignedRows).toHaveLength(47);
    expect(verifiedPresetCapsule.zk_diagnostic_graph.unmatchedTuRows).toHaveLength(5);
  });

  it("Sector A02.2 & Document Semantics Regression: tools-engine.js compute() returns 0/44 and both engines reject text mismatch ('червоний' vs 'синій'), 3D dimension vector mismatch ('260.6 × 113.7 × 138.4 мм' vs '260.6 × 999 × 138.4 мм'), and flag incomplete multi-condition ('100 Вт ... 82 Вт' vs '100 Вт') as UNVERIFIED", async () => {
    const toolsEngineSrc = readFileSync(join(process.cwd(), "docs", "tools-engine.js"), "utf8");
    const extractBalanced = (start: RegExp, open: string, close: string): string => {
      const m = toolsEngineSrc.match(start);
      if (!m || m.index === undefined) throw new Error(`Piece not found: ${start}`);
      let depth = 0;
      let i = toolsEngineSrc.indexOf(open, m.index);
      for (; i < toolsEngineSrc.length; i++) {
        if (toolsEngineSrc[i] === open) depth++;
        else if (toolsEngineSrc[i] === close && --depth === 0) {
          return toolsEngineSrc.slice(m.index, i + 1);
        }
      }
      throw new Error(`Unbalanced: ${start}`);
    };

    const ceiling = toolsEngineSrc.match(/var CONFLICT_CEILING\s*=\s*\d+;/);
    const program = [
      extractBalanced(/var SOURCES\s*=\s*\[/, "[", "]"),
      extractBalanced(/var CLAIMS\s*=\s*\[/, "[", "]"),
      "var state = {}; SOURCES.forEach(function (s) { state[s.id] = false; });",
      extractBalanced(/function statusOf\(/, "{", "}"),
      extractBalanced(/var DEDUCTIONS\s*=\s*\{/, "{", "}"),
      ceiling![0],
      extractBalanced(/function cappedDeduction\(/, "{", "}"),
      extractBalanced(/function compute\(/, "{", "}"),
      "return compute();"
    ].join("\n");

    const zeroResult = new Function(program)() as { score: number; v: number; p: number };
    expect(zeroResult.v).toBe(0);
    expect(zeroResult.p).toBe(0);
    expect(zeroResult.score).toBe(0);

    await import(pathToFileURL(join(process.cwd(), "docs", "tools-engine.js")).href);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    const compareSpecPair = g.compareSpecPair || g.window?.compareSpecPair;
    expect(typeof compareSpecPair).toBe("function");

    // 1. Route A: multi-file-verifier-bundle.js (runNeuroSymbolicCrossAlignment)
    const negTu = [
      { paramName: "Колір корпусу", rawValue: "червоний", normRef: "w:tr 1", sourceFile: "tu.docx" },
      { paramName: "Габарити коробки", rawValue: "260.6 × 113.7 × 138.4 мм", normRef: "w:tr 2", sourceFile: "tu.docx" },
      {
        paramName: "Потужність зарядки",
        rawValue: "Загальна потужність 100 Вт, додатково не більше 82 Вт на кожен порт за вказаних умов",
        normRef: "w:tr 3",
        sourceFile: "tu.docx"
      }
    ];
    const negPmv = [
      { paramName: "Колір корпусу", rawValue: "синій", factRef: "C1", sourceFile: "pmv.xlsx" },
      { paramName: "Габарити коробки", rawValue: "260.6 × 999 × 138.4 мм", factRef: "C2", sourceFile: "pmv.xlsx" },
      { paramName: "Потужність зарядки", rawValue: "100 Вт", factRef: "C3", sourceFile: "pmv.xlsx" }
    ];
    const negAligned = multiVerifier.runNeuroSymbolicCrossAlignment(negTu, negPmv).alignedRows as Array<{
      tuParam: string;
      status: string;
    }>;
    expect(negAligned).toHaveLength(3);
    expect(negAligned.find((r) => r.tuParam === "Колір корпусу")?.status).toBe("FAIL_VALUE_CONFLICT");
    expect(negAligned.find((r) => r.tuParam === "Габарити коробки")?.status).toBe("FAIL_VALUE_CONFLICT");
    expect(negAligned.find((r) => r.tuParam === "Потужність зарядки")?.status).toBe("UNVERIFIED");

    // Positive controls on Route A
    const posPmv = [
      { paramName: "Колір корпусу", rawValue: "червоний", factRef: "C1", sourceFile: "pmv.xlsx" },
      { paramName: "Габарити коробки", rawValue: "26.06 × 11.37 × 13.84 см", factRef: "C2", sourceFile: "pmv.xlsx" }
    ];
    const posAligned = multiVerifier.runNeuroSymbolicCrossAlignment(negTu.slice(0, 2), posPmv).alignedRows as Array<{
      tuParam: string;
      status: string;
    }>;
    expect(posAligned.find((r) => r.tuParam === "Колір корпусу")?.status).toBe("PASS");
    expect(posAligned.find((r) => r.tuParam === "Габарити коробки")?.status).toBe("UNIT_CONVERTED_PASS");

    // 2. Route B: tools-engine.js (compareSpecPair)
    expect(compareSpecPair("Колір корпусу", "червоний", "синій", ["tu.docx", "pmv.xlsx"]).status).toBe("FAIL");
    expect(compareSpecPair("Колір корпусу", "червоний", "червоний", ["tu.docx", "pmv.xlsx"]).status).toBe("PASS");
    expect(
      compareSpecPair("Габарити коробки", "260.6 × 113.7 × 138.4 мм", "260.6 × 999 × 138.4 мм", ["tu.docx", "pmv.xlsx"])
        .status
    ).toBe("FAIL");
    expect(
      compareSpecPair("Габарити коробки", "260.6 × 113.7 × 138.4 мм", "26.06 × 11.37 × 13.84 см", ["tu.docx", "pmv.xlsx"])
        .status
    ).toBe("PASS");
    expect(
      compareSpecPair(
        "Потужність зарядки",
        "Загальна потужність 100 Вт, додатково не більше 82 Вт на кожен порт за вказаних умов",
        "100 Вт",
        ["tu.docx", "pmv.xlsx"]
      ).status
    ).toBe("UNVERIFIED");
  });
});
