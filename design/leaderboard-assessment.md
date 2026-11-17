# Sunspark Rumble leaderboard assessment

2026-09-08. Proposal only; the leaderboard is not implemented. Assumes the requested leaderboard is shared between players over the internet.

## Recommendation

Use a small TypeScript/Node HTTP API with PostgreSQL, Drizzle ORM and Drizzle Kit migrations. Keep the existing game client. The API owns database credentials, player sessions, validation and ranking queries; the browser only sends HTTPS requests. No multiplayer simulation or WebSockets are needed for an asynchronous leaderboard.

Start with a casual board showing each player's best winning match for each island and difficulty. Order by eliminations descending, then active play time ascending. This is a proposed rule, not an existing game score. Keep losses in personal match history. Store builds as a statistic, without awarding points for repeatedly building. Separate boards by a gameplay/scoring revision so balance changes do not silently mix incompatible results; cosmetic releases can retain the same revision.

The product choices still to settle are the ranking rule, whether guest identity is enough or accounts must work across devices, and whether casual score validation is sufficient. Hosting provider selection can follow those decisions.

## Existing implementation

- `src/game.js:84`, `start()`: resets a round and increments a page-local `matchId`. This counter is not globally unique and resets on reload.
- `src/game.js:386`, `finish()`: already has win/loss, placement, eliminations (`pops`), elapsed simulation time and build count. Map and difficulty are also available. This is the natural place to create an immutable result record, once per round.
- `src/game.js:393`, `tick()`: advances `elapsed` with a delta capped at 50 ms. That clock controls gameplay and excludes pauses, but falls behind real active time during slow frames. Add a separate monotonic active-play clock before using time for leaderboard ties; do not change the storm clock merely to add ranking.
- `src/game.js:428`, `saveSettings()`: local storage contains settings, not match history or player identity.
- `src/maps.js`: Breezy Bay has eight bots; Sunhaven has ten. Difficulties are `easy`, `medium`, `hard` and `insane` (`normal` is a legacy alias for `medium`). Maps and difficulties need separate boards.
- Practice and exploration use practice mode and must not submit ranked results. Abandoned or unfinished matches must not qualify.
- Both launchers open `index.html` directly with `file://`. `server.mjs` is only a localhost static preview server. There is no existing authentication, score API or database.

## Proposed components

| Component | Work needed |
| --- | --- |
| Match results | Capture a unique round result with map, difficulty, gameplay revision, build version, placement, eliminations, active duration and builds; save local history before attempting any upload. |
| Leaderboard UI | Title-menu entry, island/difficulty filters, top entries, personal best, and result-screen submission feedback. Handle loading, empty lists and service failures. Keep LOCAL PLAY as the gameplay description and put service availability beside leaderboard features. |
| Identity | For the first hosted version, issue an anonymous server session with a chosen display name. Use an opaque session cookie with appropriate HttpOnly/Secure/SameSite settings. Display names are not identifiers. Clearing browser data loses an unclaimed guest identity; cross-device recovery requires an account/linking flow. |
| API | Create a session/profile, reserve a run at match start, accept a completed run, list top results and return the current player's best. Bound request size, validate inputs and rate-limit session creation and submissions. |
| PostgreSQL/Drizzle | Typed schema, constraints, ranking indexes and reviewed SQL migrations. A single database is enough initially; add caching only if measured traffic requires it. |
| Operations | HTTPS hosting, server-only secrets, bounded database connection pooling, backups, migration deployment, error logging and a way to remove abusive names or scores. |

## Data and API outline

Use three initial tables:

1. `players`: UUID, display name, creation time and moderation status.
2. `player_sessions`: hash of an opaque session token, player reference and expiry. Sessions identify the player; a submitted player UUID must not establish ownership.
3. `runs`: server-issued UUID, player reference, map, difficulty, gameplay revision, client build version, server start/expiry/finish timestamps, status and submitted result fields. Completed rows retain the raw statistics, allowing ranking rules to be audited.

