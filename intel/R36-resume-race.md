# R36 resume directory creation race

The root `npm test` run recorded in `data/r36_test_result.txt` failed at line 10552 in `two processes, one data dir: every variant and every cover letter survives`. A cover letter call returned `EEXIST` from `mkdir .../mcp-servers/resume/documents`.

`servers/resume/src/index.ts` had a bounded ancestor walk to avoid the Linux `/proc`, `/sys`, and `/dev` hang caused by recursive `mkdir`. It checked each ancestor with `existsSync`, then called `mkdirSync` without handling another process creating that directory between the check and the call. The repair keeps the bounded walk. On `EEXIST`, it continues only if `lstatSync` finds a real directory. A file or symlink remains an error.

`servers/resume/test/concurrency.test.mjs` now runs an exact interleaving through `test/mkdir-race.cjs`: a preload creates the `documents` entry at the `mkdirSync` call and raises `EEXIST`, simulating a competing process. A directory permits `resume_create`; a file and symlink are rejected, with no document written through the symlink. The existing two-process variant and cover letter test also passes.

Measured commands, run from `/Users/mike/mcp-servers` with `TMPDIR=/Users/mike/mcp-servers-work`:

| Command | Result | Wall time |
| --- | --- | ---: |
| `npm_config_cache=/Users/mike/.npm-cache-local npm run build -w @theluckystrike/mcp-resume` | exit 0 | 1.14 s |
| `node --test servers/resume/test/concurrency.test.mjs` | 2 passed, 0 failed | 1.19 s |
| `npm_config_cache=/Users/mike/.npm-cache-local npm test -w @theluckystrike/mcp-resume` | 39 passed, 1 skipped, 0 failed | 2.90 s |
| `git diff --check -- servers/resume/src/index.ts servers/resume/test/concurrency.test.mjs` | exit 0 | not timed |

The office-suite vendor artifact needs rebuilding from this source; the artifact created before this fix contains the earlier resume code.
