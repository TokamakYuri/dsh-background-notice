/**
 * Host-side session projection exposing the terminal outcome of the latest
 * turn. The browser half reads it from the session-list row so a failed turn
 * is reported differently from a completed one.
 *
 * The projection registry only calls schema `parse()` on state and wire views,
 * so these are small hand-written validators instead of a schema dependency.
 */

export const TURN_OUTCOME_KEY = 'backgroundNotice';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Map one `turn/end` reason onto the failure the chat UI would show.
 * Completed, blocked, max-token, stop-requested, and forked endings are not
 * failures.
 */
export function failureOfTurnEnd(reason, turn) {
  if (!isRecord(reason)) return null;
  if (reason.kind === 'error') {
    const error = reason.error;
    const message = typeof error === 'string'
      ? error
      : isRecord(error) && typeof error.message === 'string' ? error.message : 'The turn failed';
    const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
    return { message, ...(code === undefined ? {} : { code }), turn };
  }
  if (reason.kind === 'interrupted') {
    return { message: 'The DSH process exited before this turn finished.', code: 'INTERRUPTED', turn };
  }
  if (reason.kind === 'aborted'
    && isRecord(reason.reason)
    && reason.reason.kind === 'hook'
    && reason.reason.reason === 'deepseek-account/signed-out') {
    return { message: 'Stopped because you signed out of DeepSeek.', code: 'ACCOUNT_SIGNED_OUT', turn };
  }
  return null;
}

function sameFailure(left, right) {
  if (left === right) return true;
  if (left === null || right === null || left === undefined || right === undefined) return false;
  return left.message === right.message && left.code === right.code && left.turn === right.turn;
}

/** Fold one committed event into `{ failure }`. */
export function applyTurnOutcome(state, event) {
  if (!isRecord(event) || typeof event.type !== 'string') return state;
  if (event.type === 'turn/start') {
    return state.failure === null ? state : { failure: null };
  }
  if (event.type !== 'turn/end') return state;
  const data = isRecord(event.data) ? event.data : {};
  const turn = typeof data.turn === 'number' ? data.turn : 0;
  const failure = failureOfTurnEnd(data.reason, turn);
  return sameFailure(state.failure, failure) ? state : { failure };
}

function invalid(message) {
  throw new Error(`backgroundNotice projection: ${message}`);
}

/** Validate the projection state and its wire view (they are the same shape). */
export const turnOutcomeSchema = {
  parse(value) {
    if (!isRecord(value)) invalid('state must be an object');
    const failure = value.failure;
    if (failure !== null) {
      if (!isRecord(failure)) invalid('failure must be null or an object');
      if (typeof failure.message !== 'string') invalid('failure.message must be a string');
      if (typeof failure.turn !== 'number' || !Number.isFinite(failure.turn)) invalid('failure.turn must be a number');
      if (failure.code !== undefined && typeof failure.code !== 'string') invalid('failure.code must be a string');
    }
    return value;
  },
};

/** Build the projection definition registered on the Host. */
export function createTurnOutcomeProjection() {
  return {
    key: TURN_OUTCOME_KEY,
    stateSchema: turnOutcomeSchema,
    stateVersion: 1,
    init: () => ({ failure: null }),
    apply: applyTurnOutcome,
    wire: {
      viewSchema: turnOutcomeSchema,
      view: state => state,
    },
  };
}
