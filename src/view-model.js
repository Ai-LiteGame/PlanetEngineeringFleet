import { STAGES } from './game-core.js';
import { STAGE_META } from './content.js';

const ACTION_CLASS = {
  chinese: 'is-digging',
  english: 'is-mixing',
  math: 'is-lifting',
  mixed: 'is-delivering',
};

export function getStageProgress(state) {
  return STAGES.map((stage, index) => ({
    stage,
    ...STAGE_META[stage],
    status: state.completed || index < state.stageIndex
      ? 'done'
      : index === state.stageIndex
        ? 'current'
        : 'upcoming',
  }));
}

export function getHintView(state, question) {
  if (!question || state.hintLevel < 1) return { message: '', answerId: null };
  if (state.hintLevel === 1) {
    return {
      message: '再听一遍，看看哪块施工牌在提醒你。',
      answerId: null,
    };
  }
  return {
    message: question.hint,
    answerId: question.answerId,
  };
}

export function getVehicleActionClass(stage) {
  return ACTION_CLASS[stage] || '';
}

export function getBridgeVariant(value) {
  return Math.max(0, Math.min(3, Number(value) || 0));
}

export function isSettingsActivationKey(key) {
  return key === 'Enter' || key === ' ' || key === 'Space';
}
