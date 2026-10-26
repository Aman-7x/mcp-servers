# MCP Office Suite

Run the freelancer office from one MCP config entry. The v0.25.0 bundle initializes 50 local child servers and exposes 453 tools, measured over MCP on 2026-10-26. It includes time tracking, invoices, spreadsheets, quotes, expenses and the supplier-invoice three-way matcher duplicate invoice candidate review, and supplier statement open-item checks against AP ledger exports. The proxy forwards tools, resources and prompts to the child that owns them; each child keeps its own storage and free tier.

Built by [theluckystrike](https://github.com/theluckystrike). MIT. Support: support@zovo.one.

## Install

For Claude Desktop, download [office-suite.mcpb v0.25.0](https://github.com/theluckystrike/mcp-servers/releases/download/v0.25.0/office-suite.mcpb) and open it. Verify it using the release's [SHA256SUMS.txt](https://github.com/theluckystrike/mcp-servers/releases/download/v0.25.0/SHA256SUMS.txt).

The [download catalog](https://mcp.zovo.one/downloads#office-suite) lists explicit archive versions. The latest GitHub release is not a complete collection of all server bundles. This proxy is local stdio only; it has no hosted endpoint. Its npm package and internal dependencies are not published, so use the bundle or build from source.

Source installation requires Node.js 22 or newer for the current repository build tooling:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git
cd mcp-servers
npm install
npm run build
```

The root build bootstraps the license/timezone engine dependency and builds the child servers. Use your checkout's absolute path in the config. For Claude Desktop, merge this entry into `mcpServers` in its config file:

```json
{
  "mcpServers": {
    "office-suite": {
      "command": "node",
      "args": ["/absolute/path/mcp-servers/servers/office-suite/dist/index.js"]
    }
  }
}
```

For Cursor, merge the same entry into `.cursor/mcp.json` or your user MCP config. For Claude Code:

```sh
claude mcp add office-suite -- node /absolute/path/mcp-servers/servers/office-suite/dist/index.js
```

Restart the client, call `license_status`, and read `office://tools_map` to discover the children and exact exposed tool names. A successful tools list confirms discovery; run a real task to verify the workflow you need.

## Tools and collision names

| Entry | Behavior |
| --- | --- |
| Child tools | The child's own tools, arguments and free/Pro rules. |
| `license_status` | Per-child license state and the bundle checkout URL. |
| `license_activate` | Forwards a key to every connected child and reports every result. |
| `office://tools_map` resource | Maps exposed tool names to their child and original name. |

When child names collide, the proxy exposes names prefixed with the child, such as `invoice_business_set`. Child result payloads, including JSON source records, raw CSV, HTML and prose, retain their original values. Each forwarded result adds collision mappings under `_meta["office-suite/tool-names"]` and points to `office://tools_map`; explicit retrieval tool hints in matcher report envelopes use the exposed names. Read the runtime map rather than guessing a prefix or relying on an older static tool table.

The v0.25.0 manifest's 453 names and descriptions match the actual running bundle, including collision prefixes. [Measured inventory](https://github.com/theluckystrike/mcp-servers/blob/main/data/office-suite-tool-inventory.json) and [artifact evidence](https://github.com/theluckystrike/mcp-servers/blob/main/intel/R38-packaging.md) are available. This verifies discovery and matcher delivery through the proxy; it is not a feature test of every child tool.

## Supplier statement review and tool names

The new `supplier_statement_check` compares two supplied open-item exports by exact entity, supplier, currency, document type and reference. It retains both source lists and reports missing items, amount/date differences and ambiguous repeated references. It does not reconcile balances, allocate payments, extract PDFs or approve payment. Full diagnostics and CSV are free; the supplier server's Pro upgrade removes only its saved-report count cap.

Its report helpers are named `supplier-statement-check_report_get`, `supplier-statement-check_report_page`, `supplier-statement-check_report_export_csv`, `supplier-statement-check_report_list` and `supplier-statement-check_report_delete`. Explicit retrieval hints use those names. Original references and CSV cells remain unchanged even when they contain a tool name.

The v0.25.0 inventory retains every exposed tool name from the prior published v0.22.9 bundle and adds six supplier tools. Use `office://tools_map` for the authoritative map; no bare `report_get` alias is added.

## Free and Pro

| Free | Pro bundle |
| --- | --- |
| Each child's documented free tier; no subscription required | $39 one time, removes the applicable limits across the children |

[Get the $39 bundle](https://mcp.zovo.one/buy/bundle), then call `license_activate` with the bundle key or set `MCP_LICENSE_KEY` in the server environment. Keys verify offline. A $19 single-server key upgrades its own product; it does not unlock the whole suite.

Activation returns an error if any connected child rejects the key, with an OK/FAILED result for each child. Accepted activations are not rolled back: use the result table and `license_status`, correct the key or failing child, and retry. Do not interpret a partial activation as all children being Pro.

## Local execution and privacy

Every child runs as its own stdio process and stores its documents under its own data directory, normally `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/<name>/`. The proxy adds no document store. Individual tools may make public network requests, for example price, currency or backlink checks; read the relevant child's documentation. Your AI client or model provider has its own data handling.

Child stderr is drained into the proxy's stderr with the child name. An unexpected child exit rejects pending requests and gets one restart attempt; an interrupted mutation must be checked before retrying it.
