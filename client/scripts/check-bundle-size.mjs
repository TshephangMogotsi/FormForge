import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const distDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
const indexHtml = await readFile(new URL("index.html", `file://${distDirectory}/`), "utf8");
const initialScriptPaths = [...indexHtml.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(
  ([, path]) => path
);

if (initialScriptPaths.length === 0) {
  throw new Error("No initial JavaScript entry points were found in dist/index.html.");
}

async function gzipBytes(path) {
  return gzipSync(await readFile(path)).byteLength;
}

async function containsGuestTelemetry(path) {
  const source = await readFile(path, "utf8");
  return source.includes("builder_opened") || source.includes("formforge.analytics");
}

const initialScriptFiles = initialScriptPaths.map(
  (path) => new URL(path.replace(/^\//, ""), `file://${distDirectory}/`)
);
const initialBytes = (await Promise.all(initialScriptFiles.map(gzipBytes))).reduce(
  (total, bytes) => total + bytes,
  0
);

const assetNames = await readdir(new URL("assets/", `file://${distDirectory}/`));
const publicFormAsset = assetNames.find((name) => /^PublicFormPage-.*\.js$/.test(name));
const guestBuilderAsset = assetNames.find((name) => /^GuestBuilderPage-.*\.js$/.test(name));
const ownedBuilderAsset = assetNames.find((name) => /^BuilderPage-.*\.js$/.test(name));

if (!publicFormAsset || !guestBuilderAsset || !ownedBuilderAsset) {
  throw new Error("Expected separate public-form, guest-builder, and builder chunks were not emitted.");
}

const publicFormFile = new URL(`assets/${publicFormAsset}`, `file://${distDirectory}/`);
const publicFormBytes = await gzipBytes(publicFormFile);
const telemetryInRespondentBundle =
  (await Promise.all(initialScriptFiles.map(containsGuestTelemetry))).some(Boolean) ||
  (await containsGuestTelemetry(publicFormFile));
const initialBudgetBytes = 150 * 1024;
const publicFormBudgetBytes = 10 * 1024;
const result = {
  initialJavaScriptGzipKb: Math.round((initialBytes / 1024) * 100) / 100,
  initialBudgetGzipKb: initialBudgetBytes / 1024,
  publicFormChunkGzipKb: Math.round((publicFormBytes / 1024) * 100) / 100,
  publicFormChunkBudgetGzipKb: publicFormBudgetBytes / 1024,
  guestBuilderSeparated: true,
  guestTelemetryInRespondentBundle: telemetryInRespondentBundle
};

console.info(JSON.stringify(result));

if (initialBytes > initialBudgetBytes) {
  throw new Error(`Initial JavaScript is ${initialBytes} bytes gzip; budget is ${initialBudgetBytes}.`);
}
if (publicFormBytes > publicFormBudgetBytes) {
  throw new Error(`Public form chunk is ${publicFormBytes} bytes gzip; budget is ${publicFormBudgetBytes}.`);
}
if (telemetryInRespondentBundle) {
  throw new Error("Guest telemetry was included in the initial or public-form JavaScript bundle.");
}
