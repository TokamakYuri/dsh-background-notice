/**
 * Host half of dsh-background-notice: offers a native Windows choice window for blocking
 * user questions and approvals. The window runs before the web answerer, so a
 * question shows up as a real system window; closing it delegates to the
 * normal DSH flow. Turn-completion reminders stay in the browser plugin.
 */
import { nativeDialogAvailable, openDialog } from './native-dialog.js';

function shortSessionId(agent) {
  if (agent === undefined || typeof agent.id !== 'string') return '';
  const id = agent.id;
  return id.length > 8 ? id.slice(0, 8) : id;
}

function buildQuestionPayload(request) {
  return {
    kind: 'questions',
    sessionId: shortSessionId(request.agent),
    questions: request.questions.map(question => ({
      id: question.id,
      header: question.header ?? '',
      question: question.question,
      detail: question.detail ?? '',
      multiSelect: question.multiSelect === true,
      options: (question.options ?? []).map(option => ({
        label: option.label,
        description: option.description ?? '',
      })),
    })),
  };
}

function buildApprovalPayload(request) {
  return {
    kind: 'approval',
    sessionId: shortSessionId(request.agent),
    toolName: request.toolName,
    reason: request.reason ?? '',
    displayReason: request.displayReason,
  };
}

/**
 * Accept only an answer batch that names every question exactly once and uses
 * labels the question actually offered.
 */
function validateAnswers(answers, questions) {
  if (!Array.isArray(answers) || answers.length !== questions.length) return undefined;
  const byId = new Map(questions.map(question => [question.id, question]));
  const seen = new Set();
  const validated = [];

  for (const answer of answers) {
    if (answer === null || typeof answer !== 'object') return undefined;
    const question = byId.get(answer.id);
    if (question === undefined || seen.has(answer.id)) return undefined;
    seen.add(answer.id);

    const selected = Array.isArray(answer.selected) ? answer.selected : [];
    const options = question.options ?? [];
    const labels = new Set(options.map(option => option.label));
    if (!selected.every(label => typeof label === 'string' && labels.has(label))) return undefined;
    const custom = typeof answer.custom === 'string' ? answer.custom.trim() : '';

    if (options.length > 0) {
      // Typed text is its own answer; for a single-select question it replaces
      // the option selection, for a multi-select one it supplements it.
      if (custom !== '') {
        validated.push(question.multiSelect === true
          ? { id: question.id, selected, custom }
          : { id: question.id, selected: [], custom });
        continue;
      }
      if (selected.length === 0) return undefined;
      if (question.multiSelect !== true && selected.length > 1) return undefined;
      validated.push({ id: question.id, selected });
      continue;
    }

    if (custom === '') return undefined;
    validated.push({ id: question.id, selected: [], custom });
  }

  return validated;
}

async function offerQuestions(request, next, track) {
  if (request.signal !== undefined && request.signal.aborted) return next();
  const questions = Array.isArray(request.questions) ? request.questions : [];
  if (questions.length === 0) return next();
  if (new Set(questions.map(question => question.id)).size !== questions.length) return next();

  const dialog = track(openDialog(buildQuestionPayload(request), request.signal));
  if (dialog === undefined) return next();

  const result = await dialog.result;
  if (result === undefined) {
    if (request.signal !== undefined && request.signal.aborted) {
      throw new Error('the question was aborted before it could be answered');
    }
    return next();
  }

  const answers = validateAnswers(result.answers, questions);
  if (answers === undefined) return next();
  return { answers };
}

async function offerApproval(request, next, track) {
  if (request.signal !== undefined && request.signal.aborted) return next();

  const dialog = track(openDialog(buildApprovalPayload(request), request.signal));
  if (dialog === undefined) return next();

  const result = await dialog.result;
  if (result === undefined) {
    if (request.signal !== undefined && request.signal.aborted) return 'cancelled';
    return next();
  }
  if (result.outcome === 'allowed-once' || result.outcome === 'rejected') return result.outcome;
  return next();
}

/**
 * Install the native-dialog answerers.
 * @param {object} ctx - Host plugin context.
 */
export function apply(ctx) {
  if (!nativeDialogAvailable()) return;

  const dialogs = new Set();
  ctx.effect(() => () => {
    for (const dialog of dialogs) dialog.close();
    dialogs.clear();
  }, 'task-alert: native dialogs');

  const track = dialog => {
    if (dialog !== undefined) {
      dialogs.add(dialog);
      void dialog.result.then(
        () => { dialogs.delete(dialog); },
        () => { dialogs.delete(dialog); },
      );
    }
    return dialog;
  };

  ctx.on('user-questions/request', function (request, next) {
    return offerQuestions(request, next, track);
  }, { prepend: true, global: true });

  ctx.on('approval/request', function (request, next) {
    return offerApproval(request, next, track);
  }, { prepend: true, global: true });
}
