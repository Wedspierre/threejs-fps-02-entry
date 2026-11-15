# Emberline — Tactical FPS at Kestrel Foundry

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/Wedspierre/threejs-fps-02-entry/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/Wedspierre/threejs-fps-02-entry/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A round-based tactical shooter in the style Counter-Strike made famous, built on
three.js 0.187.0. Two teams, short rounds, money between rounds, and gunfire where
accuracy counts more than speed — on an original map, with original names, art and
sound (all synthesised in code, no assets downloaded).

## The game

You are Emberline, attacking Kestrel Foundry — a decommissioned foundry yard with
three lanes and two bomb sites: **A (Crane Bay)** under the old gantry crane and
**B (Furnace Hall)** beside the cold furnace. First to 5 rounds takes the yard.

- **Rounds:** 12 s buy phase, then up to 100 s of live play. Win by eliminating the
  Ashen crew, or by planting the charge and letting it detonate. Lose the round if
  your squad is wiped out, the charge is defused, or the clock runs out with no plant.
- **Money:** win +$3250, lose +$1900, kill +$300, plant +$300. Spend it in the buy
  menu (`B` during the buy phase).
- **Arsenal:** P-9 Sidewinder pistol (free), VK-7 Carbine rifle ($2700), Moth-9 SMG
  ($1500), Longshot DMR ($4750). Every gun fires, reloads and runs dry; headshots
  deal 3–4x damage.
- **Grenades:** HE ($300), Smoke ($200) and Flash ($200), max 2 of each. `G` throws
  the selected grenade, `H` cycles it. Smoke lays a cloud that blocks sight — bots
  lose targets through it. Flash whites out whoever looks at it: the screen fades
  back over a couple of seconds, and blinded bots stand still and cannot shoot.
- **Team plan:** each match picks a plan — all to A, all to B, or a two-and-two
  split — shown on the HUD and in the buy menu. The four allies follow it: they
  walk their site's lanes, hold its angles and plant the charge there.
- **Gunplay:** recoil and spread punish firing on the move — stop, aim, shoot.
  Movement has acceleration, friction, crouch and jump, and the map collides.
- **Bots:** four allies (Kestrel, Vex, Rook, Juno) and five enemies (Ash, Cinder,
  Soot, Flint, Slag) — a full 5v5. They walk waypoint routes, hold positions,
  react to what they see and hear, plant and defuse the charge, and shoot back
  with aim that steadies as they settle. They carry visible rifles.
- **HUD:** health, ammo, money, round timer, score, kill feed, live minimap, the
  team plan, grenade counts, and a plant/defuse progress bar.
- **The yard itself:** every surface is drawn by the game's own code at runtime —
  concrete floor slabs, riveted wall panels, stencilled crates, hazard stripes, a
  dusk sky with a low sun and cloud streaks (`game/src/textures.js`). Warm yard
  lamps light the lanes; the furnace glows behind its grate; nothing is
  downloaded, nothing is borrowed.

## Capturing screenshots

The four screenshots are staged frames of real gameplay, never menus. Serve the
game with `node serve.ts` (http://localhost:8080), open each URL from
`shots.json` at 1280×720 in desktop Chrome, wait for `window.__shotReady`, and
capture the viewport:

| File | Capture |
| --- | --- |
| `1-cover.jpg` | `?shot=cover&seed=7` — squad firefight down mid |
| `2-plant.jpg` | `?shot=plant&seed=7` — charge planted at Site A |
| `3-buy.jpg` | `?shot=buy&seed=7` — buy menu over the live yard |
| `4-push.jpg` | `?shot=push&seed=7` — lane push behind a smoke cloud |

Each image must be ≤256 KiB, long side ≤1280, short side ≥480. The first by
name is the cover.

## Controls

| Key | Action |
| --- | --- |
| WASD / Mouse | Move / look |
| Click | Fire |
| R | Reload |
| Q / 1 / 2 | Switch weapon |
| G | Throw grenade (selected kind) |
| H | Cycle grenade (HE → Smoke → Flash) |
| E (hold) | Plant the charge inside a site |
| B | Buy menu (buy phase) |
| Ctrl | Crouch |
| Space | Jump |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — no build step, no network request.

## Repository

- Owner: **Wedspierre**
- Referral: `ta01qs0h`
- Entry: [`threejs-fps-02`](https://make.fun/bounty/threejs-fps-02) on make.fun

---

<sub>Entered on [make.fun](https://make.fun/?ref=ta01qs0h&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
