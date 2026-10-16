// Interpose exactly one mkdir: another process creates the documents entry
// after ensureDirBounded's existence check, before its mkdir call returns.
const fs = require("node:fs");
const { syncBuiltinESMExports } = require("node:module");
const { join } = require("node:path");

const original = fs.mkdirSync;
const target = join(process.env.XDG_DATA_HOME, "mcp-servers", "resume", "documents");
let injected = false;
fs.mkdirSync = function mkdirWithRace(path, ...args) {
  if (!injected && path === target) {
    injected = true;
    const kind = process.env.RESUME_MKDIR_RACE_KIND;
    if (kind === "directory") original.call(fs, path, ...args);
    else if (kind === "file") fs.writeFileSync(path, "keep");
    else if (kind === "symlink") {
      const redirect = join(process.env.XDG_DATA_HOME, "redirect");
      original.call(fs, redirect);
      fs.symlinkSync(redirect, path);
    } else throw new Error(`unknown race kind: ${kind}`);
    fs.writeFileSync(join(process.env.XDG_DATA_HOME, "mkdir-race-injected"), kind);
    const error = new Error(`EEXIST: file already exists, mkdir '${path}'`);
    error.code = "EEXIST";
    throw error;
  }
  return original.call(fs, path, ...args);
};
syncBuiltinESMExports();
