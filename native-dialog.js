/**
 * Spawn bridge for the native Windows choice window (`alert-window.ps1`).
 * The window is a short-lived PowerShell/WPF child process; the answer comes
 * back as one JSON line on stdout. Any failure resolves `undefined`, which
 * callers treat as "no native window" and fall back to the normal DSH flow.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RESULT_MARKER = '###RESULT###';
const SCRIPT_PATH = fileURLToPath(new URL('./alert-window.ps1', import.meta.url));

function powershellPath() {
  const root = process.env.SystemRoot;
  if (typeof root === 'string' && root !== '') {
    const candidate = join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    if (existsSync(candidate)) return candidate;
  }
  return 'powershell.exe';
}

const activeDialogs = new Set();
let exitHookInstalled = false;

function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.on('exit', () => {
    for (const dialog of activeDialogs) dialog.close();
    activeDialogs.clear();
  });
}

/** Whether a native choice window can be offered in this process. */
export function nativeDialogAvailable() {
  return process.platform === 'win32';
}

/**
 * Open the native choice window.
 * @param {object} payload - Dialog content: `kind` plus questions or approval fields.
 * @param {AbortSignal | undefined} signal - Request lifetime; aborting closes the window.
 * @returns {{ result: Promise<object | undefined>, close: () => void } | undefined}
 *   `undefined` when no window can be offered; `result` resolves `undefined` on
 *   cancel, close, abort, or any failure.
 */
export function openDialog(payload, signal) {
  if (!nativeDialogAvailable()) return undefined;
  if (signal !== undefined && signal.aborted) return undefined;
  installExitHook();

  let child;
  try {
    child = spawn(powershellPath(), [
      '-NoProfile',
      '-NonInteractive',
      '-STA',
      '-ExecutionPolicy', 'Bypass',
      '-File', SCRIPT_PATH,
    ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  } catch (error) {
    console.error('dsh-background-notice: could not start the native dialog', error);
    return undefined;
  }

  let stdout = '';
  let stderr = '';
  let settled = false;
  let closed = false;
  let onAbort;

  const close = () => {
    if (closed) return;
    closed = true;
    try {
      child.kill();
    } catch (error) {
      // The process already exited; nothing to release.
    }
  };

  const result = new Promise((resolve) => {
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (onAbort !== undefined && signal !== undefined) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve(value);
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (stdout.length < 1_000_000) stdout += chunk;
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 8000) stderr += chunk;
    });
    child.stdin.on('error', () => {});

    child.on('error', (error) => {
      console.error('dsh-background-notice: native dialog failed to start', error);
      finish(undefined);
    });

    child.on('close', (code) => {
      const index = stdout.indexOf(RESULT_MARKER);
      if (index < 0) {
        if (code !== 0 && code !== null && stderr.trim() !== '') {
          console.error('dsh-background-notice: native dialog exited without a result:', stderr.trim().slice(0, 600));
        }
        finish(undefined);
        return;
      }
      try {
        const parsed = JSON.parse(stdout.slice(index + RESULT_MARKER.length).trim());
        if (parsed === null || typeof parsed !== 'object' || parsed.cancelled === true) finish(undefined);
        else finish(parsed);
      } catch (error) {
        console.error('dsh-background-notice: native dialog returned unreadable JSON', error);
        finish(undefined);
      }
    });

    onAbort = () => {
      close();
      finish(undefined);
    };
    if (signal !== undefined) signal.addEventListener('abort', onAbort, { once: true });

    try {
      child.stdin.end(JSON.stringify(payload), 'utf8');
    } catch (error) {
      close();
      finish(undefined);
    }
  });

  const dialog = { result, close };
  activeDialogs.add(dialog);
  void result.then(
    () => { activeDialogs.delete(dialog); },
    () => { activeDialogs.delete(dialog); },
  );
  return dialog;
}
