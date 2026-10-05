# pf2e-test export

The old `lucyawrey/pf2e-test` system, exported through the API on 2026-10-05 before the database reset (step 1 of [the PF2e demo plan](../../plans/pf2e-demo.md)). The sheet still uses the old `{= }` / braced `show` syntax; port it rather than loading it as is. Sheet files leave out the content type schemas, and content files leave out the embedded sheet and schemas (both are in `content-types/` and `sheets/`).
