# PBX Documentation Center — Technoline IP-PBX

> **AI INSTRUCTIONS:**
> You are helping a Hebrew-speaking developer integrate with the Technoline PBX.
> **Always respond in Hebrew.** This document is in English purely for token efficiency
> and to give you precise technical reference. Read it fully before suggesting any
> integration path. When the user asks "how do I…", first determine **which of the two
> API types** the task belongs to, then point to the matching detailed reference
> (see "Detailed References" at the bottom of this file).

---

## 1. Overview — Two Independent API Surfaces

Working with the Technoline PBX is split into **two completely separate channels** that
flow in opposite directions. This split is the most important concept to internalize
— picking the wrong one will produce a working-looking solution that integrates with
nothing.

| | **Module API** | **Interaction API** |
|---|---|---|
| **Direction** | PBX → your server | your server → PBX |
| **Who initiates** | The PBX, when a call hits an extension | You, programmatically |
| **Auth** | None (URL is the identifier) | `apiKey` (and IP whitelist for some endpoints) |
| **Format** | PBX sends GET, your server returns JSON | You POST/GET, PBX returns JSON |
| **Use case** | Drive a live call's flow dynamically | Manage extensions, run campaigns, trigger calls |
| **Endpoint** | A URL **you host** | `api.tlivr.com/<api>.php` |

A typical full integration uses **both**: you use the Interaction API to load an
extension tree and start an outbound campaign, and you use Module API to decide what
each call does once it's answered.

### 1.1 Mental model

- The **PBX is "the phone"** — it can dial, play audio, capture DTMF, record, hang up.
- **Your server is "the brain"** — it knows your business logic, your data, your users.
- **Module API** is the wire between brain and phone, *during a call*.
- **Interaction API** is the wire between your back-office and the phone system,
  *outside of any specific call* — managing the system itself.

---

## 2. Module API — PBX → Your Server (during a call)

When a caller reaches an extension that is configured to use a remote URL, the PBX
hits **your server** with a GET request and parameters describing the call. Your
server replies with a JSON object describing **one module** the PBX should execute.
After the module runs (caller pressed a key, recording finished, etc.), the PBX
calls your server again with the result, and you decide the next step.

### 2.1 Flow

```
caller dials → PBX → GET https://your-server/handler.php?param=...
                                                                      ↓
                                                  your server returns JSON
                                                                      ↓
                                            PBX executes the module (play, menu, record…)
                                                                      ↓
                                            PBX calls your server again with the result
                                                                      ↓
                                              loop until you return type:"hangup" / chained
```

### 2.2 The Call-Flow Modules

Every JSON response **must** include `"type"` set to one of these. The "Key fields"
column lists the **exact** parameter names the engine reads — spelling matters, an
unrecognized key is silently ignored.

