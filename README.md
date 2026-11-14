# Emberline — Tactical FPS at Kestrel Foundry

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
  ($1500), Longshot DMR ($4750), HE grenade ($300, max 2). Every gun fires, reloads
  and runs dry; headshots deal 3–4x damage.
- **Gunplay:** recoil and spread punish firing on the move — stop, aim, shoot.
  Movement has acceleration, friction, crouch and jump, and the map collides.
- **Bots:** two allies (Kestrel, Vex) and four enemies (Ash, Cinder, Soot, Flint).
  They walk waypoint routes, hold positions, react to what they see and hear, plant
  and defuse the charge, and shoot back with aim that steadies as they settle.
- **HUD:** health, ammo, money, round timer, score, kill feed, live minimap, and a
  plant/defuse progress bar.

## Controls

| Key | Action |
| --- | --- |
| WASD / Mouse | Move / look |
| Click | Fire |
| R | Reload |
| Q / 1 / 2 | Switch weapon |
| G | Throw grenade |
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
- Entry: `threejs-fps-02` on make.fun
