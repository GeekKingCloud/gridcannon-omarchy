# Omarchy Grid Cannon

A **native Quickshell bar plugin** adapting Gridcannon by Tom Francis. A quiet 3×3 board with thin live-theme borders, twelve surrounding royal slots, and mouse/keyboard controls. No WebView, browser, web server, service, runtime Node dependency, remote assets, analytics, or copied card artwork.

Targets **Omarchy v4.0.4** (`c668141e9c42b13c80c9ca4ea108e11708c5e8a5`). This is an independent local candidate, not an official Omarchy component or a published release. The native `Panel` / `BarIconButton` / `KeyboardPanel` integration follows the [Snake plugin pattern](https://github.com/jhgundersen/omarchy-snake-plugin/blob/2e5afd4adc2a19e56be621561663fa9a7a79ffc3/Panel.qml). Colours, borders, fonts and scale come from Omarchy's live `Color`, `Border` and `Style` objects, not a bundled palette.

## Install and remove

Requires Omarchy's Quickshell shell/plugin system from the target release and its normal dependencies. An older Waybar-only Omarchy installation is not supported. Review this unsandboxed in-process plugin before enabling it.

For a reviewed **local checkout**, copy only the production files into a new plugin directory (do not overwrite an existing installation):

```sh
plugin="$HOME/.config/omarchy/plugins/geekkingcloud.gridcannon"
mkdir -p "$(dirname "$plugin")"
mkdir "$plugin"
cp manifest.json BarWidget.qml CannonButton.qml engine.mjs README.md LICENSE "$plugin/"
omarchy plugin validate "$plugin"
omarchy-shell shell rescanPlugins
omarchy plugin enable geekkingcloud.gridcannon
```

The widget defaults to the right bar section; move it through Omarchy's bar settings. Click the grid icon to toggle it. While enabled, its IPC target also supports:

```sh
omarchy-shell geekkingcloud.gridcannon open
omarchy-shell geekkingcloud.gridcannon close
omarchy-shell geekkingcloud.gridcannon toggle
```

Remove using `omarchy plugin remove geekkingcloud.gridcannon` (interactive confirmation). For a copied local directory, Omarchy keeps a hidden `.geekkingcloud.gridcannon.bak.*` backup beside the removed plugin; it is not registered or loaded. Disabling/removing/unloading ends the in-memory game. No daemon, service, theme files or persistent saved-game files require cleanup. The full-shell smoke test exercises installation/removal only in a disposable test HOME. No installation on the owner's machine or publication has been performed.

Closing and reopening the popup preserves the game, pending card and ploy selection because state belongs to the persistent bar widget, not the popup. A shell restart, plugin reload, or removing the widget discards that state. New game and mode changes require confirmation. There is no undo, timer or leaderboard.

## Controls

- Click a legal grid/royal cell or action. Accent borders identify legal targets; a `›` marker and a subtle fill indicate keyboard selection. Hearts/diamonds use the theme's semantic red hue with lightness/saturation adjusted for readability. Spades/clubs use theme text ink: near-black on light themes, light neutral on dark themes. Only rank/suit markings receive colour, including the held card; borders and fills keep their existing theme roles. Suit glyphs also distinguish the groups without relying on colour alone.
- **1–9:** grid cells in reading order. During the revised opening this replaces that cell once; choose **Keep deal** instead to skip replacement.
- **D:** draw. **Tab / Shift+Tab:** cycle legal targets/actions. **Arrows:** spatial movement on the board; move among actions outside it. **Enter / Space:** activate the selected target, not an implicit draw.
- **Extract:** select a grid stack. **Reassign:** select a source and then a distinct legal destination; **Escape** or **Cancel** cancels the selection without spending the ploy.
- A blocked number with no revised ploys can be clicked onto a highlighted royal as **armour**. In classic mode, **Hard reset** selects a stack to recycle while shaming the blocked card; **Recycle** selects a stack when the deck is empty.
- **N:** request a new game. **Mode:** request switching Classic/Revised. Confirmation defaults to Cancel; **Tab / arrows** change the choice, **Enter** activates it, **Y** confirms, **Escape** cancels.
- **? / Rules:** native help. Arrow keys or wheel scroll long help. **Escape** dismisses confirmation, help, selection, then popup in that order.

## Rules

Defeat the twelve royals bordering the 3×3 grid. Play numbers on equal or lower numbers, or empty spaces. A play at the opposite end of a row or column fires the **two intervening cards**, not the card just played. Shots do not consume the payload.

| Royal | Base health | Payload cards that count |
| ----- | ----------: | ------------------------ |
| Jack | 11 | Any suit |
| Queen | 12 | Same colour as the queen |
| King | 13 | Same suit as the king |

A failed shot does nothing; it does not immediately lose the game. Defeated royals remain in their slots. With no living royals, cycle non-royals beneath the deck until a royal is found. Royal placement chooses the highest eligible adjacent card of matching suit, then colour, then any suit; choose among ties. Living royal labels show current payload / health and added armour.

### Classic · creator's original v1

Start with eight non-royals and an empty centre. Aces (1) and jokers (0) are playable resets: return the old stack beneath the deck, leaving the special card in its place. A blocked number can become armour or go to the shame pile while a chosen stack is recycled. When the deck is empty, sacrifice a stack's top card to shame and use the rest as the new deck. Win with the smallest shame pile possible.

### Revised · creator's v2

Start with nine numbers; optionally replace one during setup. Bank aces and jokers as single-use ploys:

- **Ace / extraction:** recycle a whole stack beneath the deck, leaving an empty slot. A pending draw is preserved.
- **Joker / reassignment:** move one top card to a different legal position; that move can fire a shot.

If a number cannot be placed and no ploys remain, add it as armour to the lowest-ranked living royal of matching suit, then matching colour, then any suit. Armour stacks. The creator's stated v2 thresholds end the game at 20+ health (19+ for a king). An empty deck with no remaining ploys also ends play after resolving the final drawn card. Unspent ploys are the winning score, up to six.

## Sources, interpretation and licensing

Primary rules: [Tom Francis, “Gridcannon: A Single Player Game With Regular Playing Cards”](https://www.pentadact.com/2019-08-20-gridcannon-a-single-player-game-with-regular-playing-cards/). The visible **Version 2** section defines revised mode; expand **“Show the old version”** for the original v1. The intervening revisions discussion is not a third implemented mode.

The author welcomes digital adaptations, requests attribution and a title beyond just “Gridcannon”, and credits Chris Thursten for armour. This implementation does not copy article text, footage, illustrations, commercial art or third-party plugin code. It uses original QML shapes/text and the installed font's suit glyphs.

This implementation's code is **MIT licensed**; see [LICENSE](LICENSE). This matches [Omarchy's MIT licence at the targeted release](https://github.com/basecamp/omarchy/blob/c668141e9c42b13c80c9ca4ea108e11708c5e8a5/LICENSE). The code licence does not claim ownership of Tom Francis's game design or relicense his article, artwork, or any third-party dependencies. Gridcannon attribution and Chris Thursten's armour credit remain separate from the code licence.

The source leaves some digital details unspecified. These conventions are retained from the corrected rules engine, not a new house variant:

1. Only unoccupied exterior positions participate in royal similarity; the centre has no exterior neighbour. Defeated royals still occupy slots. If all eligible neighbours are empty, remaining positions tie.
2. Recycled stacks preserve bottom-to-top order. The first deck card is drawn.
3. An optional revised replacement banks specials, queues royals, and continues to a number for the vacated grid slot.
4. Armour similarity uses printed royal rank, not accumulated health. Classic's abbreviated armour rule uses the general suit/colour fallback. Classic hard reset recycles beneath the deck, like its ordinary reset.
5. Revised uses the stated 20/19 thresholds verbatim. Classic keeps its open-ended reset economy, with no added forced loss for an over-armoured royal; such a choice can become unwinnable.
6. A victory after exhausting the deck still displays unspent ploys; it is not claimed as an official scored run. The article explicitly scores wins without running out of cards.
7. If the last ploy kills the last living royal with a blocked number still pending, suspend that number, cycle to/deploy the next royal, then restore the number for resolution (normally armour). Preserve all 54 identities and cycled order. The twelfth kill wins immediately instead.

These conventions warrant a final rules review before calling this a definitive digital edition.

## Development and verification

No build/install step is needed for production. Development requires Node 22+, Python 3 and Quickshell; native UI checks additionally use Sway, grim, wtype and the QtTest QML module. No npm dependencies are required.

```sh
npm test
npm run test:qt
# Pass a local Omarchy checkout at exactly v4.0.4:
npm run test:native -- /path/to/omarchy-v4.0.4
bash /path/to/omarchy-v4.0.4/bin/omarchy-plugin-validate .
```

- `engine.mjs` is the single canonical ESM engine imported by Node and QML. Narrow Qt compatibility changes avoid missing `structuredClone`, `at`, and `flatMap` APIs without maintaining a second implementation.
- Node tests verify rules, invalid-action atomicity, all firing lanes, terminal states, the corrected pending-card regression, and 24 seeded full-deck simulations.
- Qt parity replays **6,537 complete-result calls** recorded from those suites inside real Quickshell. Its mutation check must reject a deliberately broken twelfth-kill condition. Tests fail on absent completion markers, runtime/load errors, or mismatches.
- The native harness freezes the whole production candidate with unmodified `Ui` and `Commons` from the pinned release, then starts an isolated headless Sway session. It drives actual QML actions, a QtTest mouse event through a real card MouseArea, and native keyboard input, tests the full softlock sequence and 54-card conservation, extraction, classic reset/refill, victory, opening replacement, confirmation, modes, Escape/reopen preservation, live palette changes, four bar edges and larger fonts. Harness IPC/fixtures exist only in `test/`, not production.
- Screenshots, logs and source-file hashes go under ignored `test-results/native/`. Tests stop only their own compositor/Quickshell/input processes. Runtime directories are local test artifacts. The old browser UI/server and browser tests were removed rather than shipping a dual UI.

- `npm run test:shell -- /path/to/omarchy-v4.0.4 /path/to/wlr-virtual-pointer-unstable-v1.xml` runs the **unmodified entire pinned shell** with its real registry and bar coordinator in another isolated HOME/Sway session. It enables the exact production files through the official CLI, checks duplicate-enable idempotence, clicks the real bar and game via a persistent compositor virtual pointer, draws by keyboard, compares game pixels across Escape/coordinator reopening, updates a watched theme override file and the normal theme IPC payload, then disables/re-enables/removes the plugin and checks registry/config/IPC/window cleanup. No fixture state or test hooks are added to production. Unrelated first-party services are explicitly disabled and session/system D-Bus are disconnected. This fixed 1200×900/default-font smoke additionally needs Pillow, a C compiler, pkg-config, wayland-client development files, wayland-scanner and the [wlr-protocols virtual-pointer XML](https://gitlab.freedesktop.org/wlroots/wlr-protocols/-/blob/master/unstable/wlr-virtual-pointer-unstable-v1.xml). Generated protocol code stays in ignored test output, not the plugin.
- At this release, `~/.config/omarchy/shell.toml` is watched; current-theme `colors.toml` and `shell.toml` are **startup-only** loads. Normal live theme switches use `shell applyTheme` IPC. The test follows that contract rather than assuming every theme file is watched.
- Full-shell screenshots, command transcript, production hashes and process cleanup proof go under `test-results/full-shell/`. Software-rendered captures are functional evidence, not publication-quality hardware screenshots.

The candidate passes local component and full-shell smoke testing, **not acceptance on an unavailable target machine**. A short target check still needs the actual Hyprland session, touch input, wallpaper, monitor scale and interaction with the owner's other enabled plugins before release.

## Files

Production: `manifest.json`, `BarWidget.qml`, `CannonButton.qml`, `engine.mjs`.

Tests: `test/engine.test.mjs`, `test/simulation.test.mjs`, `test/qt/`, `test/native/`, `test/full-shell/`.