| `type` | Purpose | Key fields (exact spelling) |
|---|---|---|
| `simpleMessage` | Play audio (one or more files) | `files` |
| `audioPlayer` | Media-player style playback | `files`, `startFile`, `startSecond`, `endFile`, `playCount`, `playLength`, `keyActions` (per-key map; value `apiCall` = call an API on keypress), `apiUrls`, `apiAfters` |
| `playerControl` | **Only meaningful in a player-key (`apiCall`) callback context** — instructs the player what to do when control returns to it (seek/jump/next/speed/exit). Executed after the other modules in the same response | `action` (`resume`/`restart`/`position`/`secondsForward`/`secondsBack`/`minutesForward`/`minutesBack`/`next`/`back`/`speedUp`/`speedDown`/`volumeUp`/`volumeDown`/`lastPositions`/`end`/`exit`), `seconds`, `minutes`, `position` |
| `simpleMenu` | Play a menu and route by key | `files`, `times`, `enabledKeys` (default `ALL`), `timeout`, `errorReturn`, `extensionChange`, `extensionPathChange`, `goToId`, `goTo` |
| `getDTMF` | Capture digits without a menu | `files`, `min`, `max`, `timeout`, `confirmType`, `skipKey`, `skipValue` |
| `record` | Record the caller | `files`, `fileName`, `max`, `saveFolder`, `confirm`, `sttSoft` (best-effort background transcription — see §2.6) |
| `stt` / `recordSTT` | Record + speech-to-text transcription (Hebrew). Optional **bias** to a closed value-list — see §2.5 | `files`, `fileName`, `max`, `saveFolder`, `sttMode`, `sttCities`, `sttPhrases`, `sttNeighborhoods`, `sttBoost`, `sttSnap` |
| `simpleRouting` | Route the call to a phone number | `dialPhone`, `displayNumber`, `addDigits`, `routingMusic`, `ringSec`, `limit`, `campaignBilling`, `endCall`, `cancelKey` |
| `ipRouting` | Route to an IP/SIP destination | `dialIP` (+ `dialPhone`) |
| `queueRouting` | Route into a call-router/queue — **either** a saved router (`routerId`) **or** a full inline block supplied at call time | `routerId` (saved router) **or** `router` (inline settings object: `waitingDuration`, `ringDuration`, `callerId`, `failingAction`, `closeAction`, `email`…) + `phones` (real-time list of numbers to dial — rings them in parallel, first to answer gets the call) |
| `goTo` (alias `extensionChange`) | Jump to another extension | `goTo` / `extensionPathChange` (by path), `extensionIdChange` / `extensionChange` (by id) |
| `switchSystem` | Switch the call into another system | `targetNum`, `targetPath` |
| `switchReturn` | Return from a `switchSystem` (pops the switch stack) | `returnPath`, `noSourceAction` (default `hangup`), `goToPath` |
| `changeUrl` (alias `changeLink`) | Swap the API endpoint mid-call | `url`, `clearRequest` (default `yes`) |
| `hangup` | End the call | (none) |
| `playAllCampaigns` | Play queued campaign audios | (none — `daysBack` is an extension-config value, not honored from the response) |
| `lastCampaign` | Play the **last campaign sent** to the caller | `playBy` (`phone` default = by recipient's phone / `did` = last campaign on the dialed number / `templete` = default template), `phone` (override the recipient phone to look up — default = the caller; e.g. a number captured via `getDTMF`), `did` (override the dialed number), `campaignId` (play a specific campaign by id — overrides `playBy`) |
| `creditCard` | Credit-card capture & charge. Installments can be billed as a standing order without an authorization hold (frame capture), or let the caller choose, via `paymentsMode` (`regular`/`keva`/`ask`). `paymentsMode=kevaMonthly` creates a standing order by a fixed monthly amount with no month limit (optional `kevaMonths` cap, `kevaDay` billing day) | `terminal`, `payments`, `paymentsMode`, `kevaMonths`, `kevaDay` |
| `systemMessages` | Override system prompts (S-codes) — see "Request management" below; usable standalone or attached to any module | `systemMessages` map/list |

Each module also accepts shared "fixed parameters" controlling timing, retries, error
audio, etc. The PBX appends call metadata (caller ID, extension, timestamp, captured
DTMF, recording URL) to every callback.

> **Player-key callbacks:** when an `audioPlayer` key is configured as `apiCall`
> (in the extension settings, a key template, or the module's `keyActions` +
> `apiUrls`/`apiAfters` maps), pressing it mid-playback calls that key's URL with
> the standard params **plus** `event=playerKey`, `playerKey`, `playerFileId`,
> `playerFileName`, `playerFileTitle`, `playerPosition` (seconds, e.g. `73.4`),
> `playerFileIndex`, `playerFilesCount`. The response may use any module above and
> optionally one `playerControl`. Without a `playerControl`, the key's `apiAfter`
> setting decides (`resume` default / `restart` / `next` / `exit`); a response that
> jumps to another extension (`goTo`/`switchSystem`) stops the playback resume. Routing modules add result fields back to the
callback (status plus `STEXT_<name>`, `ANSWERL_<name>`, `RINGL_<name>`); `record`/`stt`
add `FILE_<name>`, `FILEID_<name>`, `PATH_<name>`, `DIGIT_<name>`, `SIZE_<name>`,
`DURATION_<name>` (a `record` with `sttSoft` also adds `TEXT_<name>`); `creditCard` adds
`CONFIRM_<name>`.

**Accumulation control — `paramsMode`** (extension-config value, not a `type`): `chain`
(default) accumulates captured values across callbacks; `last` keeps only the values
from the previous response. This determines what gets re-sent on each callback.

**Request management (general values, not a `type`).** Set on the extension config or
inside any response: `addParams` attaches constant `key=value` flags appended to every
callback (e.g. call-position markers) — they persist as fixed params, survive a
`changeUrl` `clearRequest`, and re-sending a key updates it. `removeParams` is a list of
keys to strip from the accumulated request going forward (system `PBX...` params are
always kept). Both accept an object `{"pos":"step3"}`, a pairs array
`[{"key":"pos","value":"step3"}]`, or for `removeParams` a key list `["otp"]`.
`systemMessages` overrides system prompts (the `S...` codes — e.g. the credit-card module
prompts) for the rest of the call: a map `{"S3008":[…files…]}` (or list `[{"sm":"S3008","files":[…]}]`)
where each value is a **regular files-array** (`name`/`text`/`SF`/`number`/`digits`/…). An empty
files value reverts that code to its DB default. Send it standalone as `{"type":"systemMessages",…}`
or attach it to any module element (applied before that module runs).

### 2.3 Critical rule

**If your server returns invalid JSON or a `type` the PBX doesn't recognize, the PBX
sends the caller back to the previous menu automatically.** There is no error to the
caller — the call just retreats. So bugs in your handler manifest as "the menu keeps
repeating" from the caller's perspective.

### 2.4 No apiKey

Module API has no `apiKey`. The endpoint URL itself is the identifier — it was wired
into the extension by an admin. **Do not** try to authenticate inbound PBX requests
with a header your server checks; just trust the URL is private.

→ **Detailed reference:** `apiModuleDocs.html` (Hebrew, full reference) and
`מדריך-API-מרכזיה.md` (Hebrew Markdown).

### 2.5 STT transcription bias — cities & streets

A plain `stt`/`recordSTT` transcribes free Hebrew speech, which is unreliable for a
**known, closed answer space** (a city name, a street name). When the expected answer
is one of a finite list, attach a bias and the engine does two things:

1. **Recognition bias** — the candidate list is sent to Google STT as `speechContexts`,
   steering recognition toward those values.
2. **Snap** — the transcript is then snapped to the closest valid value in the list
   (Levenshtein, relative-distance threshold), so the returned value is always a real
   list entry. A transcript too far from any entry is left untouched. Snap is on by
   default; disable with `"sttSnap": false`.

The value lists come from a built-in dataset of **all Israeli cities and streets**
(official רשות האוכלוסין list, table `ivr_streets`) — **Israel only**. You don't upload
anything — you just pick the scope per recording.

**City-name matching is forgiving.** `sttCities` matches the dataset's Hebrew names
tolerantly: spacing, hyphens, quotes and full/defective spelling (כתיב מלא/חסר) are
ignored — `"תל אביב יפו"` resolves to `תל אביב - יפו`, `"קריית שמונה"` to `קרית שמונה`.
A name that matches nothing (or is ambiguous, e.g. bare `"מודיעין"` with several
`מודיעין*` cities) simply yields **no bias** — the recording still transcribes as plain
STT, it does not error. For a guaranteed match, pass the **numeric city code** instead of
the name.

| Field | Value | Meaning |
|---|---|---|
| `sttMode` | `"cities"` / `"streets"` | `cities` = bias to all Israeli city names; `streets` = bias to the streets of the cities in `sttCities` |
| `sttCities` | `"ירושלים,בני ברק"` | Comma-separated city list (names **or** numeric city codes). Required for `streets` mode |
| `sttPhrases` | `"אדום,כחול,ירוק"` or array | An **explicit** value list — overrides `sttMode` (use for any custom closed list, not just addresses) |
| `sttNeighborhoods` | `true`/`false` | Include neighborhood entries (`שכ …`) in `streets` mode. Default `false` |
| `sttBoost` | number (default `15`) | Bias strength; `10`–`20` recommended. Too high → false positives |
| `sttSnap` | `true`/`false` | Snap the result to the nearest list value. Default `true` |
| `sttStrict` | `true`/`false` | **Reject** any result not in the list (after snap) → the transcription returns "not recognized" and the record flow re-prompts. Default `false` |

**Soft bias vs. strict.** By default the list is a *bias*, not a whitelist: Google STT
stays a general recognizer, so if the caller clearly says something off-list (a phone
number, a sentence) it is transcribed as-is — `speechContexts` only tips ambiguous audio
toward the list, and `snap` only rewrites a result that is *close* to a list entry. Set
`"sttStrict": true` to enforce a closed answer: anything that doesn't snap to a real list
value is rejected (the module reports no valid result, so a `confirm`/retry loop asks
again). Use strict for "must be a real street/city"; leave it off when the recording may
legitimately contain free speech.

**`sttCities` is a runtime value, not a constant.** In a "street in the city the caller
chose" flow, your handler fills `sttCities` with whatever the caller just selected — the
`city=…` value from the previous `stt` callback, a city mapped from a menu keypress
(`1`→`ירושלים`, `2`→`בני ברק`), or a lookup from your DB. Because your server builds each
JSON response per-callback (§2.1), you simply inject that value:
`"sttCities": <the city the caller chose>`. The examples below hardcode a city only for
readability.

**Limits & guidance.** Google v1 caps a request at **5,000 phrases**; the engine
truncates beyond that (logged to verbose). Jerusalem alone is ~4,380 streets, so pass
**one city at a time** for streets — it both stays under the cap and gives the best
accuracy (less competing noise). City mode is ~1,300 phrases. A typical two-step
address flow: first an `stt` with `sttMode:"cities"` to capture the city, then a follow-up
`stt` with `sttMode:"streets"` scoped to that city.

```json
{ "type": "stt", "name": "city",   "files": [{ "text": "באיזו עיר?" }], "sttMode": "cities" }
{ "type": "stt", "name": "street", "files": [{ "text": "מה הרחוב?" }], "sttMode": "streets", "sttCities": "בני ברק" }
```

The snapped transcript comes back on the callback as `<name>=<value>` (e.g.
`street=רבי עקיבא`), exactly like a normal `stt` result.

### 2.6 Background transcription on a plain recording (`sttSoft`)

A normal `stt`/`recordSTT` *forces* the transcription: it re-prompts the caller until the
speech is recognized, and plays the transcript back for confirmation. That is the wrong
behavior when you mainly want **the recording** and the text is only a nice-to-have (a
searchable summary, a routing hint, analytics). For that, add `"sttSoft": true` to a plain
`record`:

- The caller experience is **identical to a plain `record`** — same `confirm` flow, **no**
  transcript playback, and **no** "say it again" loop if recognition fails.
- After the recording is captured, the PBX makes **one** best-effort transcription attempt
  in the background.
- The transcript comes back as `TEXT_<name>` (empty string if recognition failed). The
  primary `<name>` parameter stays the **file name**, exactly like a plain `record`.

`sttSoft` accepts the same bias fields as `stt` (`sttMode`, `sttCities`, `sttPhrases`,
`sttBoost`, `sttSnap`, … — see §2.5). It is ignored on `stt`/`recordSTT` (those already
transcribe and confirm) — it only *adds* transcription to a plain `record`. A successful
transcription is billed like any STT (only when it succeeds); a failed attempt just returns
an empty `TEXT_<name>` and the call continues.

```json
{ "type": "record", "name": "msg", "sttSoft": true, "confirm": "no",
  "files": [{ "text": "אנא השאירו הודעה לאחר הצליל" }] }
```

Callback: `msg=<file name>`, `TEXT_msg=<transcript or empty>`, plus the usual
`FILE_msg`, `FILEID_msg`, `PATH_msg`, `SIZE_msg`, `DURATION_msg`, `DIGIT_msg`.

---

## 3. Interaction API — Your Server → PBX

This is the conventional REST-ish surface. A few base URLs cover the whole thing —
`ivrFilesApi.php` multiplexes several surfaces by `action=`:

| Endpoint | Doc | Purpose |
|---|---|---|
| `https://api.tlivr.com/campaignApi.php` | `campaignApiDocs.html` | Voice outbound campaigns |
| `https://api.tlivr.com/ivrFilesApi.php` | `ivrExtensionsApiDocs.html` | Extension tree, files, settings, system messages |
| `https://api.tlivr.com/ivrFilesApi.php` (`action=makeCall`) | `makeCallApiDocs.html` | One-shot outbound 2FA call — caller-ID-as-OTP, or `mode=voice` spoken OTP |
| `https://api.tlivr.com/ivrFilesApi.php` (`action=click2call`) | `click2callApiDocs.html` | Click-to-call: ring the agent extension, then bridge to the target |
| `https://api.tlivr.com/mailingListsApi.php` | `mailingListsApiDocs.html` | Mailing lists (create, rename, delete, enumerate) and their contacts (import, search, block, delete) |

### 3.1 Common shape

- Action selector: `action=<name>` parameter on every request.
- Auth: `apiKey=<your-key>` on every request — query string, JSON body, or
  form-urlencoded body.
- Encoding: `application/x-www-form-urlencoded` is the default. JSON body is
  accepted too. File uploads use `multipart/form-data`.
- Response: always JSON. Success: `{ "status": "OK", … }`. Failure:
  `{ "status": "ERROR", "note": "<reason in Hebrew>" }`. Some older endpoints use
  `"Ok"`/`"Error"` casing — compare case-insensitively.

### 3.2 Voice Campaigns — `campaignApi.php`

Drive outbound voice broadcasts: load a recipient list (uploaded as CSV / phone
list, or an existing mailing list via `mailingList`), play a recorded audio file or
a Module API tree, monitor progress, throttle or stop.

| `action=` | What it does |
|---|---|
| `campaignRun` | Create + start a campaign with a phone list and audio source |
| `campaignsHistory` | List all campaigns for the account |
| `campaignReport` | Full per-recipient report for one campaign |
| `max_ringSet` | Set max concurrent dial rate on a running campaign |
| `campaignHold` | Pause an active campaign |
| `campaignResumption` | Resume a paused campaign (within window) |
| `campaignStop` | Permanently stop |

> Keypress re-targeting is **not** a separate action — it is configured by
> `keysAction-<N>` parameters (N = 1–8) passed inside `campaignRun`. Besides the
> classic values (`replay`, `digits`, `routing-<phone>`…), each key can now run the
> campaign-level actions per key: `playFile-<ivrName>` (play another file),
> `extension-<ext>` (run a full IVR extension), `apiUrl-<url>` (hand call control
> to your server via the Module-API protocol, with `event=digitPressed` + `digit=N`).
> The parameter is everything after the FIRST hyphen. Only meaningful when the
> campaign plays audio (`audioFile`/`audioText`). Invalid parameter → `errorCode 28`.

> **Recipients** come from either `phones` (JSON array / uploaded comma-separated
> file) **or** `mailingList` — one or more comma-separated mailing-list IDs, resolved
> server-side at dispatch. Sending both is a mistake: `mailingList` wins and `phones`
> is discarded silently. Contacts blocked inside the list are skipped, duplicates
> across lists collapse, and the account opt-out filter still applies on top. Lists
> are created/managed through `mailingListsApi.php`.

**Auth:** all requests take `apiKey`. The **IP whitelist** (`Access denied` for an
unapproved origin IP) is enforced specifically on `campaignRun` and `testCampaign` —
approve your origin IP in your personal area, under the **"אבטחת API" (API Security)** tab before running campaigns.

### 3.3 Extension Management — `ivrFilesApi.php`

The full UI/CRUD surface for the extension tree and everything attached to it.
Designed so you can build a complete admin panel without hardcoding anything — the
API itself ships the UI schema (field types, dropdown options, form layouts).

Bootstrap flow for a new admin UI:

1. `getUiSchema` — one call: returns `types` (extension kinds), `fields` (input
   metadata), `forms` (per-type form layouts), `accountSettings`.
2. `foldersList` — load the extension tree.
3. `folderSettings` — load one extension's current settings.
4. `getOptions2?list=a,b,c` — fetch values for any dropdown whose `options` is
   `"GET"` (dynamic).
5. `extensionSet` — save edits.

Other actions cover: file upload (`uploadFile`), permission management, system
message overrides (text or recorded audio per extension), extension creation /
deletion / reordering.

**Required:** `apiKey` only — no IP whitelist on this endpoint.

### 3.4 2FA Outbound Call — `makeCall`

Trigger a *very short* outbound call whose only purpose is to display a custom
caller ID on the recipient's phone. By default the call hangs up the instant the
recipient answers — no audio, no interaction. Used for two-factor codes (the OTP
*is* the caller-ID suffix), delivery notifications, and similar one-shot signals.

Required parameters: `phone` (recipient), `cid` (**4–6 digit** code — fewer or more
is an error).

**Caller-ID construction:**
- **Default** (no `callerId`): `0510` + the `cid`, left-padded with zeros to 6 digits.
  `cid=123456` → `0510123456`; `cid=1234` → `0510001234` (i.e. `051000`+`1234`).
- **Custom** (`callerId=<approved number>`): the `cid` digits are appended to the end
  of an outbound identity that is **approved for the system** (main number, an extra
  access number, or a verified DID). `callerId=main`/`system`/`self` = the system's
  main number. Unapproved number → `errorCode 5`. Same approval set the dialer/campaign
  uses (`getCallerIdDids` + `call_num` + `$num` + `ivr_accessNumbers`).

**Delivery mode (`mode`):**
- `cid` (default) — code shown in the caller ID; call not answered.
- `voice` — **spoken voice OTP**: the call is answered and reads
  *"סיסמתך החד פעמית הוא &lt;code&gt;"* (digit-by-digit) **twice**, then hangs up, with
  **no press-9** unsubscribe prompt. Implemented by **reusing `campaignApi.php`'s
  `campaignRun`** (TTS via `tts_new.php`, queue send) — a single internal self-call
  authenticated by `apiKey` + the internal `IP_SECRET_PHONE_VERIFY_TOKEN`;
  **no campaign logic is duplicated**. Voice mode **requires the system's `apiKey`**
  and returns `campaignId` on success. Two behaviours are handled automatically for
  this internal call (no account permission or balance needed):
  - **Free** — it does **not** charge units and does **not** require a balance
    (scoped in `campaignRun` to `$internalTrusted && type=test`, so a leaked token
    can't send free *bulk* campaigns).
  - **Press-9 suppression** is automatic — it does **not** need the account's
    `removalBlock` permission.

  Optional `voiceText` overrides the spoken text: it **must** contain the `{code}` (or
  `{קוד}`) placeholder and be **≤ 200 chars**, else `errorCode 8` / `errorCode 7`
  respectively (anti-abuse). The message is announced twice.

Rate limit: **up to 5 calls per phone per 2 minutes, and 15 per hour** (both modes).

**Auth:** IP whitelist always required (returns **HTTP 403** from unapproved IPs).
`mode=cid` needs **no** `apiKey`; `mode=voice` **also requires** the system `apiKey`.

---

## 4. Authentication & IP Whitelist Cheat Sheet

Origin IPs are approved self-service in your personal area, under the **"אבטחת API" (API Security)** tab. (Developers: for troubleshooting, contact customer support.)

| API | apiKey? | IP whitelist? |
|---|---|---|
| Module API (PBX → you) | ❌ no | ❌ no (URL is private) |
| `campaignApi.php` (`campaignRun` / `testCampaign`) | ✅ required | ✅ required |
| `campaignApi.php` (other actions) | ✅ required | ❌ no |
| `ivrFilesApi.php` (extensions / files) | ✅ required | ❌ no |
| `ivrFilesApi.php?action=click2call` | ✅ required | ❌ no |
| `ivrFilesApi.php?action=makeCall` (`mode=cid`, default) | ❌ no | ✅ required |
| `ivrFilesApi.php?action=makeCall` (`mode=voice`) | ✅ required | ✅ required |
| `mailingListsApi.php` | ✅ required | ❌ no |

To get an `apiKey`, or to register an IP, the customer must contact the Technoline
technical team. Each IP is approved individually — there is no wildcard.

---

## 5. Common Conventions

### 5.1 Response shapes

```json
{ "status": "OK" }
{ "status": "OK", "note": "...", "data": { ... } }
{ "status": "ERROR", "note": "תיאור השגיאה" }
```

### 5.2 Module API JSON example

```json
{
  "type": "simpleMenu",
  "files": [{ "name": "menu_main" }],
  "enabledKeys": "123",
  "times": 3,
  "timeout": 5
}
```

### 5.3 Encoding rules

- **Default:** GET with query string, or POST with `application/x-www-form-urlencoded`.
- **JSON body:** accepted on all POST endpoints; required for `saveCustomMessagesBeta`.
- **multipart/form-data:** required when uploading files (`uploadFile`,
  `campaignRun` with audio/recipient list).

### 5.4 Hebrew text

All `note` fields and most `name` fields contain Hebrew text. Encode requests as
UTF-8. The endpoints handle UTF-8 transparently — no special header required.

### 5.5 Audio file references

In Module API responses, `fileName` refers to a file already uploaded to the
account's audio library through `ivrFilesApi.php`. The PBX resolves the name to
the actual audio file at runtime. A common workflow is: upload audio with
`uploadFile`, then reference its name from your Module API handler.

---

## 6. Picking the Right API — Decision Tree

```
Does the work happen DURING a phone call?
│
├── YES → Module API (your server returns JSON to drive the call)
│         Doc: apiModuleDocs.html
│
└── NO → Interaction API
          │
          ├── Outbound campaign / phone broadcast?
          │   → campaignApi.php   (campaignApiDocs.html)
          │
          ├── Manage the extension tree, files, permissions, system messages?
          │   → ivrFilesApi.php   (ivrExtensionsApiDocs.html)
          │
          ├── Bridge an agent extension to a target number (click-to-call from a CRM)?
          │   → ivrFilesApi.php?action=click2call   (click2callApiDocs.html)
          │
          ├── Create/delete a mailing list, or manage its contacts
          │   (import / search / block / delete)?
          │   → mailingListsApi.php   (mailingListsApiDocs.html)
          │
          └── Trigger ONE outbound call to display a code (2FA-style)?
              → ivrFilesApi.php?action=makeCall   (makeCallApiDocs.html)
```

---

## 7. Common Pitfalls

1. **Returning HTML or plain text from the Module API handler.** The PBX expects
   JSON only. An HTML error page from your server makes the call retreat to the
   previous menu silently.

2. **Forgetting `action=` on Interaction API calls.** Without it the request hits
   the dispatcher's "no action" fallback and you get an opaque error.

3. **Mixing up `"Ok"` vs `"OK"` in success checks.** Compare case-insensitively.

4. **Hardcoding form fields for `ivrFilesApi.php`.** Use `getUiSchema` once and
   render dynamically — extension field shape changes between types and over time.

5. **Sending campaign requests from a backend that runs behind a load balancer
   without sticky outbound IP.** Each instance's IP must be whitelisted; otherwise
   campaigns randomly fail with `Access denied`.

6. **Trusting the rate limiter on `makeCall`.** Do your own debouncing — calling
   the same phone twice quickly returns an error and confuses users.

---

## 8. Detailed References

When the user asks for specifics — exact parameter lists, all available fields,
response examples — point them to the matching detailed doc:

| Topic | HTML (Hebrew) | Markdown |
|---|---|---|
| Module API (call flow modules) | `apiModuleDocs.html` | `מדריך-API-מרכזיה.md` |
| Voice Campaigns | `campaignApiDocs.html` | `campaignApi.md` |
| Extension Management | `ivrExtensionsApiDocs.html` | `ivrExtensionsApiDocs.md` |
| Click-to-Call | `click2callApiDocs.html` | `click2callApiDocs.md` |
| Mailing Lists | `mailingListsApiDocs.html` | `mailingListsApiDocs.md` |
| 2FA / makeCall | `makeCallApiDocs.html` | — |
| Voice Streaming (BYO-AI) | `streamingApiDocs.html` | `streaming-byoai.md` |

Hub page (Hebrew, RTL): `pbxDocsCenter.html` — links every doc and acts as the
landing page for human developers.

---

## 9. Quick-Start Recipes (sketches the AI can expand)

### 9.1 IVR menu that routes by caller phone number

1. Admin wires extension `100` to URL `https://your.server/ivr.php`.
2. Caller dials → PBX hits `ivr.php?caller=05X-XXXXXXX&extension=100`.
3. Your server looks up `caller`, returns:
   ```json
   { "type": "simpleMenu", "files": [{ "name": "main_menu" }], "enabledKeys": "123" }
   ```
4. Caller presses `2` → PBX hits `ivr.php?caller=…&extension=100&dtmf=2`.
5. Your server returns `{ "type": "simpleRouting", "dialPhone": "0501234567" }`.

### 9.2 SMS-replacement OTP via call

**Silent (caller-ID) OTP — default:**
1. User submits a sign-in form on your site.
2. Your backend calls
   `POST https://api.tlivr.com/ivrFilesApi.php?action=makeCall&phone=<user>&cid=123456`
   (or `cid=1234` → shows `…001234`; add `callerId=main` to present the system's own number).
3. User's phone rings showing caller ID `…123456`.
4. The call drops the second they answer.
5. User types `123456` back into your form.

**Spoken OTP — `mode=voice`:**
1. Same as above but call
   `…/ivrFilesApi.php?action=makeCall&phone=<user>&cid=8391&mode=voice&apiKey=<key>`.
2. The call is **answered** and reads *"סיסמתך החד פעמית הוא 8 3 9 1"* twice, then hangs up
   (no press-9, handled automatically). It runs as a 1-recipient campaign via `campaignRun`,
   returns a `campaignId`, and is **free** (no units charged / required). Use when the
   recipient can't see/keep the caller ID.

### 9.3 Outbound voice broadcast

1. Upload a CSV of phone numbers + audio file via `campaignRun` (multipart).
2. Poll `campaignsHistory` / `campaignReport` for status.
3. Pause / resume / stop with `campaignHold` / `campaignResumption` /
   `campaignStop` if needed.

### 9.4 Building an admin panel for the extension tree

1. Call `getUiSchema` once on app load.
2. Call `foldersList` to render the tree.
3. On extension click: `folderSettings` for current values + iterate
   `forms[type]` against `fields[input]` to render the form, calling `getOptions2`
   for any `options:"GET"` dropdowns.
4. On save: `extensionSet`.

### 9.5 Spoken address capture (city → street) with STT bias

1. Caller reaches your handler. Return an `stt` scoped to all cities:
   ```json
   { "type": "stt", "name": "city", "files": [{ "text": "באיזו עיר אתה גר?" }], "sttMode": "cities" }
   ```
2. PBX calls back with `city=<recognized-and-snapped city>` (always a real city).
3. Read that `city` value and inject it into a second `stt` scoped to its streets
   (here the `city` from step 2 is substituted into `sttCities`, not hardcoded):
   ```json
   { "type": "stt", "name": "street", "files": [{ "text": "מה שם הרחוב?" }],
     "sttMode": "streets", "sttCities": "<city from step 2>" }
   ```
4. PBX calls back with `street=<snapped street name>`. Store the city+street pair.

> For a non-address closed list (product names, departments, yes/no synonyms…), skip
> the dataset and pass your own list via `sttPhrases` — the same recognition-bias +
> snap behavior applies.

---

## 10. Voice Streaming — Bring-Your-Own-AI (BYO-AI)

A **third** surface, distinct from the two above: real-time bidirectional audio.
The customer runs their **own** voice AI; the PBX connects **out** to the customer's
WebSocket for each call and streams telephony audio both ways. The customer's AI can
also drive real call actions. Built-in agents (our Gemini) need none of this — this
is only for the customer's own model. Billed **per channel-minute**.

**Setup:** Modules → סטרימינג → create a channel → set the WebSocket URL + optional
Bearer secret → get a `token` → attach it to an IVR extension via a "סטרימינג" node.

**Connection (per call):** `GET wss://customer/voice` with `Authorization: Bearer
<secret>` if configured. One socket = one call.

**Audio:** raw PCM, 16-bit signed LE, mono, **8000 Hz**. Binary WS frames both ways
(we send ~320 bytes / 20 ms; they may send any chunk size, at ~real-time). Resample
on the customer side.

**Events we send (binary = caller audio; text = JSON):**
```json
{"type":"start","callId":"<uuid>","caller":"05…","system":"07…","token":"<tok>","format":"pcm16;rate=8000;ch=1"}
{"type":"dtmf","digit":"5"}
{"type":"hangup"}
```

> **Note on `dtmf` (current limitation):** the fleet runs Asterisk 20.x, whose
> AudioSocket application forwards **audio frames only** — keypad presses never
> reach the gateway, so no `dtmf` event is delivered today. DTMF forwarding over
> AudioSocket arrives with Asterisk 22; until the fleet is upgraded, collect digits
> *before* the streaming node (an IVR menu) or ask the caller to speak.
> `hangup` **is** sent whenever the caller hangs up (the socket then closes).

**Commands the customer sends (binary = their AI's voice; text = JSON):**

| `type` | fields | terminal? | effect |
|---|---|---|---|
| `transfer_extension` | `target` = IVR path (e.g. `/2`) | yes | route to an IVR extension/path |
| `transfer_phone` | `target` = phone number | yes | dial an external number |
| `transfer_queue` | `target` = queue id | yes | route to an agent queue |
| `hangup` | — | yes | end the call |
| `clear` | — | no | barge-in: drop our queued playback audio |
| `save_answer` | `field`, `value` | no | log a survey answer (channel logs + Excel export) |

A **terminal** command ends the streaming session and hands the live call back to
the PBX engine (same engine the built-in bot uses) to execute. We drain up to ~6 s
of queued audio first so the caller hears the closing sentence. `clear` and
`save_answer` are non-terminal. Send at most one terminal command per call. Never
put a caller-dictated number (ID, card) into a `transfer_*` target — use
`save_answer`.

Full guide: `streamingApiDocs.html` / `streaming-byoai.md`.

---

*Last updated: 2026-07-01.*
