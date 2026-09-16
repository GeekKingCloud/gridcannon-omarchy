# Omarchy Gridcannon

A local, keyboard-friendly adaptation of **Gridcannon by Tom Francis**, styled with a Tokyo Night–inspired palette and monospace interface to sit comfortably alongside Omarchy.

This is a standalone browser-app candidate, **not a Quickshell plugin or an official Omarchy component**. No runtime dependencies, external fonts, accounts, analytics, or remote assets. The interface, card designs, and icon are original CSS/SVG; suit glyphs use your installed font.

## Run

Requires Node.js 22 or newer. From this directory:

```sh
npm start
```

Open **http://127.0.0.1:4173**. No package installation is needed to play. The server binds only to loopback and serves an explicit allowlist of app assets, not the repository.

For a desktop-style window, with Chromium installed:

```sh
chromium --app=http://127.0.0.1:4173
```

Keep the server running while playing. Stop it with Ctrl+C. This repository does not install a launcher, persistent service, or change your Omarchy configuration. Another local port can be selected with `PORT=4180 npm start`.

Games live in memory: refreshing or closing the page ends the current game. Starting a new game or changing mode asks for confirmation. There is deliberately no undo or timed play.

## Play

Defeat the twelve royals bordering a 3×3 grid. Play numbers on equal or lower numbers, or on empty spaces. A play at the opposite end of a row or column fires the **two intervening cards**, not the card you just played. Shots do not consume the payload.

| Royal | Base health | Payload cards that count |
| ----- | ----------: | ------------------------ |
| Jack  |          11 | Any suit                 |
| Queen |          12 | Same colour as the queen |
| King  |          13 | Same suit as the king    |

A failed shot does nothing; it does **not** immediately lose the game. Defeated royals remain in their slots. When no living royals remain, drawing skips non-royals, returning those cards beneath the deck, until a royal is found.

Green borders mark legal targets. Royal badges show **current payload / health**, with a diamond marking added armour. Hover or focus a grid card for its firing-line preview. Royal placement chooses the highest eligible matching suit, then colour, then any suit; choose freely among ties.

- Click a card or use **1–9** for the grid in reading order.
- **Space** draws when focus is not on another interactive control.
- **Tab / Enter / Space** operate focused controls normally.
- **N** requests a new game; **?** opens rules; **Escape** cancels a ploy selection or dismisses a dialog.

### Classic · creator's original v1

Start with eight non-royals and an empty centre. Aces (value 1) and jokers (value 0) are playable resets: return the old stack under the deck and leave the special card in its place. A blocked number can either become armour or go to the shame pile while you recycle a stack. When the deck is empty, sacrifice a stack's top card to shame and use the rest as the new deck. Win with the smallest shame pile possible.

### Revised · creator's v2

Start with nine number cards. Optionally replace one during the opening. Aces and jokers are banked as single-use **ploys**:

- **Ace / extraction:** recycle a whole stack under the deck, leaving a blank slot. Can be used before placing a pending draw.
- **Joker / reassignment:** move a single top card to a different legal position; the move can fire a shot.

If a drawn number cannot be placed and no ploys remain, it becomes **armour** on the lowest-ranked living royal of matching suit, then matching colour, then any suit. Armour adds its value to that royal's health and stacks. Following the creator's stated v2 thresholds, 20+ health (19+ for a king) ends the game. An empty deck with no remaining ploys also ends it, after resolving the last drawn card. Unspent ploys are the winning score, up to six.

## Source and interpretation notes

Primary source: [Tom Francis, “Gridcannon: A Single Player Game With Regular Playing Cards”](https://www.pentadact.com/2019-08-20-gridcannon-a-single-player-game-with-regular-playing-cards/). The visible **Version 2** section defines revised mode; expand **“Show the old version”** to read **Gridcannon v1 (old)**. The intervening “Revisions To Old Version” section is historical discussion, not a third implemented mode.

The author explicitly welcomes digital adaptations and asks for attribution and a title beyond just “Gridcannon”. Credit for the armour idea goes to Chris Thursten. This implementation does not copy the article, footage, illustrations, or commercial game assets.

The source calls the mechanic **armour**, not shields or extra turns. The published original v1 uses shame and recycling rather than the v2 hard-failure economy. Those are intentionally separate modes, not a hybrid inferred from third-party versions.

The physical rules leave some digital details unspecified. This candidate uses these explicit conventions:

1. Only **unoccupied border positions** participate in royal-placement similarity; the centre is ineligible because it has no exterior neighbour. Defeated royals still block slots. If all neighbouring grid cards are empty, all remaining border positions tie.
2. Stacks returned to the deck preserve bottom-to-top order. Deck draws take the first card.
3. If an optional v2 replacement reveals specials, bank them; queue royals for placement and continue to a number for the vacated grid slot. The source's single “draw a new card” does not fully specify this case.
4. Armour similarity uses a royal's printed rank, not its accumulated health. Original v1's abbreviated armour rule uses the same suit/colour fallback as its general similarity rule. Original hard reset returns the selected stack under the deck, like its ordinary reset.
5. Revised uses the author's stated 20/19 armour loss thresholds verbatim rather than silently changing the 20 boundary. Classic retains its original open-ended reset economy; it has no added forced-loss rule for an over-armoured royal, so choosing that armour can create an unwinnable position. Prefer a hard reset in that case.
6. A victory after the draw pile reaches zero still displays unspent ploys; no leaderboard or claim of an official scored run is made. The article only explicitly awards a score for wins without running out of cards.
7. If the last ploy kills the last living royal while a blocked number is still in hand, automatically cycle to the next royal and deploy it first, then restore the blocked number for resolution (normally armour). The no-living-royal rule requires cycling, but does not specify this pending-card interaction; suspending the hand preserves the card and its obligation rather than discarding it or declaring defeat. Cycled cards retain their order beneath the deck; a twelfth kill still wins immediately.

These conventions should receive a final rules review before treating this candidate as a definitive digital edition.

## Verification

Engine and server tests use Node's built-in runner:

```sh
npm test
```

Browser tests use Playwright as a **development-only** dependency:

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

Or reuse a system Chromium without downloading a browser:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

The browser suite starts and stops its own loopback server on port 4174. It exercises real DOM interactions, keyboard input, ploys, mode switching, restart confirmation, and a 390px mobile layout. Screenshots are written under ignored `test-results/`. Unit fixtures verify both rule sets, every firing direction, colour/suit restrictions, illegal-action atomicity, recycling, armour and terminal states. `npm start` is the application itself; there is no separate build step.

## Files

- `engine.mjs`: immutable game transitions and rule queries; no DOM or random draw dependence after setup.
- `app.mjs`, `index.html`, `style.css`, `icon.svg`: responsive interface and original visuals.
- `server.mjs`: local-only static app server with an asset allowlist and restrictive CSP.
- `test/`: deterministic engine and server tests.
- `e2e/`, `playwright.config.mjs`: browser interaction checks.

Not yet provided: persisted games, theme-file integration, native desktop packaging, or a release installer. No system installation is required or performed.
