/**
 * shared/constants.js
 * -------------------
 * 하드코딩 값을 한 곳에서 관리한다.
 *
 * 목표:
 * - 메시지 타입 / storage key / 모델명 / UI id 같은 값이 파일마다 흩어지지 않게
 * - 나중에 기능(설명 모드, 사전 링크, hover 뜻보기 등)을 추가해도 수정 지점이 적게
 */
(function () {
  "use strict";

  const PT = globalThis.PT;

  PT.MESSAGE_TYPES = Object.freeze({
    TRANSLATE_REQUEST: "TRANSLATE_REQUEST",
    SELECTION_TO_SIDEPANEL: "SELECTION_TO_SIDEPANEL",
    FILL_SIDEPANEL: "FILL_SIDEPANEL",
    SAVE_SETTINGS: "SAVE_SETTINGS",
    LOAD_SETTINGS: "LOAD_SETTINGS",
    TRANSLATE_DONE_FROM_PANEL: "TRANSLATE_DONE_FROM_PANEL",
    OPEN_EXTERNAL_LINK: "OPEN_EXTERNAL_LINK",
  });

  PT.STORAGE_KEYS = Object.freeze({
    OPENAI_API_KEY: "openaiApiKey",
    DEFAULT_TARGET_LANGUAGE: "defaultTargetLanguage",
  });

  PT.OPENAI = Object.freeze({
    CHAT_COMPLETIONS_URL: "https://api.openai.com/v1/chat/completions",
    DEFAULT_TEMPERATURE: 0.2,
    DEFAULT_MAX_TOKENS: 1024,
    MODELS: Object.freeze({
      TRANSLATION: "gpt-4o",
      ANALYSIS: "gpt-4o",
    }),
  });

  PT.DEFAULTS = Object.freeze({
    TARGET_LANGUAGE: "Korean",
  });

  PT.UI = Object.freeze({
    FLOATING_ACTION_MENU_ID: "ai-translator-float-menu",
    INLINE_CARD_ID: "ai-translator-inline-card",
  });

  // "준비" 용도: 지금은 UI에 추가하지 않지만, 나중에 쉽게 켤 수 있게 플래그로 둔다.
  PT.FEATURE_FLAGS = Object.freeze({
    ENABLE_KOREAN_LINK_ACTIONS: false,
  });
})();

