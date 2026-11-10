// Five-step delivery simulation: one new stage every three seconds.
const Tracker = {
  timer: null,
  activeIndex: 0,
  options: null,

  startStages: function (options) {
    Tracker.reset();
    Tracker.options = { intervalMs: 3000, ...options };
    Tracker.startedAt = Number(options.startedAt) || Date.now();
    const totalMs = Tracker.options.intervalMs * Tracker.options.totalStages;
    const elapsed = Date.now() - Tracker.startedAt;
    // Resume at the right stage immediately when reopening a saved order.
    Tracker.activeIndex = Math.min(
      Tracker.options.totalStages - 1,
      Math.max(0, Math.floor(elapsed / Tracker.options.intervalMs))
    );
    Tracker.render();
    if (elapsed >= totalMs) {
      Tracker.activeIndex = Tracker.options.totalStages - 1;
      Tracker.render();
      Tracker.finish();
      return;
    }
    Tracker.timer = setInterval(() => {
      const elapsedNow = Date.now() - Tracker.startedAt;
      if (elapsedNow >= totalMs) {
        clearInterval(Tracker.timer);
        Tracker.timer = null;
        Tracker.activeIndex = Tracker.options.totalStages - 1;
        Tracker.render();
        Tracker.finish();
      } else {
        Tracker.activeIndex = Math.min(
          Tracker.options.totalStages - 1,
          Math.floor(elapsedNow / Tracker.options.intervalMs)
        );
        Tracker.render();
      }
    }, Math.min(1000, Tracker.options.intervalMs));
  },

  render: function () {
    if (!Tracker.options) return;
    for (let index = 0; index < Tracker.options.totalStages; index += 1) {
      const element = document.getElementById(`${Tracker.options.stagePrefix}${index + 1}`);
      if (!element) continue;
      element.classList.remove('active', 'completed', 'pending');
      element.classList.add(index < Tracker.activeIndex ? 'completed' :
        index === Tracker.activeIndex ? 'active' : 'pending');
      const badge = document.getElementById(`${Tracker.options.badgePrefix || ''}${index + 1}`);
      if (badge) {
        badge.textContent = index < Tracker.activeIndex ? 'Complete' :
          index === Tracker.activeIndex ? 'In Progress' : 'Pending';
        badge.classList.toggle('stage-status-badge--pending', index > Tracker.activeIndex);
      }
    }
    const progress = document.getElementById(Tracker.options.progressFillId);
    if (progress) progress.style.width = `${((Tracker.activeIndex + 1) / Tracker.options.totalStages) * 100}%`;
    const label = document.getElementById(Tracker.options.progressLabelId);
    if (label) label.textContent = `Step ${Tracker.activeIndex + 1} of ${Tracker.options.totalStages}`;
  },

  finish: function () {
    const lastStage = document.getElementById(
      `${Tracker.options?.stagePrefix}${Tracker.options?.totalStages}`
    );
    if (lastStage) {
      lastStage.classList.remove('active', 'pending');
      lastStage.classList.add('completed');
    }
    const lastBadge = document.getElementById(
      `${Tracker.options?.badgePrefix || ''}${Tracker.options?.totalStages}`
    );
    if (lastBadge) {
      lastBadge.textContent = 'Complete';
      lastBadge.classList.remove('stage-status-badge--pending');
    }
    const support = document.getElementById(Tracker.options?.supportId);
    if (support) support.classList.remove('hidden');
    const actions = document.getElementById(Tracker.options?.actionsId);
    if (actions) actions.classList.remove('hidden');
  },

  reset: function () {
    if (Tracker.timer) clearInterval(Tracker.timer);
    Tracker.timer = null;
    if (Tracker.options?.supportId) {
      document.getElementById(Tracker.options.supportId)?.classList.add('hidden');
    }
    if (Tracker.options?.actionsId) {
      document.getElementById(Tracker.options.actionsId)?.classList.add('hidden');
    }
    Tracker.options = null;
    Tracker.activeIndex = 0;
    Tracker.startedAt = null;
  },
};

function startTracker(options) {
  Tracker.startStages({
    ...options,
    supportId: options.supportId || options.supportBoxId,
  });
}
