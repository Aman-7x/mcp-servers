// Servers that are listed in the store but have no published release asset yet.
// Kept separate from downloads.js, which is generated from the release itself: a server
// enters that file only once its .mcpb exists on a real release. Until then /downloads
// must not print a link that 404s, so it prints the source install path instead.
export const BUNDLE_PENDING = {
  "ingredient-convert": "no .mcpb release asset yet; install from https://github.com/theluckystrike/mcp-servers/tree/main/servers/ingredient-convert",
};