Suggested routes are `POST /api/players/guest`, `POST /api/runs`, `POST /api/runs/:id/finish`, `GET /api/leaderboard?map=...&difficulty=...&revision=...`, and `GET /api/me/best` with the same filters. Return a bounded top list initially; add stable pagination when needed.

Freeze map, difficulty and accepted gameplay revision when reserving a run. Complete a run in one transaction after checking session ownership and expiry. A retry of the same result returns the original success; a different result for a completed run is rejected. An expired unfinished reservation cannot create a ranked entry. A retry must still find an already completed result even if the reservation's original deadline has since passed.

Enforce allowed map/difficulty values and sensible integer bounds in both request validation and database constraints. Eliminations cannot exceed the configured bot count; placement must fit the match population; time and build count cannot be negative. Server receipt/start times provide additional plausibility checks, but cannot prove that a match happened. Exclude practice, unsupported gameplay revisions, unfinished runs and rejected entries.

For the suggested wins board, return only the best qualifying run per player before taking the top N. Use eliminations descending and duration ascending; use server completion time and run UUID for deterministic ordering of otherwise equal entries. An index starting with board filters and matching the result ordering helps top-N reads. Confirm the actual best-per-player query plan with realistic data before adding a separate best-results table.

## Offline play and delivery

Recommend hosting the leaderboard-enabled game and API under one HTTPS origin, while retaining the portable local build. This gives the online version a stable origin for sessions and avoids designing cookie authentication around local files. Browsers can treat `file://` pages as opaque origins; allowing the `null` origin is not a reliable way to trust a particular game copy.

Every match should continue if the service is unavailable. Save the result locally and show clear submission status. Matches started without a server reservation remain local-only in this first design. Retry a reserved result after a brief outage while its submission window is valid; permanently rejected or expired results remain local. Do not call queued results ranked until the server accepts them. Keeping an online profile attached directly to the portable file would require a separately designed launcher/origin and authentication flow.

## Score trust

The browser currently owns all gameplay, including health, opponents, time and results. A modified client or direct API caller can invent plausible statistics. Authentication, HTTPS, rate limits, server-issued run IDs and bounds checks reduce impersonation, duplicates and obvious abuse; they do not verify gameplay. CORS and a secret embedded in the JavaScript bundle do not solve this.

For a casual community board, document this limit and provide moderation. For competitive rankings or prizes, plan server-authoritative simulation or deterministic input replays that the server re-simulates. Current frame-dependent execution and uses of `Math.random()` mean trustworthy deterministic replay would require substantial engine work, not just a new database table.

## Implementation sequence and validation

1. Agree on ranking, identity and trust level. Add immutable local results and the independent active-play clock.
2. Implement the API, Drizzle schema and migrations against a local PostgreSQL database. Test score bounds, session ownership, expiry, concurrent duplicate submissions and rollback.
3. Add leaderboard and result-screen UI. Test filters, one best result per player, ties, empty states and escaped display names.
4. Exercise normal results, wins, losses, practice/exploration, abandoned rounds, pauses, slow frames, reloads and service outages. Check that unavailable online features never prevent play.
5. Deploy the hosted version/API, verify same-origin sessions and database access, then smoke-test the portable build with networking disabled. Verify the release folder and ZIP remain consistent.

## Sources checked

- [Drizzle PostgreSQL support](https://orm.drizzle.team/docs/get-started-postgresql): supports the node-postgres and postgres.js drivers. The plan uses Drizzle on the server; choose compatible pinned package versions during implementation.
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations): schema changes can generate SQL migrations with `drizzle-kit generate` and apply them with `drizzle-kit migrate`.
- [PostgreSQL indexes and ordering](https://www.postgresql.org/docs/current/indexes-ordering.html): matching B-tree ordering is useful for ordered LIMIT queries.
- [MDN Access-Control-Allow-Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin): explains credentialed requests and why allowing the `null` origin is unsafe as a trust decision.
