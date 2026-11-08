// Five-step delivery simulation: one new stage every three seconds.
const Tracker = {
  timer: null,
  activeIndex: 0,
  options: null,

  startStages: function (options) {
    Tracker.reset();
    Tracker.options = { intervalMs: 3000, ...options };
    Tracker.activeIndex = 0;
    Tracker.render();
    Tracker.timer = setInterval(() => {
      if (Tracker.activeIndex < Tracker.options.totalStages - 1) {
        Tracker.activeIndex += 1;
        Tracker.render();
      } else {
        clearInterval(Tracker.timer);
        Tracker.timer = null;
        Tracker.finish();
      }
    }, Tracker.options.intervalMs);
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
  },
};

function startTracker(options) {
  Tracker.startStages({
    ...options,
    supportId: options.supportId || options.supportBoxId,
  });
}
