#!/usr/bin/env node
// Single supported path for deploying mcp-billing. Do not run wrangler deploy
// directly: the local guard and live postdeploy probe must travel with a release.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const billing = join(root, "billing");
const gate = join(root, "scripts", "billing-release-gate.mjs");
const localApprovedVersion = join(homedir(), ".config", "mcp-billing-gate", "approved-version");
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function sourceHash(repoRoot = root) {
  const hash = createHash("sha256");
  const visit = (path) => {
    for (const name of readdirSync(path).sort()) {
      const file = join(path, name);
      if (statSync(file).isDirectory()) visit(file);
      else { hash.update(file.slice(repoRoot.length)); hash.update(readFileSync(file)); }
    }
  };
  visit(join(repoRoot, "billing", "src"));
  visit(join(repoRoot, "billing", "test"));
  visit(join(repoRoot, "scripts", "test"));
  for (const relative of [
    "billing/wrangler.toml",
    "billing/package.json",
    "scripts/deploy-billing-gated.mjs",
    "scripts/billing-release-gate.mjs",
    "scripts/billing-operations-monitor.mjs",
    "scripts/billing-monitor-watchdog.mjs",
    ".github/workflows/billing-preflight.yml",
    ".github/workflows/billing-monitor-watchdog.yml",
    ".github/workflows/billing-monitor-periodic.yml",
    "scripts/billing-monitor.sh",
    "scripts/install-billing-monitor.sh",
  ]) {
    const file = join(repoRoot, relative);
    hash.update(relative); hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function run(bin, args, cwd, { quiet = false } = {}) {
  const result = spawnSync(bin, args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 300000 });
  if (!quiet && result.stdout) process.stdout.write(result.stdout);
  if (!quiet && result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) throw new Error(`${bin} ${args.slice(0, 2).join(" ")} failed: ${result.error?.message || result.stderr?.trim() || `exit ${result.status}`}`);
  return result.stdout;
}

function activeDeployment(deployments) {
  if (!Array.isArray(deployments) || !deployments.length) throw new Error("No Worker deployments returned");
  const latest = [...deployments].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  if (!UUID.test(latest?.id || "") || !Array.isArray(latest.versions) || latest.versions.length !== 1 ||
      latest.versions[0].percentage !== 100 || !UUID.test(latest.versions[0].version_id || "")) {
    throw new Error("Latest Worker deployment must have an ID and one version at 100% traffic");
  }
  return { id: latest.id, version: latest.versions[0].version_id };
}

function currentDeployment() {
  return activeDeployment(JSON.parse(run("npx", ["wrangler", "deployments", "list", "--json"], billing, { quiet: true })));
}

function remoteApprovedVersion() {
  const version = run("npx", ["wrangler", "kv", "key", "get", "monitor:approved-version",
    "--binding", "REMOTE_DATA", "--remote", "--text", "--config", "wrangler.toml"], billing, { quiet: true }).trim();
  if (!UUID.test(version)) throw new Error(`Remote approved-version pin is missing or malformed: ${version}`);
  return version;
}

export function uploadedVersionId(output) {
  // Upload is deliberately separate from traffic activation. Do not accept a
  // preview URL, deployment ID or an unanchored UUID as evidence of the upload.
  const lines = String(output).replace(/\u001b\[[0-9;]*m/g, "").split(/\r?\n/);
  const ids = lines.filter(line => /^Worker Version ID:\s*/.test(line))
    .map(line => /^Worker Version ID:\s*([a-f0-9-]+)\s*$/i.exec(line)?.[1]);
  if (ids.length !== 1 || !UUID.test(ids[0] || "")) {
    throw new Error("Wrangler did not report exactly one uploaded Worker Version ID");
  }
  return ids[0];
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function versionConfiguration(version) {
  const resources = version?.resources;
  if (!UUID.test(version?.id || "") || !Array.isArray(resources?.bindings) ||
      !resources?.script_runtime || typeof resources.script_runtime !== "object" ||
      !Array.isArray(resources?.script?.handlers)) {
    throw new Error("Worker version configuration response is missing required fields");
  }
  const names = new Set();
  for (const binding of resources.bindings) {
    if (typeof binding?.name !== "string" || !binding.name || typeof binding.type !== "string" ||
        names.has(binding.name)) throw new Error("Worker version bindings are malformed or duplicated");
    names.add(binding.name);
  }
  const runtime = { ...resources.script_runtime };
  if (runtime.compatibility_flags) runtime.compatibility_flags = [...runtime.compatibility_flags].sort();
  return canonical({
    bindings: [...resources.bindings].sort((a, b) => a.name.localeCompare(b.name)),
    runtime,
    handlers: [...resources.script.handlers].sort(),
    named_handlers: [...(resources.script.named_handlers || [])]
      .map(handler => ({ ...handler, handlers: [...handler.handlers].sort() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export function assertVersionConfiguration(approved, uploaded) {
  const before = versionConfiguration(approved);
  const after = versionConfiguration(uploaded);
  for (const field of ["bindings", "runtime", "handlers", "named_handlers"]) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      // Do not print binding values: configuration may include private variables.
      throw new Error(`Uploaded Worker ${field} differ from the approved version; configuration or Durable Object lifecycle changes require a separate reviewed release`);
    }
  }
}

function workerVersion(version) {
  const result = JSON.parse(run("npx", ["wrangler", "versions", "view", version, "--json"], billing, { quiet: true }));
  if (result.id !== version) throw new Error("Worker version response differs from the requested version");
  versionConfiguration(result);
  return result;
}

export function rollbackDecision({ approvedVersion, uploadedVersion, uploadedDeployment, currentDeployment, currentPin }) {
  if (!UUID.test(approvedVersion || "") || !UUID.test(uploadedVersion || "")) return "missing approved or uploaded version ID";
  if (currentPin !== approvedVersion) return `remote approved pin changed to ${currentPin}`;
  if (!uploadedDeployment || !UUID.test(uploadedDeployment.id || "") || uploadedDeployment.version !== uploadedVersion) {
    return "uploaded version was not observed as the sole active deployment";
  }
  if (!currentDeployment || currentDeployment.id !== uploadedDeployment.id || currentDeployment.version !== uploadedVersion) {
    return `active deployment changed to ${currentDeployment?.id}/${currentDeployment?.version}`;
  }
  return null;
}

export function recoveryPlan({ approvedVersion, uploadedVersion, pinWriteStarted,
  activationStarted, uploadedDeployment, activationObservedDeployment, previousDeployment }) {
  if (!UUID.test(approvedVersion || "") || !UUID.test(uploadedVersion || "")) return "none";
  // A KV write can commit remotely even when the CLI reports an error. The
  // subsequent read can still return the old value during propagation.
  if (pinWriteStarted) return "manual";
  // An upload does not change traffic. Never roll back another actor merely
  // because our staged version exists or its metadata check failed.
  if (!activationStarted) return "none";
  if (uploadedDeployment?.version === uploadedVersion && UUID.test(uploadedDeployment.id || "")) return "rollback";
  if (previousDeployment && activationObservedDeployment?.id === previousDeployment.id &&
      activationObservedDeployment.version === approvedVersion) return "none";
  // A CLI timeout is not evidence that activation failed. Without an authoritative
  // observed deployment we cannot decide whose traffic would be rolled back.
  return "manual";
}

function restoreLocalPin(approvedVersion, uploadedVersion) {
  // The verify subprocess pins locally before the remote KV write. Only undo
  // that write if the remote pin is still the old approved value and no other
  // local release has superseded ours.
  if (remoteApprovedVersion() !== approvedVersion) {
    throw new Error("Remote pin changed; local pin was not restored automatically");
  }
  const local = existsSync(localApprovedVersion) ? readFileSync(localApprovedVersion, "utf8").trim() : "";
  if (local === approvedVersion) return;
  if (local !== uploadedVersion) throw new Error(`Local pin changed to ${local}; refusing to overwrite it`);
  mkdirSync(dirname(localApprovedVersion), { recursive: true, mode: 0o700 });
  const pending = `${localApprovedVersion}.rollback-${process.pid}`;
  writeFileSync(pending, `${approvedVersion}\n`, { mode: 0o600 });
  renameSync(pending, localApprovedVersion);
}

function rollbackIfStillOurs(approvedVersion, uploadedVersion, uploadedDeployment) {
  // This is a best-effort guard, not an atomic compare-and-swap. Another actor
  // can deploy between the last read and Wrangler's rollback request.
  const current = currentDeployment();
  const pin = remoteApprovedVersion();
  const reason = rollbackDecision({ approvedVersion, uploadedVersion,
    uploadedDeployment, currentDeployment: current, currentPin: pin });
  if (reason) throw new Error(`Automatic rollback refused: ${reason}; inspect live deployment and approved pin manually`);
  run("npx", ["wrangler", "rollback", approvedVersion, "--message", `Automatic rollback after failed gated release ${uploadedVersion}`, "--yes"], billing);
  const restored = currentDeployment();
  if (restored.version !== approvedVersion) throw new Error(`Rollback command returned, but active version is ${restored.version}, expected ${approvedVersion}`);
  if (remoteApprovedVersion() !== approvedVersion) throw new Error("Rollback restored traffic but remote approved pin changed; inspect manually");
  console.error(`Automatic rollback restored approved Worker version ${approvedVersion} from ${uploadedVersion}`);
}

// Inject effects so the release's ordering and failure states are exercised
// without Cloudflare access. The CLI entry point exposes no bypass flags.
export function executeRelease(operations) {
  const state = { pinWriteStarted: false, activationStarted: false };
  try {
    const approvedVersion = state.approvedVersion = operations.readPin();
    const before = state.previousDeployment = operations.deployment();
    if (before.version !== approvedVersion) throw new Error(`Live Worker ${before.version} differs from remote approved pin ${approvedVersion}`);
    const checkedSource = operations.hash();
    const approvedConfiguration = operations.version(approvedVersion);
    if (approvedConfiguration.id !== approvedVersion) throw new Error("Approved configuration response identifies a different Worker version");
    operations.preflight();
    if (operations.hash() !== checkedSource) throw new Error("Billing source or gate changed during preflight; rerun against stable files");
    const ready = operations.deployment();
    if (ready.id !== before.id || ready.version !== approvedVersion || operations.readPin() !== approvedVersion) {
      throw new Error("Live deployment or approved pin changed during preflight");
    }
    const uploadedVersion = state.uploadedVersion = uploadedVersionId(operations.upload());
    if (operations.hash() !== checkedSource) throw new Error("Billing source or gate changed during version upload; staged version was not activated");
    const uploadedConfiguration = operations.version(uploadedVersion);
    if (uploadedConfiguration.id !== uploadedVersion) throw new Error("Uploaded configuration response identifies a different Worker version");
    assertVersionConfiguration(approvedConfiguration, uploadedConfiguration);
    const beforeActivation = operations.deployment();
    if (beforeActivation.id !== before.id || beforeActivation.version !== approvedVersion ||
        operations.readPin() !== approvedVersion) {
      throw new Error("Live deployment or approved pin changed during version upload; staged version was not activated");
    }
    if (operations.hash() !== checkedSource) throw new Error("Billing source or gate changed before version activation; staged version was not activated");
    state.activationStarted = true;
    let activationError;
    try { operations.activate(uploadedVersion); } catch (error) { activationError = error; }
    // Observe even if the activation CLI failed: its request may have committed
    // before a timeout or a later non-versioned-settings operation failed.
    const observed = state.activationObservedDeployment = operations.deployment();
    if (observed.version === uploadedVersion) state.uploadedDeployment = observed;
    if (activationError) throw activationError;
    if (!state.uploadedDeployment) throw new Error("Uploaded version was not observed as the sole active deployment; postdeploy verification cannot certify this release");
    if (operations.hash() !== checkedSource) throw new Error("Billing source or gate changed during activation; postdeploy verification cannot certify the tested source");
    operations.verify(uploadedVersion);
    if (operations.hash() !== checkedSource) throw new Error("Billing source or gate changed during postdeploy verification");
    if (operations.readPin() !== approvedVersion) throw new Error("Remote approved pin changed during release");
    const beforePin = operations.deployment();
    if (beforePin.id !== state.uploadedDeployment.id || beforePin.version !== uploadedVersion) {
      throw new Error("Live Worker deployment changed before approved-version pin write");
    }
    // Cron reads this remote pin. A direct Wrangler deployment leaves the pin on
    // the prior version and will fail the scheduled check.
    state.pinWriteStarted = true;
    operations.writePin(uploadedVersion);
    return state;
  } catch (error) {
    error.releaseState = state;
    throw error;
  }
}

function main() {
  try {
    if (process.argv.length !== 2) throw new Error("This deployment command accepts no bypass flags");
    const state = executeRelease({
      readPin: remoteApprovedVersion,
      deployment: currentDeployment,
      hash: sourceHash,
      version: workerVersion,
      preflight: () => run(process.execPath, [gate, "preflight"], root),
      upload: () => run("npx", ["wrangler", "versions", "upload"], billing),
      activate: version => run("npx", ["wrangler", "versions", "deploy", `${version}@100%`, "--yes"], billing),
      verify: version => run(process.execPath, [gate, "verify", "--expected-version", version], root),
      writePin: version => run("npx", ["wrangler", "kv", "key", "put", "monitor:approved-version", version,
        "--binding", "REMOTE_DATA", "--remote", "--config", "wrangler.toml"], billing),
    });
    console.log(`Billing release verified: ${state.uploadedVersion}`);
  } catch (error) {
    const { approvedVersion, uploadedVersion, uploadedDeployment } = error.releaseState || {};
    console.error(`BILLING DEPLOYMENT FAILED: ${error.message}`);
    const recovery = recoveryPlan(error.releaseState || {});
    if (recovery === "manual") {
      console.error("BILLING MANUAL RECOVERY REQUIRED: activation or remote approved-version write is ambiguous; inspect live deployment and remote/local pins before rollback");
    } else if (recovery === "rollback") {
      try {
        rollbackIfStillOurs(approvedVersion, uploadedVersion, uploadedDeployment);
      } catch (rollbackError) {
        console.error(`BILLING MANUAL RECOVERY REQUIRED: ${rollbackError.message}`);
      }
      try {
        restoreLocalPin(approvedVersion, uploadedVersion);
      } catch (pinError) {
        console.error(`BILLING LOCAL PIN RECOVERY REQUIRED: ${pinError.message}`);
      }
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
