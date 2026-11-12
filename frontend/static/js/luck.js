// Luck games page — Lucky Spin wheel and game list.
(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SEGMENT_COLORS = [
    '#ff6b00', '#6c3ad6', '#1f9e6b', '#c9372c', '#2f80ed',
    '#b8860b', '#8e44ad', '#16a085', '#d35400',
  ];

  const wheel = document.getElementById('lucky-wheel');
  const spinButton = document.getElementById('spin-btn');
  const status = document.getElementById('spin-status');
  const pointsChip = document.getElementById('luck-points');
  const playerLabel = document.getElementById('luck-player-label');
  const signinNote = document.getElementById('spin-signin-note');

  const state = {
    cost: 100,
    segments: [],
    points: 0,
    loggedIn: false,
    spinning: false,
    rotation: 0,
  };

  function polar(radius, angleDeg) {
    const radians = ((angleDeg - 90) * Math.PI) / 180;
    return { x: radius * Math.cos(radians), y: radius * Math.sin(radians) };
  }

  function buildWheel(segments) {
    wheel.replaceChildren();
    const step = 360 / segments.length;
    segments.forEach((segment, index) => {
      const start = index * step;
      const end = start + step;
      const from = polar(100, start);
      const to = polar(100, end);
      const largeArc = step > 180 ? 1 : 0;

      const slice = document.createElementNS(SVG_NS, 'path');
      slice.setAttribute(
        'd',
        `M0,0 L${from.x.toFixed(2)},${from.y.toFixed(2)} A100,100 0 ${largeArc} 1 ${to.x.toFixed(2)},${to.y.toFixed(2)} Z`,
      );
      slice.setAttribute('fill', SEGMENT_COLORS[index % SEGMENT_COLORS.length]);
      slice.setAttribute('stroke', '#121212');
      slice.setAttribute('stroke-width', '1.5');
      wheel.appendChild(slice);

      const mid = start + step / 2;
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', '0');
      label.setAttribute('y', '-64');
      label.setAttribute('transform', `rotate(${mid})`);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('fill', '#ffffff');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', '700');
      label.setAttribute('font-family', 'inherit');
      label.textContent = `${segment.points} pts`;
      wheel.appendChild(label);
    });
  }

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `spin-status${type ? ` ${type}` : ''}`;
  }

  function updatePoints(points) {
    state.points = points;
    pointsChip.textContent = `${Number(points).toLocaleString('en-US')} pts`;
  }

  function updatePlayer() {
    if (!state.loggedIn) {
      setStatus('Sign in to play Lucky Spin.', 'error');
      signinNote.classList.remove('hidden');
      spinButton.disabled = true;
      playerLabel.textContent = 'Sign in to play';
      return;
    }
    signinNote.classList.add('hidden');
    playerLabel.textContent = `You have ${Number(state.points).toLocaleString('en-US')} points`;
    spinButton.disabled = false;
  }

  async function loadInfo() {
    try {
      const [gameResponse, settingsResponse] = await Promise.all([
        fetch('/api/games/lucky-spin', { credentials: 'include' }),
        fetch('/api/settings', { credentials: 'include' }),
      ]);
      const game = await gameResponse.json();
      if (!gameResponse.ok) throw new Error(game.error || 'Could not load the game.');

      state.cost = Number(game.cost) || 100;
      state.segments = game.segments || [];
      state.loggedIn = Boolean(game.logged_in);
      updatePoints(Number(game.points) || 0);
      buildWheel(state.segments);
      spinButton.textContent = `Spin · ${state.cost} pts`;
      updatePlayer();

      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        if (settings.shop_name) {
          document.getElementById('shop-name').textContent = settings.shop_name;
          document.title = `${settings.shop_name} — Luck Games`;
        }
      }
    } catch (error) {
      setStatus(error.message || 'Could not load the game.', 'error');
      spinButton.disabled = true;
    }
  }

  async function spin() {
    if (state.spinning) return;
    if (!state.loggedIn) {
      setStatus('Sign in on the home page to play.', 'error');
      return;
    }
    if (state.points < state.cost) {
      setStatus(`You need ${state.cost} points to spin. You have ${state.points}.`, 'error');
      return;
    }

    state.spinning = true;
    spinButton.disabled = true;
    setStatus('Spinning…');

    try {
      const response = await fetch('/api/games/lucky-spin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not spin.');

      const step = 360 / state.segments.length;
      const centerAngle = result.segment * step + step / 2;
      const jitter = (Math.random() * 2 - 1) * (step * 0.28);
      const targetMod = (((360 - (centerAngle + jitter)) % 360) + 360) % 360;
      const currentMod = ((state.rotation % 360) + 360) % 360;
      const delta = ((targetMod - currentMod + 360) % 360) + 360 * 5;

      state.rotation += delta;
      wheel.style.transform = `rotate(${state.rotation}deg)`;

      window.setTimeout(() => {
        updatePoints(result.points);
        setStatus(`🎉 You won ${Number(result.prize_points).toLocaleString('en-US')} points!`, 'win');
        state.spinning = false;
        spinButton.disabled = false;
        spinButton.textContent = `Spin · ${state.cost} pts`;
        updatePlayer();
        if (state.points < state.cost) {
          setStatus(`🎉 You won ${Number(result.prize_points).toLocaleString('en-US')} points! You need ${state.cost} to spin again.`, 'win');
        }
      }, 4300);
    } catch (error) {
      state.spinning = false;
      spinButton.disabled = false;
      setStatus(error.message || 'Could not spin.', 'error');
    }
  }

  spinButton.addEventListener('click', spin);
  loadInfo();
})();
