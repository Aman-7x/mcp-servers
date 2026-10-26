import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, lstatSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { executeRelease, uploadedVersionId, assertVersionConfiguration,
  recoveryPlan, rollbackDecision, sourceHash } from "../deploy-billing-gated.mjs";

const approvedVersion = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uploadedVersion = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const uploadedDeployment = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", version: uploadedVersion };

test("rollback is allowed only for our observed active deployment and unchanged remote pin", () => {
  const state = { approvedVersion, uploadedVersion, uploadedDeployment,
    currentDeployment: uploadedDeployment, currentPin: approvedVersion };
  assert.equal(rollbackDecision(state), null);
  assert.match(rollbackDecision({ ...state, uploadedDeployment: undefined }), /not observed/);
  assert.match(rollbackDecision({ ...state, currentDeployment: { ...uploadedDeployment,
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } }), /active deployment changed/);
  assert.match(rollbackDecision({ ...state, currentDeployment: { ...uploadedDeployment,
    version: approvedVersion } }), /active deployment changed/);
  assert.match(rollbackDecision({ ...state, currentPin: uploadedVersion }), /pin changed/);
  assert.match(rollbackDecision({ ...state, approvedVersion: "invalid" }), /missing approved/);
});

test("an ambiguous final KV pin write requires manual recovery", () => {
  const base = { approvedVersion, uploadedVersion, activationStarted: true, uploadedDeployment };
  assert.equal(recoveryPlan({ ...base, pinWriteStarted: false }), "rollback");
  assert.equal(recoveryPlan({ ...base, pinWriteStarted: true }), "manual");
  assert.equal(recoveryPlan({ ...base, uploadedVersion: undefined, pinWriteStarted: false }), "none");
  assert.equal(recoveryPlan({ approvedVersion, uploadedVersion, activationStarted: false }), "none");
  assert.equal(recoveryPlan({ approvedVersion, uploadedVersion, activationStarted: true }), "manual");
});

test("the upload parser requires one explicit uploaded version rather than another UUID", () => {
  assert.equal(uploadedVersionId(`Uploaded mcp-billing\nWorker Version ID: ${uploadedVersion}\n`), uploadedVersion);
  assert.equal(uploadedVersionId(`\u001b[32mWorker Version ID: ${uploadedVersion}\u001b[0m\n`), uploadedVersion);
  for (const bad of ["", `Current Version ID: ${uploadedVersion}`, `Preview URL: https://${uploadedVersion}.example`,
    "Worker Version ID: malformed", `Worker Version ID: ${uploadedVersion}\nWorker Version ID: ${uploadedVersion}`,
    `Worker Version ID: ${uploadedVersion} unexpected`]) {
    assert.throws(() => uploadedVersionId(bad), /exactly one uploaded/);
  }
});

function version(id) {
  return { id, resources: {
    bindings: [
      { name: "FULFILLMENT", type: "durable_object_namespace", namespace_id: "existing-namespace", class_name: "FulfillmentState" },
      { name: "REMOTE_DATA", type: "kv_namespace", namespace_id: "existing-kv" },
      { name: "STRIPE_SECRET_KEY", type: "secret_text" },
    ],
    script_runtime: { compatibility_date: "2025-09-01", compatibility_flags: ["nodejs_compat"],
      limits: { cpu_ms: 400 }, migration_tag: "fulfillment_state_v1" },
    script: { etag: id, handlers: ["fetch", "scheduled"],
      named_handlers: [{ name: "FulfillmentState", handlers: ["fetch", "alarm"] }] },
  } };
}

test("staged activation preserves binding identities, migration state and runtime bounds", () => {
  const approved = version(approvedVersion), uploaded = version(uploadedVersion);
  uploaded.resources.bindings.reverse();
  uploaded.resources.script.handlers.reverse();
  uploaded.resources.script.named_handlers[0].handlers.reverse();
  assert.doesNotThrow(() => assertVersionConfiguration(approved, uploaded));
  const changes = [
    next => { next.resources.bindings[0].namespace_id = "another-namespace"; },
    next => { next.resources.bindings.pop(); },
    next => { next.resources.script_runtime.limits.cpu_ms = 1000; },
    next => { next.resources.script_runtime.migration_tag = "new_migration"; },
    next => { next.resources.script_runtime.compatibility_date = "2026-10-26"; },
    next => { next.resources.script.handlers = ["fetch"]; },
    next => { next.resources.script.named_handlers[0].name = "AnotherState"; },
  ];
  for (const change of changes) {
    const next = version(uploadedVersion); change(next);
    assert.throws(() => assertVersionConfiguration(approved, next), /differ/);
  }
  assert.throws(() => assertVersionConfiguration(approved, { id: uploadedVersion }), /missing required/);
  const duplicate = version(uploadedVersion);
  duplicate.resources.bindings.push(duplicate.resources.bindings[0]);
  assert.throws(() => assertVersionConfiguration(approved, duplicate), /duplicated/);
  const privateValue = version(uploadedVersion);
  privateValue.resources.bindings.push({ name: "PRIVATE_VAR", type: "plain_text", text: "must-not-appear-in-error" });
  assert.throws(() => assertVersionConfiguration(approved, privateValue), error =>
    /bindings differ/.test(error.message) && !error.message.includes("must-not-appear-in-error"));
});

