// The DOM HUD: crosshair, hit marker, health, ammo, money, round timer, score, kill feed,
// buy menu, plant progress and a live minimap. It never touches the simulation; main.js
// pushes numbers in and reads the play callback out.
import { WEAPONS, GRENADE_PRICE } from './weapons.js';

const COPY = {
  start: {
    title: 'EMBERLINE',
    copy: 'Kestrel Foundry. Plant the charge at A or B — or wipe the Ashen crew out. First to 5 rounds takes the yard.',
    action: 'Click to play',
  },
  paused: {
    title: 'EMBERLINE',
    copy: 'Paused. Click to resume.',
    action: 'Click to resume',
  },
  roundEnd: {
    title: 'Round over',
    copy: '',
    action: 'Next round',
  },
  matchEnd: {
    title: 'Match over',
    copy: '',
    action: 'Play again',
  },
};

export function createHud(world) {
  const el = (id) => document.getElementById(id);
  const overlay = el('overlay');
  const title = el('overlay-title');
  const copy = el('overlay-copy');
  const play = el('play');
  const ammoMag = el('ammo-mag');
  const ammoReserve = el('ammo-reserve');
  const weaponName = el('weapon-name');
  const healthNum = el('health-num');
  const healthFill = el('health-fill');
  const moneyValue = el('money-value');
  const timerValue = el('timer-value');
  const scoreEmber = el('score-ember');
  const scoreAshen = el('score-ashen');
  const roundNum = el('round-num');
  const killfeed = el('killfeed');
  const message = el('message');
  const banner = el('banner');
  const buyMenu = el('buy-menu');
  const buyMoney = el('buy-money');
  const crosshair = el('crosshair');
  const hitmarker = el('hitmarker');
  const damage = el('damage');
  const plantBar = el('plant-bar');
  const plantFill = el('plant-fill');
  const plantLabel = el('plant-label');
  const grenadeCount = el('grenade-count');
  const bombStatus = el('bomb-status');
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');
  let hitTimer = 0;
  let messageTimer = 0;
  let bannerTimer = 0;
  let last = {};

  function setText(node, key, value) {
    if (last[key] !== value) {
      last[key] = value;
      node.textContent = value;
    }
  }

  return {
    setAmmo(mag, reserve, name) {
      setText(ammoMag, 'mag', String(mag));
      setText(ammoReserve, 'reserve', `/ ${reserve}`);
      setText(weaponName, 'weapon', name);
      el('ammo').classList.toggle('empty', mag === 0);
    },
    setHealth(hp) {
      const value = Math.max(0, Math.ceil(hp));
      setText(healthNum, 'hp', String(value));
      healthFill.style.width = `${value}%`;
      healthFill.classList.toggle('low', value <= 30);
    },
    setMoney(value) {
      setText(moneyValue, 'money', `$${value}`);
      setText(buyMoney, 'buymoney', `$${value}`);
    },
    setTimer(seconds, label) {
      const s = Math.max(0, Math.ceil(seconds));
      setText(timerValue, 'timer', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
      setText(roundNum, 'round', label);
    },
    setScore(ember, ashen) {
      setText(scoreEmber, 'se', String(ember));
      setText(scoreAshen, 'sa', String(ashen));
    },
    setGrenades(count) {
      setText(grenadeCount, 'nades', `HE x${count}`);
    },
    setBombStatus(text) {
      setText(bombStatus, 'bomb', text);
    },
    setSpread(spread) {
      const gap = Math.round(3 + spread * 900);
      crosshair.style.setProperty('--gap', `${Math.min(26, gap)}px`);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.classList.toggle('kill', killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    damageFlash() {
      damage.classList.add('on');
      setTimeout(() => damage.classList.remove('on'), 180);
    },
    killfeed(text) {
      const row = document.createElement('div');
      row.textContent = text;
      killfeed.prepend(row);
      while (killfeed.children.length > 5) killfeed.removeChild(killfeed.lastChild);
      setTimeout(() => row.remove(), 6000);
    },
    showMessage(text, ms = 2600) {
      message.textContent = text;
      message.hidden = false;
      clearTimeout(messageTimer);
      messageTimer = setTimeout(() => {
        message.hidden = true;
      }, ms);
    },
    hideMessage() {
      clearTimeout(messageTimer);
      message.hidden = true;
    },
    showBanner(text, ms = 3400) {
      banner.textContent = text;
      banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => {
        banner.hidden = true;
      }, ms);
    },
    hideBanner() {
      clearTimeout(bannerTimer);
      banner.hidden = true;
    },
    showPlant(label, progress) {
      plantBar.hidden = false;
      plantLabel.textContent = label;
      plantFill.style.width = `${Math.round(progress * 100)}%`;
    },
    hidePlant() {
      plantBar.hidden = true;
    },
    showBuy(money, ownedPrimary) {
      buyMenu.hidden = false;
      this.setMoney(money);
      for (const item of buyMenu.querySelectorAll('[data-buy]')) {
        const id = item.dataset.buy;
        const price = id === 'grenade' ? GRENADE_PRICE : WEAPONS[id].price;
        item.classList.toggle('cant', money < price);
        item.classList.toggle('owned', id === ownedPrimary);
        item.querySelector('.price').textContent = id === ownedPrimary ? 'OWNED' : `$${price}`;
      }
    },
    hideBuy() {
      buyMenu.hidden = true;
    },
    showOverlay(mode, detail) {
      const text = COPY[mode];
      title.textContent = text.title;
      copy.textContent = detail ?? text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
    drawMinimap(player, bots, bomb) {
      const w = minimap.width;
      const h = minimap.height;
      const sx = w / 47;
      const sz = h / 35;
      const px = (x) => (x + 23.5) * sx;
      const pz = (z) => (z + 17.5) * sz;
      mapCtx.clearRect(0, 0, w, h);
      mapCtx.fillStyle = 'rgba(20,18,15,0.82)';
      mapCtx.fillRect(0, 0, w, h);
      mapCtx.fillStyle = '#3a332b';
      for (const r of world.wallRects) {
        mapCtx.fillRect(px(r.x - r.w / 2), pz(r.z - r.d / 2), Math.max(1, r.w * sx), Math.max(1, r.d * sz));
      }
      mapCtx.font = '700 11px system-ui, sans-serif';
      mapCtx.textAlign = 'center';
      mapCtx.fillStyle = '#e8a33d';
      mapCtx.fillText('A', px(-17), pz(-11) + 4);
      mapCtx.fillText('B', px(17), pz(-11) + 4);
      if (bomb.state === 'dropped' || bomb.state === 'planted') {
        mapCtx.fillStyle = bomb.state === 'planted' ? '#ff5a3c' : '#e8a33d';
        mapCtx.beginPath();
        mapCtx.arc(px(bomb.x), pz(bomb.z), 4, 0, Math.PI * 2);
        mapCtx.fill();
      }
      for (const bot of bots) {
        if (!bot.alive) continue;
        mapCtx.fillStyle = bot.team === 'ember' ? '#3fb8a6' : '#c65a3a';
        mapCtx.beginPath();
        mapCtx.arc(px(bot.mover.state.position.x), pz(bot.mover.state.position.z), 3, 0, Math.PI * 2);
        mapCtx.fill();
      }
      mapCtx.fillStyle = '#efe8da';
      mapCtx.beginPath();
      mapCtx.arc(px(player.state.position.x), pz(player.state.position.z), 3.5, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#efe8da';
      mapCtx.beginPath();
      mapCtx.moveTo(px(player.state.position.x), pz(player.state.position.z));
      mapCtx.lineTo(
        px(player.state.position.x - Math.sin(player.state.yaw) * 4),
        pz(player.state.position.z - Math.cos(player.state.yaw) * 4),
      );
      mapCtx.stroke();
    },
  };
}
