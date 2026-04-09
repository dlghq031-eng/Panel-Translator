/**
 * sidepanel.js
 * ------------
 * 사이드 패널의 모든 UI 로직을 담당하는 스크립트.
 * - 번역 요청을 service-worker로 보내고 결과를 화면에 표시
 * - 설정(API 키, 기본 언어) 저장 및 불러오기
 * - content-script에서 오는 선택 텍스트 수신
 */

(function () {
  "use strict";

  const MT = PT.MESSAGE_TYPES;

  // ──────────────────────────────────────────────
  // DOM 요소 참조
  // ──────────────────────────────────────────────
  const inputSource       = document.getElementById("input-source");
  const selectLang        = document.getElementById("select-lang");
  const btnTranslate      = document.getElementById("btn-translate");
  const resultSection     = document.getElementById("result-section");
  const resultOutput      = document.getElementById("result-output");
  const loading           = document.getElementById("loading");
  const errorMsg          = document.getElementById("error-msg");
  const btnCopy           = document.getElementById("btn-copy");

  // 설정 관련
  const btnSettingsToggle = document.getElementById("btn-settings-toggle");
  const settingsSection   = document.getElementById("settings-section");
  const inputApiKey       = document.getElementById("input-api-key");
  const btnToggleKey      = document.getElementById("btn-toggle-key");
  const selectDefaultLang = document.getElementById("select-default-lang");
  const btnSaveSettings   = document.getElementById("btn-save-settings");
  const settingsMsg       = document.getElementById("settings-msg");

  // ──────────────────────────────────────────────
  // 초기화: 저장된 설정 불러오기
  // ──────────────────────────────────────────────
  async function init() {
    const response = await sendToBackground({ type: MT.LOAD_SETTINGS });
    if (response?.success) {
      const {
        [PT.STORAGE_KEYS.OPENAI_API_KEY]: openaiApiKey,
        [PT.STORAGE_KEYS.DEFAULT_TARGET_LANGUAGE]: defaultTargetLanguage
      } = response.data;
      if (openaiApiKey)         inputApiKey.value = openaiApiKey;
      if (defaultTargetLanguage) {
        selectDefaultLang.value = defaultTargetLanguage;
        selectLang.value        = defaultTargetLanguage;
      }
    }
  }

  // ──────────────────────────────────────────────
  // 번역 버튼 클릭
  // ──────────────────────────────────────────────
  btnTranslate.addEventListener("click", async () => {
    const text           = inputSource.value.trim();
    const targetLanguage = selectLang.value;

    if (!text) {
      showError("번역할 텍스트를 입력해 주세요.");
      return;
    }

    setLoading(true);
    hideError();
    hideResult();

    const response = await sendToBackground({
      type: MT.TRANSLATE_REQUEST,
      payload: { text, targetLanguage }
    });

    setLoading(false);

    if (response?.success) {
      showResult(response.data);
    } else {
      showError(response?.error || "번역 중 오류가 발생했습니다.");
    }
  });

  // ──────────────────────────────────────────────
  // 복사 버튼 클릭
  // ──────────────────────────────────────────────
  btnCopy.addEventListener("click", () => {
    const text = resultOutput.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      btnCopy.textContent = "✅";
      setTimeout(() => (btnCopy.textContent = "📋"), 1500);
    });
  });

  // ──────────────────────────────────────────────
  // 설정 패널 토글
  // ──────────────────────────────────────────────
  btnSettingsToggle.addEventListener("click", () => {
    settingsSection.classList.toggle("hidden");
  });

  // API 키 보이기/숨기기 토글
  btnToggleKey.addEventListener("click", () => {
    inputApiKey.type = inputApiKey.type === "password" ? "text" : "password";
  });

  // 설정 저장
  btnSaveSettings.addEventListener("click", async () => {
    const apiKey      = inputApiKey.value.trim();
    const defaultLang = selectDefaultLang.value;

    const response = await sendToBackground({
      type: MT.SAVE_SETTINGS,
      payload: {
        [PT.STORAGE_KEYS.OPENAI_API_KEY]: apiKey,
        [PT.STORAGE_KEYS.DEFAULT_TARGET_LANGUAGE]: defaultLang
      }
    });

    if (response?.success) {
      selectLang.value = defaultLang;
      showSettingsMsg("설정이 저장되었습니다.", "success");
    } else {
      showSettingsMsg("저장 실패. 다시 시도해 주세요.", "error");
    }
  });

  // ──────────────────────────────────────────────
  // content-script에서 오는 선택 텍스트 수신
  // service-worker가 FILL_SIDEPANEL 타입으로 중계해 준다
  // ──────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MT.FILL_SIDEPANEL && message.payload) {
      const { text, targetLanguage } = message.payload;
      if (text) {
        inputSource.value = text;
        if (targetLanguage) selectLang.value = targetLanguage;
      }
    }
  });

  // ──────────────────────────────────────────────
  // 유틸리티 함수
  // ──────────────────────────────────────────────
  function sendToBackground(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    });
  }

  function setLoading(isLoading) {
    loading.classList.toggle("hidden", !isLoading);
    btnTranslate.disabled = isLoading;
  }

  function showResult(text) {
    resultOutput.textContent = text;
    resultSection.classList.remove("hidden");
  }

  function hideResult() {
    resultSection.classList.add("hidden");
    resultOutput.textContent = "";
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove("hidden");
  }

  function hideError() {
    errorMsg.classList.add("hidden");
  }

  function showSettingsMsg(msg, type) {
    settingsMsg.textContent = msg;
    settingsMsg.className = `msg-text ${type}`;
    settingsMsg.classList.remove("hidden");
    setTimeout(() => settingsMsg.classList.add("hidden"), 3000);
  }

  // 초기화 실행
  init();

})();