const previousDeployment = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", version: approvedVersion };
function releaseHarness() {
  const h = { events: [], pin: approvedVersion, source: "tested source", live: previousDeployment,
    versions: { [approvedVersion]: version(approvedVersion), [uploadedVersion]: version(uploadedVersion) } };
  h.operations = {
    readPin: () => { h.events.push("pin:read"); return h.pin; },
    deployment: () => { h.events.push("deployment:read"); return h.live; },
    hash: () => { h.events.push("source:read"); return h.source; },
    version: id => { h.events.push(`configuration:${id}`); return h.versions[id]; },
    preflight: () => { h.events.push("preflight"); },
    upload: () => { h.events.push("upload"); return `Worker Version ID: ${uploadedVersion}\n`; },
    activate: id => { h.events.push(`activate:${id}`); h.live = uploadedDeployment; },
    verify: id => { h.events.push(`verify:${id}`); },
    writePin: id => { h.events.push(`pin:write:${id}`); h.pin = id; },
  };
  return h;
}
function failedRelease(h) {
  try { executeRelease(h.operations); assert.fail("Release unexpectedly succeeded"); }
  catch (error) { assert.ok(error.releaseState, error.message); return error; }
}

test("release uploads after preflight, checks staged configuration, activates then verifies and pins", () => {
  const h = releaseHarness();
  const result = executeRelease(h.operations);
  assert.equal(result.uploadedVersion, uploadedVersion);
  assert.deepEqual(result.uploadedDeployment, uploadedDeployment);
  assert.equal(h.pin, uploadedVersion);
  const before = (a, b) => assert.ok(h.events.indexOf(a) < h.events.indexOf(b), `${a} must precede ${b}`);
  before("preflight", "upload");
  before("upload", `configuration:${uploadedVersion}`);
  before(`configuration:${uploadedVersion}`, `activate:${uploadedVersion}`);
  before(`activate:${uploadedVersion}`, `verify:${uploadedVersion}`);
  before(`verify:${uploadedVersion}`, `pin:write:${uploadedVersion}`);
});

test("preflight and upload-only failures never activate, pin or request rollback", () => {
  const cases = [
    h => { h.versions[approvedVersion].id = uploadedVersion; },
    h => { h.operations.preflight = () => { throw new Error("test failed"); }; },
    h => { h.operations.preflight = () => { h.source = "changed"; }; },
    h => { h.operations.upload = () => { throw new Error("upload timeout"); }; },
    h => { h.operations.upload = () => "Worker Version ID: malformed"; },
    h => { h.operations.upload = () => { h.source = "changed"; return `Worker Version ID: ${uploadedVersion}`; }; },
    h => { h.versions[uploadedVersion].resources.script_runtime.limits.cpu_ms = 999; },
    h => { h.versions[uploadedVersion].id = approvedVersion; },
    h => { h.operations.upload = () => { h.pin = uploadedVersion; return `Worker Version ID: ${uploadedVersion}`; }; },
    h => { h.operations.upload = () => { h.live = { ...previousDeployment, id: uploadedDeployment.id }; return `Worker Version ID: ${uploadedVersion}`; }; },
    h => { const readVersion = h.operations.version; h.operations.version = id => {
      const value = readVersion(id); if (id === uploadedVersion) h.source = "changed"; return value;
    }; },
  ];
  for (const setup of cases) {
    const h = releaseHarness(); setup(h);
    const failure = failedRelease(h);
    assert.equal(h.events.some(event => event.startsWith("activate:")), false);
    assert.equal(h.events.some(event => event.startsWith("pin:write:")), false);
    assert.equal(recoveryPlan(failure.releaseState), "none");
  }
});

