// The suite imports node:module registerHooks, which landed in Node 22.6. On an older
// runtime five test files die with a SyntaxError that reads like a code defect, so fail
// first with the actual reason instead.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 6)) {
  console.error(`tests need Node >= 22.6 for node:module registerHooks, this is ${process.versions.node}`);
  process.exit(1);
}
