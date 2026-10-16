# Release v0.22.9 (2026-10-16)

evidence: Spreadsheet, Expense Tracker and Office Suite use the official SheetJS0.20.3 release. This replaces the older XLSX parser affected by the vendor's prototype-pollution and regular-expression denial-of-service advisories. The update includes the ESM file-writing and legacy-codepage setup required by the new dependency. New immutable archives and their checksum manifest identify the updated bytes; previous releases are retained.

insight: A dependency version check alone does not establish workflow compatibility. Canonical numeric and ISO date cells were checked through actual read/convert/read-back calls across UTC, Ho Chi Minh and New York. Numeric dates now follow the stored workbook value; some files produced by older versions can display30 seconds differently in historical-offset timezones. No guessed correction is applied. Read operations preserve the original file.

artifacts: https://github.com/theluckystrike/mcp-servers/releases/tag/v0.22.9

The duplicate-invoice and three-way-match standalones remain at v0.22.8 and do not include SheetJS. Prices, offline license permissions and free-tier limits are unchanged. Other dependency advisories and older released archives remain a separate tracked scope. This patch does not certify arbitrary legacy encodings, every Office child feature, paid fulfillment or customer demand.
