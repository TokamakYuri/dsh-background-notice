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
      failedTitle: '任务执行失败',
      failedBody: '本轮处理没有正常结束',
      failedSignedOut: '登录状态失效，任务已停止',
      failedInterrupted: 'DSH 进程中途退出，本轮未完成',
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
      failedTitle: 'Turn failed',
      failedBody: 'This turn did not finish successfully',
      failedSignedOut: 'Stopped because you signed out of DeepSeek',
      failedInterrupted: 'The DSH process exited before this turn finished',
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
          console.error('dsh-background-notice: AudioContext unavailable', error);
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
        console.error('dsh-background-notice: audio unlock failed', error);
      }
    }

    function playChime(kind) {
      const context = getAudioContext();
      if (context === null || context.state === 'closed') return;
      if (context.state !== 'running') {
        unlockAudio();
        if (context.state !== 'running') return;
      }
      const notes = kind === 'action'
        ? [880, 1174.66, 1567.98]
        : kind === 'failed'
          ? [659.25, 523.25, 392]
          : [783.99, 1046.5];
      const gap = kind === 'action' ? 0.11 : kind === 'failed' ? 0.13 : 0.16;
      let start = 0;
      try {
        start = context.currentTime + 0.03;
        for (let index = 0; index < notes.length; index += 1) {
          const at = start + index * gap;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = kind === 'failed' ? 'triangle' : 'sine';
          oscillator.frequency.setValueAtTime(notes[index], at);
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(0.13, at + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(at);
          oscillator.stop(at + 0.36);
        }
      } catch (error) {
        // A blocked or torn-down audio graph must never break the notice UI.
        console.error('dsh-background-notice: chime failed', error);
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
.ds-ta-card[data-kind="failed"]{border-color:var(--dsw-alias-state-error-primary)}
.ds-ta-main{flex:1;min-width:0;display:flex;align-items:flex-start;gap:12px;padding:13px 4px 13px 14px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.ds-ta-main:hover{background:var(--dsw-alias-bg-layer-2)}
.ds-ta-main:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ds-ta-icon{flex:none;width:28px;height:28px;display:grid;place-items:center;border-radius:999px}
.ds-ta-card[data-kind="done"] .ds-ta-icon{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent)}
.ds-ta-card[data-kind="action"] .ds-ta-icon{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent)}
.ds-ta-card[data-kind="failed"] .ds-ta-icon{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent)}
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
    const TERMINAL_GRACE_MS = 400;
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

    function FailedIcon() {
      return h('svg', {
        viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', 'aria-hidden': true,
      },
      h('circle', {
        cx: 12, cy: 12, r: 8.4, stroke: 'currentColor', strokeWidth: 1.9,
      }),
      h('path', {
        d: 'M9.2 9.2 14.8 14.8 M14.8 9.2 9.2 14.8',
        stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round',
      }));
    }

    function isTerminalNotice(kind) {
      return kind === 'done' || kind === 'failed';
    }

    function truncateFailure(message) {
      const text = typeof message === 'string' ? message.trim() : '';
      if (text.length <= 220) return text;
      return `${text.slice(0, 217)}...`;
    }

    function failureText(notice, t) {
      if (notice.code === 'ACCOUNT_SIGNED_OUT') return t('failedSignedOut');
      if (notice.code === 'INTERRUPTED') return t('failedInterrupted');
      const message = truncateFailure(notice.message);
      return message === '' ? t('failedBody') : message;
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
          const terminalTimers = React.useRef(new Set());

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
              console.error('dsh-background-notice: opening the session failed', error);
            }
          }, [remove]);

          const addNotices = React.useCallback((additions, sound) => {
            if (additions.length === 0) return;
            playChime(sound);
            setNotices(current => {
              const copy = current.slice();
              for (const addition of additions) {
                const duplicate = copy.findIndex(notice => notice.sessionId === addition.sessionId
                  && (notice.kind === addition.kind
                    || (isTerminalNotice(addition.kind) && isTerminalNotice(notice.kind))));
                if (duplicate >= 0) copy.splice(duplicate, 1);
              }
              for (const addition of additions) {
                sequence.current += 1;
                copy.push({ ...addition, id: sequence.current });
              }
              while (copy.length > MAX_VISIBLE_NOTICES) {
                const doneIndex = copy.findIndex(notice => notice.kind === 'done');
                if (doneIndex >= 0) { copy.splice(doneIndex, 1); continue; }
                const failedIndex = copy.findIndex(notice => notice.kind === 'failed');
                if (failedIndex >= 0) { copy.splice(failedIndex, 1); continue; }
                copy.splice(0, 1);
              }
              return copy;
            });
          }, []);

          /* Compare consecutive status snapshots. The first snapshot is a
             baseline: existing state must not replay as a notification. */
          React.useEffect(() => {
            const before = previous.current;
            previous.current = status;
            if (before === null) return;

            const listState = sessionsRef.current;
            const rows = listState !== undefined && listState.byId !== undefined ? listState.byId : {};
            const actionAdditions = [];
            const terminalSessions = new Set();
            const resolved = new Set();

            for (const [sessionId, now] of status) {
              const row = rows[sessionId];
              if (row !== undefined && row.origin === 'subagent') continue;
              const then = before.get(sessionId);

              if (then !== undefined && then.running === true && now.running === false) {
                terminalSessions.add(sessionId);
              }

              const previousInteraction = then === undefined ? undefined : then.pendingInteraction;
              const nextInteraction = now.pendingInteraction;
              if (previousInteraction !== undefined && nextInteraction === undefined) {
                resolved.add(sessionId);
              }
              if (nextInteraction !== undefined
                && nextInteraction.key !== (previousInteraction === undefined ? undefined : previousInteraction.key)
                && nextInteraction.kind !== 'plan-review') {
                actionAdditions.push({ kind: 'action', sessionId, interaction: nextInteraction.kind });
              }
            }

            if (actionAdditions.length > 0) addNotices(actionAdditions, 'action');
            if (resolved.size > 0) {
              setNotices(current => {
                const filtered = current.filter(notice => !(notice.kind === 'action' && resolved.has(notice.sessionId)));
                return filtered.length === current.length ? current : filtered;
              });
            }

            /* The terminal projection frame can trail the status frame; wait a
               short grace period before classifying so a failure is never
               reported as a success. */
            if (terminalSessions.size > 0) {
              const timer = window.setTimeout(() => {
                terminalTimers.current.delete(timer);
                const additions = [];
                for (const sessionId of terminalSessions) {
                  const latest = sessionsRef.current !== undefined && sessionsRef.current.byId !== undefined
                    ? sessionsRef.current.byId[sessionId]
                    : undefined;
                  const projection = latest !== undefined && latest.projectionValues !== undefined
                    ? latest.projectionValues.backgroundNotice
                    : undefined;
                  const failure = projection !== undefined && projection !== null ? projection.failure : undefined;
                  if (failure !== undefined && failure !== null) {
                    additions.push({
                      kind: 'failed',
                      sessionId,
                      message: typeof failure.message === 'string' ? failure.message : '',
                      code: typeof failure.code === 'string' ? failure.code : undefined,
                    });
                  } else {
                    additions.push({ kind: 'done', sessionId });
                  }
                }
                addNotices(additions, additions.some(notice => notice.kind === 'failed') ? 'failed' : 'done');
              }, TERMINAL_GRACE_MS);
              terminalTimers.current.add(timer);
            }
          }, [status, addNotices]);

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
            for (const timer of terminalTimers.current) window.clearTimeout(timer);
            terminalTimers.current.clear();
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
            const isFailed = notice.kind === 'failed';
            const body = isFailed
              ? failureText(notice, t)
              : !isAction
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
              role: isAction || isFailed ? 'alert' : 'status',
            },
            h('button', {
              type: 'button',
              className: 'ds-ta-main',
              title: `${t('open')} · ${label}`,
              onClick: () => { openNotice(notice); },
            },
            h('span', { className: 'ds-ta-icon' }, isFailed ? h(FailedIcon) : isAction ? h(ActionIcon) : h(DoneIcon)),
            h('span', { className: 'ds-ta-text' },
              h('span', { className: 'ds-ta-title' }, isFailed ? t('failedTitle') : isAction ? t('actionTitle') : t('doneTitle')),
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
