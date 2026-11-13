# Local simulated leaderboard

This standalone Node.js service is for local development and tests only. Player IDs, nicknames, session IDs and scores are caller-supplied simulations, not authenticated identities or verified game outcomes. It listens only on `127.0.0.1`, serves the playtest and allows only same-origin browser requests; it does not provide CORS. Any local process can still submit arbitrary simulated scores. Do not expose it publicly. Real deployment requires authenticated identities and server-verified settlement before recording scores.

From this directory, using Node.js 18 or later:

```sh
node leaderboard.cjs
node --test leaderboard.test.cjs
```

Playtest: `http://127.0.0.1:8787/trix-hunt/`. Set `PORT` to change the port (0 chooses an available port). Set `TRIX_LEADERBOARD_DIR` to choose the data directory; otherwise it uses `trix-hunt-leaderboard` under the OS temporary directory. `rounds.json` persists between restarts, but temporary directories can be cleared by the OS. Use only one server process per data directory; there is no interprocess locking.

## API

`POST /round` requires `Content-Type: application/json` and a body no larger than 4096 bytes, for example:

```json
{"sessionId":"round-1","playerId":"player-1","nickname":"Trix Fan","shots":10,"hits":7}
```

Exactly those five fields are required. IDs are case-sensitive, globally unique for sessions, and consist of 1–64 ASCII letters, digits, underscores or hyphens. A nickname is at most 128 characters before sanitization: characters other than ASCII letters, digits, spaces, periods, underscores and hyphens are removed, surrounding spaces trimmed, and runs of spaces collapsed. The resulting nickname must be 1–24 characters. `shots` and `hits` are integers with `0 <= hits <= shots <= 10`. A player's most recently recorded round determines their displayed nickname.

An accepted round returns 201 with `{"recorded":true,"round":{...}}`. Repeating the same normalized round with the same session ID returns 200 and `recorded:false`; reusing the ID with different normalized data returns 409. Invalid JSON or fields return 400, oversized bodies 413, and the wrong content type 415. Persistence failures return 500 without recording the round.

`GET /leaderboard` returns `{"players":[...]}`. Each entry contains `rank`, `playerId`, `nickname`, total `hits`, total `shots`, `rounds`, and `accuracy` (hits divided by shots; zero when shots are zero). Players rank by total hits descending, then exact aggregate accuracy descending, then case-sensitive ASCII player ID ascending. Ranks are consecutive, including ties. Unknown routes return 404; foreign-origin browser requests return 403.

Example from PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/round -ContentType application/json -Body '{"sessionId":"round-1","playerId":"player-1","nickname":"Trix Fan","shots":10,"hits":7}'
Invoke-RestMethod http://127.0.0.1:8787/leaderboard
```
