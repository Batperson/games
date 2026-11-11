# Games repo: notes for Claude

Browser games published with GitHub Pages at https://batperson.github.io/games/ from the `main` branch root of `Batperson/games`. Pushing to `main` republishes within about a minute.

## Layout

Everything is flat in the repo root by the owner's preference (no subdirectories).

| File | What it is |
|---|---|
| `index.html` | "Games Arcade" menu page, one card per game. Add a card when adding a game. |
| `four-rivers-gold.html` | 大發財 · Four Rivers Gold. Fully self-contained single file. |
| `regolith-runner.html` | Regolith Runner. Single file, built by inlining the original `style.css` and `game.js`. |
| `pebblebrook.html` + `pebblebrook-data.js`, `pebblebrook-textures.js`, `pebblebrook-game.js`, `three.min.js` | Pebblebrook, a three.js block world. |
| `.nojekyll` | Keeps Pages from running Jekyll. |

The working originals live outside this repo in a sibling folder `../games/` (`sichuan/`, `moon-patrol/`, `pebblebrook/`). `sichuan/` holds the three Four Rivers versions as separate files (`four-rivers-gold.html`, `-v2.html`, `-v3.html`); in this repo they are successive commits to the one file. If a game is edited in `../games/`, re-copy (and for Regolith Runner re-inline, for Pebblebrook re-apply the script renames) before committing here.

## Git and GitHub

- Commits use the repo-local identity `Batperson <16805899+Batperson@users.noreply.github.com>`. Do not use the machine's global git identity here; it is a work address and this repo is public.
- The GitHub CLI is not on PATH in Git Bash. Call it as `"/c/Program Files/GitHub CLI/gh.exe"`.
- Two accounts are signed in to `gh`. The Batperson account must be active to push; check with `gh api user --jq .login`. The owner switches accounts themselves or asks for it; switch back to the other account afterwards if you changed it.
- Push without touching global git config:
  `git -c credential.helper= -c "credential.helper=!'/c/Program Files/GitHub CLI/gh.exe' auth git-credential" push`
- Check a deploy: `gh api repos/Batperson/games/pages/builds/latest --jq .status` until `built`, then `curl` the pages.

## Testing without a display

Headless Edge can screenshot a page, which is how layout and art were checked:

`msedge --headless=new --disable-gpu --hide-scrollbars --window-size=1400,900 --virtual-time-budget=6000 --user-data-dir=<scratch dir> --screenshot=<png> <file URL>`

- To zoom in on a detail, load the page in an `<iframe>` with a CSS `transform: scale()` inside a scratch HTML file and screenshot that. Python PIL is not installed.
- Audio cannot be checked this way. Say so when reporting; the owner judges the tunes by ear.
- Check script syntax with node: extract the `<script>` body and pass it to `new Function(...)`.

## Four Rivers Gold

Mahjong "Four Rivers" (Shisen-Sho style) solitaire: match identical tiles joined by a path of at most two turns, including around the outside edge. Theme is 1930s Shanghai, casino/slot-machine wealth: red, gold, and (from v2) jade as a third colour. The neon sign reads 金玉滿堂.

Structure of the single file, in order: CSS, shared SVG gradients, HUD and overlays markup, then one script with these sections: tile art (`faceSVG`), start-screen scene (`buildScene`), audio, particles, game logic, win sequence, UI wiring.

- **Board:** `G.cells` is a flat array with an empty border ring; `findPath` is a three-segment BFS; `findAnyMove` drives hints, deadlock detection and auto-play. Deals are retried until a greedy solver clears them; a dead end triggers a free reshuffle.
- **Tiles:** 36 kinds. 萬 suit as characters, the circles suit drawn as square-holed coins, the bamboo suit drawn as gold bars, winds, dragons, plus two bonus tiles (財 and a yuanbao) that pay extra.
- **Money:** the jackpot decays with a half-life per table size from the first click; pairs bank $1,000 times a combo multiplier (4 second window, max ×10); hint and shuffle cost money; a three-reel bonus spin multiplies the saved jackpot at the end. Best totals are stored in `localStorage` under `frg-best-<stake>`.
- **Audio:** all synthesised with WebAudio. `AU.tune` selects the music: 0 Classic (pentatonic chiptune, 16th grid, `playStep`), 1 Swing (時代曲 foxtrot, 12-step triplet grid, `playSwing`), 2 Tango (D minor, habanera bass, `playTango`). The TUNE button and `M` key cycle 3, 2, 1, off. Melodies are strings of `Note:length` tokens parsed by `mel()`; each bar must sum to the grid size. Tempo rises with `G.urgency` as the jackpot drains.
- **Debug hooks:** `#play` deals the large table immediately; `#auto` makes the game play itself to the win screen (useful for screenshots).

### Version history

- **v1:** original. Silhouette-style gent and lady, Classic tune only.
- **v2:** anime-style figures (jade qipao; navy pinstripe suit and fedora), jade accents, Swing tune added.
- **v3:** manhua / Shanghai calendar-poster style figures with slim eyes (crimson qipao, fur stole, champagne, wink; ivory dinner jacket, coin flip), Tango tune added. Known weak spot: the fur stole is built from circles and reads as puffs.

### Owner's preferences for this game

- Authentic Chinese characters, traditional forms, never Japanese forms. Keep `lang="zh-Hant"` on Chinese text so Han-unified glyphs render in their Chinese shapes.
- Figures: realistic proportions, sophisticated, a little glamorous and vivacious, but nothing unsuitable for a 13-year-old. The owner asked to move away from Japanese anime (no big eyes) toward Chinese manhua.
- Figures and music must be original. The Bund (上海灘) and 斗地主 were given as mood references only; do not recreate their characters, art or music.
- New variants go in as new versions for comparison rather than overwriting silently: a new file in `../games/sichuan/`, and a new commit to `four-rivers-gold.html` here.
- Lean into the "grab as much money as you can" theme: coins, gold bars, yuanbao, red.

## Other games

- **Regolith Runner:** original coin-op style lunar rover game on a 320×224 canvas inside an arcade-cabinet page. Keyboard (C/5 coin, Enter/1 start, arrows speed, Space jump, Z/X fire, P pause, M mute) and on-screen touch buttons.
- **Pebblebrook:** cosy first-person block world on three.js with villagers, quests, a backpack and a saved world. Keyboard and mouse only (pointer lock), so desktop.

All games must stay original: same genre or mechanics as existing games is fine, recreating a specific existing game is not.
