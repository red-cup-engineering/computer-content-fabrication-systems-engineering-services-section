import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import manifest from "../../package.json" with { type: "json" };

const root = fileURLToPath(new URL("../../", import.meta.url));

test("the published archive resolves under its repository's package name and takes a chart order", () => {
  assert.equal(manifest.repository.url, `git+https://github.com/${manifest.name.slice(1)}.git`);
  const consumer = mkdtempSync(join(tmpdir(), "content-fabrication-consumer-"));
  try {
    const [packed] = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", consumer], {
      cwd: root,
      encoding: "utf8",
    }));
    assert.equal(packed.name, manifest.name);
    const destination = join(consumer, "node_modules", manifest.name);
    mkdirSync(destination, { recursive: true });
    execFileSync("tar", ["-xzf", join(consumer, packed.filename), "-C", destination, "--strip-components=1"]);
    // Resolve only the dependencies already installed from the producer's frozen lockfile.
    symlinkSync(join(root, "node_modules"), join(destination, "node_modules"), "junction");

    const request = { buyer: { id: "package-consumer" }, inputs: { intent: "Chart by category", data: [{ category: "A", value: 1 }] } };
    const specifier = JSON.stringify(manifest.name);
    const receipt = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { knownKinds } from ${specifier};
      import { orderSvgChart } from ${JSON.stringify(`${manifest.name}/order-svg-chart`)};
      if (!knownKinds().includes("svg-chart")) throw new Error("chart kind missing from package");
      console.log(JSON.stringify(await orderSvgChart(${JSON.stringify(request)})));
    `], { cwd: consumer, encoding: "utf8" }));
    assert.equal(receipt.ok, true);
    assert.equal(receipt.type, "FabricationOrderReceipt");
    assert.deepEqual(receipt.deliverables.map(({ target }) => target), ["chart.svg", "chart.vl.json"]);

    const executable = join(consumer, "node_modules", ".bin", "order-svg-chart");
    mkdirSync(dirname(executable));
    symlinkSync(join(destination, manifest.bin["order-svg-chart"]), executable, "file");
    const command = JSON.parse(execFileSync(process.execPath, [executable], {
      cwd: consumer,
      encoding: "utf8",
      input: `${JSON.stringify(request)}\n`,
    }));
    assert.deepEqual(command, receipt);
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
});
