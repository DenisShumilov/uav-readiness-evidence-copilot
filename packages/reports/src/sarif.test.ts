import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildEvidenceGraphFromBundle } from "@uav-readiness/evidence";
import { parseDemoBundle } from "@uav-readiness/parsers";
import { evaluateReadiness } from "@uav-readiness/rules";
import { generateReadinessSarif } from "./sarif";

function buildInputs() {
  const bundle = parseDemoBundle();
  const graph = buildEvidenceGraphFromBundle(bundle, "2026-06-06T00:00:00.000Z");
  const assessment = evaluateReadiness(bundle);
  return { bundle, graph, assessment };
}

describe("generateReadinessSarif", () => {
  it("produces valid SARIF 2.1.0 with a named tool and results", () => {
    const { bundle, graph, assessment } = buildInputs();
    const sarif = JSON.parse(generateReadinessSarif(bundle, graph, assessment));

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe(
      "uav-readiness-evidence-copilot"
    );
    expect(sarif.runs[0].results.length).toBeGreaterThan(0);
  });

  it("maps locked claims to SARIF errors and every result has a location", () => {
    const { bundle, graph, assessment } = buildInputs();
    const sarif = JSON.parse(generateReadinessSarif(bundle, graph, assessment));
    const results = sarif.runs[0].results;
    const errors = results.filter((r: { level: string }) => r.level === "error");

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((r: { ruleId: string }) => r.ruleId === "DOC-LOCK-001")).toBe(
      true
    );
    expect(
      results.every(
        (r: {
          locations: Array<{
            physicalLocation: { artifactLocation: { uri: string } };
          }>;
        }) => r.locations[0].physicalLocation.artifactLocation.uri.length > 0
      )
    ).toBe(true);
  });

  it("uses the provided example directory in result URIs and flags conflicts", () => {
    const bundle = parseDemoBundle(
      join(process.cwd(), "examples", "demo-conflict-readiness")
    );
    const graph = buildEvidenceGraphFromBundle(
      bundle,
      "2026-06-06T00:00:00.000Z"
    );
    const assessment = evaluateReadiness(bundle);
    const sarif = JSON.parse(
      generateReadinessSarif(
        bundle,
        graph,
        assessment,
        "examples/demo-conflict-readiness/"
      )
    );
    const results = sarif.runs[0].results;

    expect(
      results.some((r: { ruleId: string }) => r.ruleId === "EVID-CONFLICT-001")
    ).toBe(true);
    expect(
      results.every(
        (r: {
          locations: Array<{
            physicalLocation: { artifactLocation: { uri: string } };
          }>;
        }) =>
          r.locations[0].physicalLocation.artifactLocation.uri.startsWith(
            "examples/demo-conflict-readiness/"
          )
      )
    ).toBe(true);
  });
});
