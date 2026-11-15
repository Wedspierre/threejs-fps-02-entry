// Rounds and money: the match state machine. A match is first to 5 round wins. Each
// round opens with a 12 s buy phase, then up to 100 s of live play. A round ends on
// elimination, on the bomb exploding, on a defuse, or on the clock: with no plant the
// defenders take it. Kills pay $300, a plant pays $300, a win pays $3,250, a loss $1,900.
export const BUY_SECONDS = 12;
export const ROUND_SECONDS = 100;
export const BOMB_SECONDS = 35;
export const PLANT_SECONDS = 3;
export const DEFUSE_SECONDS = 5;
export const WIN_ROUNDS = 5;
export const KILL_REWARD = 300;
export const PLANT_REWARD = 300;
export const WIN_REWARD = 3250;
export const LOSS_REWARD = 1900;
// Team plans, picked once per match: every attacker hits A, every attacker hits B,
// or the squad splits two and two. The HUD shows the plan; the bots follow it.
export const PLANS = ['A', 'B', 'SPLIT'];

export function createMatch() {
  return {
    phase: 'menu', // menu | buy | live | roundEnd | matchEnd
    phaseTime: 0,
    round: 1,
    scoreEmber: 0,
    scoreAshen: 0,
    money: 800,
    kills: 0,
    deaths: 0,
    plan: 'SPLIT',
    bomb: {
      state: 'carried', // carried | dropped | planted | gone
      carrier: 'player', // 'player' or a bot; null only while dropped
      x: 0,
      z: 0,
      site: null, // 'A' | 'B'
      timer: BOMB_SECONDS,
    },
    roundWinner: null,
    roundReason: '',
    matchWinner: null,
    lastEvent: '',
  };
}

export function startMatch(match) {
  match.phase = 'buy';
  match.phaseTime = BUY_SECONDS;
  match.round = 1;
  match.scoreEmber = 0;
  match.scoreAshen = 0;
  match.money = 800;
  match.kills = 0;
  match.deaths = 0;
  match.plan = PLANS[Math.floor(Math.random() * PLANS.length)];
  match.matchWinner = null;
  match.roundWinner = null;
  match.roundReason = '';
  match.bomb.state = 'carried';
  match.bomb.carrier = 'player';
  match.bomb.site = null;
  match.bomb.timer = BOMB_SECONDS;
}

export function startRound(match, round) {
  match.round = round;
  match.phase = 'buy';
  match.phaseTime = BUY_SECONDS;
  match.roundWinner = null;
  match.roundReason = '';
  match.bomb.state = 'carried';
  match.bomb.carrier = 'player';
  match.bomb.site = null;
  match.bomb.timer = BOMB_SECONDS;
}

export function beginLive(match) {
  match.phase = 'live';
  match.phaseTime = ROUND_SECONDS;
}

// The round is over when one side is wiped out, the bomb goes off, it is defused, or
// the clock runs out with no plant. Returns 'ember' | 'ashen' | null with a reason.
// With the charge planted and the attackers dead, the round plays on: the defenders
// still have to defuse before the timer runs out.
export function roundOutcome(match, emberAlive, ashenAlive) {
  const planted = match.bomb.state === 'planted';
  if (planted && match.bomb.timer <= 0) return ['ember', 'The charge detonated'];
  if (!ashenAlive) return ['ember', planted ? 'Site held — charge still ticking' : 'Ashen crew wiped out'];
  if (!emberAlive && !planted) return ['ashen', 'Emberline wiped out'];
  if (match.phaseTime <= 0 && !planted) return ['ashen', 'Time expired — no plant'];
  return [null, ''];
}

export function endRound(match, winner, reason) {
  match.phase = 'roundEnd';
  match.phaseTime = 4;
  match.roundWinner = winner;
  match.roundReason = reason;
  if (winner === 'ember') {
    match.scoreEmber += 1;
    match.money += WIN_REWARD;
  } else {
    match.scoreAshen += 1;
    match.money += LOSS_REWARD;
  }
  match.bomb.state = 'gone';
  if (match.scoreEmber >= WIN_ROUNDS || match.scoreAshen >= WIN_ROUNDS) {
    match.matchWinner = match.scoreEmber >= WIN_ROUNDS ? 'ember' : 'ashen';
  }
}

export function nextRound(match) {
  if (match.matchWinner) {
    match.phase = 'matchEnd';
    match.phaseTime = 0;
    return false;
  }
  startRound(match, match.round + 1);
  return true;
}
