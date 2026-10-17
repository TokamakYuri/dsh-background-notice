window.__ModuleLoader__.load({
  id: 'dsh-background-notice',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'backgroundNotice';

    /** Simplified Chinese copy is also the defensive fallback when `t` is absent. */
    const zh = {
      doneTitle: '任务已完成',
      doneBody: '本轮处理已经结束',
      actionTitle: '需要你的操作',
      approvalBody: '有工具调用正在等待你的审批',
      questionBody: '有提问正在等待你的回答',
      interactionBody: '有操作正在等待你处理',
      currentSession: '当前会话',
      dismiss: '关闭提醒',
      open: '打开会话',
    };

    const en = {
      doneTitle: 'Turn complete',
      doneBody: 'This turn has finished',
      actionTitle: 'Your input is needed',
      approvalBody: 'A tool call is waiting for your approval',
      questionBody: 'A question is waiting for your answer',
      interactionBody: 'Something is waiting for you',
      currentSession: 'Current session',
      dismiss: 'Dismiss notification',
      open: 'Open session',
    };

    function fallbackTranslate(key) {
      return typeof zh[key] === 'string' ? zh[key] : key;
    }

    /** Selector hooks read whole snapshots; identity keeps the subscription stable. */
    const selectAll = snapshot => snapshot;

    /* ------------------------------------------------------------------ *
     * Audio: a short Web Audio chime, no asset and no network request.
     * Browsers start an AudioContext suspended until a user gesture, so the
     * plugin unlocks it on the first pointer or key event and every later
     * chime reuses the same context.
     * ------------------------------------------------------------------ */

    let audioContext = null;

    function getAudioContext() {
      if (typeof window === 'undefined') return null;
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (typeof Ctor !== 'function') return null;
      if (audioContext === null) {
        try {
          audioContext = new Ctor();
        } catch (error) {
          console.error('task-alert: AudioContext unavailable', error);
          return null;
        }
      }
      return audioContext;
    }

    function unlockAudio() {
      const context = getAudioContext();
      if (context === null || context.state === 'closed') return;
      if (context.state === 'running') return;
      try {
        void context.resume();
      } catch (error) {
        console.error('task-alert: audio unlock failed', error);
      }
    }

    function playChime(kind) {
      const context = getAudioContext();
      if (context === null || context.state === 'closed') return;
      if (context.state !== 'running') {
        unlockAudio();
        if (context.state !== 'running') return;
      }
      const notes = kind === 'action' ? [880, 1174.66, 1567.98] : [783.99, 1046.5];
      const gap = kind === 'action' ? 0.11 : 0.16;
      let start = 0;
      try {
        start = context.currentTime + 0.03;
      } catch {
        return;
      }
      for (let index = 0; index < notes.length; index += 1) {
        const at = start + index * gap;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(notes[index], at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.13, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.36);
      }
    }

    /* ------------------------------------------------------------------ *
     * Style: theme tokens only, so the popup follows light and dark mode.
     * ------------------------------------------------------------------ */

    const css = `
.ds-ta-stack{position:fixed;right:24px;bottom:24px;z-index:60;display:flex;flex-direction:column;gap:10px;width:min(380px,calc(100vw - 32px));pointer-events:none}
.ds-ta-card{pointer-events:auto;display:flex;align-items:flex-start;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 30px rgba(15,23,42,.16),0 2px 8px rgba(15,23,42,.08);color:var(--dsw-alias-label-primary);overflow:hidden;animation:ds-ta-in 180ms cubic-bezier(.22,1,.36,1)}
.ds-ta-card[data-kind="action"]{border-color:var(--dsw-alias-state-warn-primary)}
.ds-ta-card[data-kind="done"]{border-color:var(--dsw-alias-border-l2)}
.ds-ta-main{flex:1;min-width:0;display:flex;align-items:flex-start;gap:12px;padding:13px 4px 13px 14px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.ds-ta-main:hover{background:var(--dsw-alias-bg-layer-2)}
.ds-ta-main:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ds-ta-icon{flex:none;width:28px;height:28px;display:grid;place-items:center;border-radius:999px}
.ds-ta-card[data-kind="done"] .ds-ta-icon{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent)}
.ds-ta-card[data-kind="action"] .ds-ta-icon{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent)}
.ds-ta-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.ds-ta-title{font-size:14px;font-weight:600;line-height:20px}
.ds-ta-body{font-size:13px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.ds-ta-session{font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);opacity:.8;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ds-ta-close{flex:none;width:28px;height:28px;margin:10px 10px 0 0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:18px;line-height:1;cursor:pointer}
.ds-ta-close:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ds-ta-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
@keyframes ds-ta-in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ds-ta-card{animation:none}}
@media (max-width:640px){.ds-ta-stack{right:12px;left:12px;bottom:12px;width:auto}}
`;

    const DONE_AUTO_DISMISS_MS = 15000;
    const MAX_VISIBLE_NOTICES = 3;

    function DoneIcon() {
      return h('svg', {
        viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', 'aria-hidden': true,
      }, h('path', {
        d: 'M20 6 9 17l-5-5',
        stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round',
      }));
    }

    function ActionIcon() {
      return h('svg', {
        viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', 'aria-hidden': true,
      },
      h('path', {
        d: 'M12 3.2a5.2 5.2 0 0 0-5.2 5.2v3.6c0 1.2-.4 2.2-1.2 3.1l-.5.6c-.6.8-.1 1.9.9 1.9h12c1 0 1.5-1.1.9-1.9l-.5-.6c-.8-.9-1.2-1.9-1.2-3.1V8.4A5.2 5.2 0 0 0 12 3.2Z',
        stroke: 'currentColor', strokeWidth: 1.9, strokeLinejoin: 'round',
      }),
      h('path', {
        d: 'M9.4 18.7a2.6 2.6 0 0 0 5.2 0',
        stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round',
      }));
    }

    /**
     * Install the overlay entry.
     * @param ctx - Client plugin context owning the dictionaries, gesture
     * listener, and the `shell.overlay` registration.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-background-notice: dictionaries');

      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-background-notice';
        tag.dataset.pluginCss = 'dsh-background-notice/BackgroundNotice.css';
        tag.textContent = css;
        document.head.appendChild(tag);
        return () => { tag.remove(); };
      }, 'dsh-background-notice: styles');

      ctx.effect(() => {
        const onGesture = () => { unlockAudio(); };
        window.addEventListener('pointerdown', onGesture, true);
        window.addEventListener('keydown', onGesture, true);
        return () => {
          window.removeEventListener('pointerdown', onGesture, true);
          window.removeEventListener('keydown', onGesture, true);
        };
      }, 'dsh-background-notice: audio unlock');

      ctx.slots.inject('shell.overlay', () => {
        /**
         * Frame-wide notice stack. It watches the Session UI status snapshot
         * published by `ui-session`: a running→idle edge means the turn
         * finished, and a newly published pending interaction means the Host
         * is waiting for the user.
         */
        function TaskAlert(props) {
          const t = typeof props.t === 'function' ? props.t : fallbackTranslate;
          const status = props.useSessionStatus(selectAll);
          const sessions = props.useSessions(selectAll);
          const [notices, setNotices] = React.useState([]);
          const previous = React.useRef(null);
          const sessionsRef = React.useRef(sessions);
          const sequence = React.useRef(0);
          const timers = React.useRef(new Map());

          sessionsRef.current = sessions;

          const remove = React.useCallback(id => {
            setNotices(current => current.some(notice => notice.id === id)
              ? current.filter(notice => notice.id !== id)
              : current);
          }, []);

          const openNotice = React.useCallback(notice => {
            remove(notice.id);
            const workspace = ctx.get('uiWorkspace');
            if (workspace === undefined || typeof workspace.openSession !== 'function') return;
            try {
              workspace.openSession(notice.sessionId);
            } catch (error) {
              console.error('task-alert: opening the session failed', error);
            }
          }, [remove]);

          /* Compare consecutive status snapshots. The first snapshot is a
             baseline: existing state must not replay as a notification. */
          React.useEffect(() => {
            const before = previous.current;
            previous.current = status;
            if (before === null) return;

            const listState = sessionsRef.current;
            const rows = listState !== undefined && listState.byId !== undefined ? listState.byId : {};
            const additions = [];
            const resolved = new Set();

            for (const [sessionId, now] of status) {
              const row = rows[sessionId];
              if (row !== undefined && row.origin === 'subagent') continue;
              const then = before.get(sessionId);

              if (then !== undefined && then.running === true && now.running === false) {
                additions.push({ kind: 'done', sessionId });
              }

              const previousInteraction = then === undefined ? undefined : then.pendingInteraction;
              const nextInteraction = now.pendingInteraction;
              if (previousInteraction !== undefined && nextInteraction === undefined) {
                resolved.add(sessionId);
              }
              if (nextInteraction !== undefined
                && nextInteraction.key !== (previousInteraction === undefined ? undefined : previousInteraction.key)
                && nextInteraction.kind !== 'plan-review') {
                additions.push({ kind: 'action', sessionId, interaction: nextInteraction.kind });
              }
            }

            if (additions.length === 0 && resolved.size === 0) return;
            if (additions.length > 0) {
              playChime(additions.some(item => item.kind === 'action') ? 'action' : 'done');
            }

            setNotices(current => {
              let next = current;
              if (resolved.size > 0) {
                const filtered = next.filter(notice => !(notice.kind === 'action' && resolved.has(notice.sessionId)));
                if (filtered.length !== next.length) next = filtered;
              }
              if (additions.length === 0) return next;
              const copy = next.slice();
              for (const addition of additions) {
                const duplicate = copy.findIndex(notice => notice.sessionId === addition.sessionId && notice.kind === addition.kind);
                if (duplicate >= 0) copy.splice(duplicate, 1);
              }
              for (const addition of additions) {
                sequence.current += 1;
                copy.push({ ...addition, id: sequence.current });
              }
              return copy.slice(-MAX_VISIBLE_NOTICES);
            });
          }, [status]);

          /* Completion notices are informational and retire themselves;
             action notices stay until the user acts or dismisses them. */
          React.useEffect(() => {
            const live = new Set(notices.map(notice => notice.id));
            for (const [id, timer] of timers.current) {
              if (live.has(id)) continue;
              window.clearTimeout(timer);
              timers.current.delete(id);
            }
            for (const notice of notices) {
              if (notice.kind !== 'done' || timers.current.has(notice.id)) continue;
              const timer = window.setTimeout(() => {
                timers.current.delete(notice.id);
                setNotices(current => current.filter(candidate => candidate.id !== notice.id));
              }, DONE_AUTO_DISMISS_MS);
              timers.current.set(notice.id, timer);
            }
          }, [notices]);

          React.useEffect(() => () => {
            for (const timer of timers.current.values()) window.clearTimeout(timer);
            timers.current.clear();
          }, []);

          if (notices.length === 0) return null;

          return h('div', {
            className: 'ds-ta-stack',
            role: 'status',
            'aria-live': 'polite',
            'aria-atomic': 'false',
          }, notices.map(notice => {
            const row = sessions !== undefined && sessions.byId !== undefined ? sessions.byId[notice.sessionId] : undefined;
            const label = row !== undefined && typeof row.displayTitle === 'string' && row.displayTitle !== ''
              ? row.displayTitle
              : t('currentSession');
            const isAction = notice.kind === 'action';
            const body = !isAction
              ? t('doneBody')
              : notice.interaction === 'approval'
                ? t('approvalBody')
                : notice.interaction === 'question'
                  ? t('questionBody')
                  : t('interactionBody');

            return h('div', {
              key: notice.id,
              className: 'ds-ta-card',
              'data-kind': notice.kind,
              role: isAction ? 'alert' : 'status',
            },
            h('button', {
              type: 'button',
              className: 'ds-ta-main',
              title: `${t('open')} · ${label}`,
              onClick: () => { openNotice(notice); },
            },
            h('span', { className: 'ds-ta-icon' }, isAction ? h(ActionIcon) : h(DoneIcon)),
            h('span', { className: 'ds-ta-text' },
              h('span', { className: 'ds-ta-title' }, isAction ? t('actionTitle') : t('doneTitle')),
              h('span', { className: 'ds-ta-body' }, body),
              h('span', { className: 'ds-ta-session' }, label))),
            h('button', {
              type: 'button',
              className: 'ds-ta-close',
              'aria-label': t('dismiss'),
              title: t('dismiss'),
              onClick: () => { remove(notice.id); },
            }, '\u00d7'));
          }));
        }

        return ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-background-notice',
          order: 100,
          locale: NS,
        }, TaskAlert);
      });
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    };
  },
});