test("ambiguous activation observes authoritative traffic before choosing recovery", () => {
  const active = releaseHarness();
  active.operations.activate = () => { active.live = uploadedDeployment; throw new Error("activation CLI timeout"); };
  const committed = failedRelease(active).releaseState;
  assert.deepEqual(committed.uploadedDeployment, uploadedDeployment);
  assert.equal(recoveryPlan(committed), "rollback");
  assert.equal(active.events.includes(`verify:${uploadedVersion}`), false);

  const unchanged = releaseHarness();
  unchanged.operations.activate = () => { throw new Error("request rejected"); };
  assert.equal(recoveryPlan(failedRelease(unchanged).releaseState), "none");

  const unknown = releaseHarness();
  unknown.operations.activate = () => { unknown.operations.deployment = () => { throw new Error("observation unavailable"); }; throw new Error("timeout"); };
  assert.equal(recoveryPlan(failedRelease(unknown).releaseState), "manual");

  const concurrent = releaseHarness();
  concurrent.operations.activate = () => { concurrent.live = { id: uploadedDeployment.id, version: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }; throw new Error("timeout"); };
  assert.equal(recoveryPlan(failedRelease(concurrent).releaseState), "manual");
});

test("postactivation source, verification or ownership failure cannot approve a version", () => {
  const cases = [
    h => { h.operations.activate = () => { h.live = uploadedDeployment; h.source = "changed"; }; },
    h => { h.operations.verify = () => { throw new Error("GET-to-Stripe guard failed"); }; },
    h => { h.operations.verify = () => { h.source = "changed"; }; },
    h => { h.operations.verify = () => { h.pin = uploadedVersion; }; },
    h => { h.operations.verify = () => { h.live = { ...uploadedDeployment, id: previousDeployment.id }; }; },
  ];
  for (const setup of cases) {
    const h = releaseHarness(); setup(h);
    const failure = failedRelease(h);
    assert.equal(h.events.some(event => event.startsWith("pin:write:")), false);
    assert.equal(recoveryPlan(failure.releaseState), "rollback");
    if (h.pin !== approvedVersion || h.live.id !== uploadedDeployment.id) {
      assert.notEqual(rollbackDecision({ ...failure.releaseState,
        currentDeployment: h.live, currentPin: h.pin }), null);
    }
  }
  const ambiguousPin = releaseHarness();
  ambiguousPin.operations.writePin = () => { throw new Error("pin write timeout"); };
  assert.equal(recoveryPlan(failedRelease(ambiguousPin).releaseState), "manual");
});

const files = [
  "billing/src/worker.js",
  "billing/test/worker.test.mjs",
  "billing/wrangler.toml",
  "billing/package.json",
  "scripts/test/gate.test.mjs",
  "scripts/deploy-billing-gated.mjs",
  "scripts/billing-release-gate.mjs",
  "scripts/billing-operations-monitor.mjs",
  "scripts/billing-monitor-watchdog.mjs",
  ".github/workflows/billing-preflight.yml",
  ".github/workflows/billing-monitor-watchdog.yml",
  ".github/workflows/billing-monitor-periodic.yml",
  "scripts/billing-monitor.sh",
  "scripts/install-billing-monitor.sh",
];

test("deployment source hash detects changes to every release-critical file", () => {
  const root = mkdtempSync(join(tmpdir(), "mcp-billing-deploy-hash-"));
  try {
    for (const relative of files) {
      const file = join(root, relative);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, relative);
    }
    const baseline = sourceHash(root);
    for (const relative of files) {
      const file = join(root, relative);
      writeFileSync(file, `${relative}\nchanged`);
      assert.notEqual(sourceHash(root), baseline, `missed ${relative}`);
      writeFileSync(file, relative);
    }
    assert.equal(sourceHash(root), baseline);
  } finally {
    const handles = spawnSync("lsof", ["+D", root], { encoding: "utf8" });
    assert.equal(handles.status, 1, "retain fixture when lsof fails or handles remain open");
    assert.equal(handles.stdout, "");
    const bytes = path => readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
      const child = join(path, entry.name);
      return total + (entry.isDirectory() ? bytes(child) : lstatSync(child).size);
    }, 0);
    appendFileSync(new URL("../../data/build-deletions.jsonl", import.meta.url), JSON.stringify({
      at: new Date().toISOString(), path: root, bytes: bytes(root), lsof_clear: true,
      reason: "Completed owned billing deployment source-hash fixture",
    }) + "\n");
    rmSync(root, { recursive: true, force: true });
  }
});
