/**
 * service-worker.js
 * -----------------
 * 백그라운드에서 실행되는 서비스 워커.
 * - 툴바 아이콘 클릭 시 사이드 패널을 열거나 닫는다.
 * - content-script 및 sidepanel 간의 메시지를 중계한다.
 * - OpenAI API를 직접 호출한다 (API 키가 외부에 노출되지 않도록 여기서 처리).
 */

// 공통 상수/유틸 로드 (MV3 service worker에서는 importScripts 사용 가능)
importScripts(
  "shared/namespace.js",
  "shared/constants.js",
  "shared/chrome-helpers.js",
  "shared/text-utils.js"
);

// ──────────────────────────────────────────────
// 1. 툴바 아이콘 클릭 → 사이드 패널 열기
// ──────────────────────────────────────────────
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ──────────────────────────────────────────────
// 2. 메시지 수신 및 라우팅
//    content-script, sidepanel 양쪽에서 오는 메시지를 받아 처리한다.
// ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    // sidepanel 또는 content-script → 번역 요청
    case PT.MESSAGE_TYPES.TRANSLATE_REQUEST:
      handleTranslation(message.payload)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(err  => sendResponse({ success: false, error: err.message }));
      return true; // 비동기 응답을 위해 반드시 true 반환

    // content-script → 드래그 선택 텍스트를 사이드 패널로 전달
    case PT.MESSAGE_TYPES.SELECTION_TO_SIDEPANEL:
      forwardToSidePanel(message);
      break;

    // 설정 저장 요청
    case PT.MESSAGE_TYPES.SAVE_SETTINGS:
      saveSettings(message.payload, sendResponse);
      return true;

    // 설정 불러오기 요청
    case PT.MESSAGE_TYPES.LOAD_SETTINGS:
      loadSettings(sendResponse);
      return true;

    // (준비) content-script에서 외부 링크 열기 요청
    // 지금은 FEATURE_FLAGS로 UI에서 노출되지 않으므로 실제 동작에는 영향이 없다.
    case PT.MESSAGE_TYPES.OPEN_EXTERNAL_LINK:
      openExternalLink(message.payload, sendResponse);
      return true;

    default:
      break;
  }
});

// ──────────────────────────────────────────────
// 3. 번역 오케스트레이터
//    번역 메시지를 구성하고 API를 호출한 뒤 결과를 반환한다.
//    나중에 "문법 설명" "유사 표현" 같은 기능을 추가할 때는
//    이 함수와 같은 패턴으로 새 함수를 만들면 된다.
// ──────────────────────────────────────────────
async function handleTranslation({ text, targetLanguage }) {
  const { [PT.STORAGE_KEYS.OPENAI_API_KEY]: openaiApiKey } =
    await chrome.storage.local.get(PT.STORAGE_KEYS.OPENAI_API_KEY);

  if (!openaiApiKey) {
    throw new Error("API 키가 설정되지 않았습니다. 사이드 패널에서 API 키를 입력해 주세요.");
  }

  const messages = buildTranslationMessages(text, targetLanguage);
  const result = await callOpenAI(messages, PT.OPENAI.MODELS.TRANSLATION, {
    temperature: PT.OPENAI.DEFAULT_TEMPERATURE,
  });
  return result;
}

// ──────────────────────────────────────────────
// 4. 번역 프롬프트 구성
//    "어떻게 번역할지"에 대한 지침을 담는다.
//    프롬프트만 수정해서 번역 스타일을 손쉽게 바꿀 수 있도록 분리해 뒀다.
//
//    개선 포인트 (기존 대비):
//    - 단어 대 단어 직역이 아닌 의미 중심의 자연스러운 번역을 명시
//    - 원문의 어조(격식체·구어체·기술적 표현)를 대상 언어에서도 유지하도록 지시
//    - 웹페이지·일상 문장처럼 맥락이 짧은 경우에도 가장 자연스러운 표현을 선택하도록 유도
//    - 번역문만 반환하도록 명확히 제한 (기존 동작 유지)
// ──────────────────────────────────────────────
function buildTranslationMessages(text, targetLanguage) {
  const systemPrompt = `You are an expert translator. Your goal is to produce translations that feel as if they were originally written in ${targetLanguage} — natural, idiomatic, and fluent.

Follow these guidelines:
- Prioritize meaning and naturalness over word-for-word accuracy.
- Preserve the tone and register of the source text (formal, casual, technical, conversational, humorous).
- Use expressions that native speakers of ${targetLanguage} actually use in everyday communication.
- For short phrases, UI text, or web content, choose the most contextually appropriate phrasing.
- Do NOT add explanations, notes, parenthetical remarks, or alternative translations.
- Return ONLY the translated text — nothing else.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user",   content: text }
  ];
}

// ──────────────────────────────────────────────
// 5. OpenAI API 공통 호출 함수
//    모든 API 호출이 이 함수를 거친다.
//    나중에 문법 설명이나 유사 표현 기능을 추가할 때
//    buildXxxMessages() 함수만 새로 만들고 이 함수를 재사용하면 된다.
//
//    사용 예시 (미래 기능):
//      const msgs = buildGrammarMessages(text, translation, targetLanguage);
//      const explanation = await callOpenAI(msgs, MODELS.ANALYSIS, { temperature: 0.5 });
// ──────────────────────────────────────────────
async function callOpenAI(messages, model, options = {}) {
  const { [PT.STORAGE_KEYS.OPENAI_API_KEY]: openaiApiKey } =
    await chrome.storage.local.get(PT.STORAGE_KEYS.OPENAI_API_KEY);

  const response = await fetch(PT.OPENAI.CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? PT.OPENAI.DEFAULT_TEMPERATURE,
      max_tokens:  options.max_tokens  ?? PT.OPENAI.DEFAULT_MAX_TOKENS,
    })
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `API 오류: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ──────────────────────────────────────────────
// 6. 사이드 패널로 메시지 전달
//    (현재 탭의 content-script → sidepanel)
// ──────────────────────────────────────────────
async function forwardToSidePanel(message) {
  chrome.runtime.sendMessage({ ...message, type: PT.MESSAGE_TYPES.FILL_SIDEPANEL }).catch(() => {
    // 사이드 패널이 닫혀 있으면 에러가 발생할 수 있어 무시
  });
}

// ──────────────────────────────────────────────
// 7. 설정 저장 / 불러오기 (chrome.storage.local)
// ──────────────────────────────────────────────
async function saveSettings(payload, sendResponse) {
  if (!payload || typeof payload !== "object") {
    sendResponse({ success: false, error: "저장할 데이터가 없습니다." });
    return;
  }
  await chrome.storage.local.set(payload);
  sendResponse({ success: true });
}

async function loadSettings(sendResponse) {
  const data = await chrome.storage.local.get([
    PT.STORAGE_KEYS.OPENAI_API_KEY,
    PT.STORAGE_KEYS.DEFAULT_TARGET_LANGUAGE
  ]);
  sendResponse({ success: true, data });
}

async function openExternalLink(payload, sendResponse) {
  try {
    const url = payload?.url;
    if (!url || typeof url !== "string") {
      sendResponse({ success: false, error: "URL이 올바르지 않습니다." });
      return;
    }
    await chrome.tabs.create({ url });
    sendResponse({ success: true });
  } catch (e) {
    sendResponse({ success: false, error: e?.message || "탭 열기 실패" });
  }
}

// ──────────────────────────────────────────────
// [미래 확장 예시 — 아직 사용하지 않음]
//
// 문법 설명 기능을 추가할 때 이 함수를 완성해서 사용한다.
//
// async function handleGrammarExplanation({ text, translation, targetLanguage }) {
//   const messages = buildGrammarMessages(text, translation, targetLanguage);
//   return await callOpenAI(messages, MODELS.ANALYSIS, { temperature: 0.5 });
// }
//
// function buildGrammarMessages(original, translation, targetLanguage) {
//   return [
//     {
//       role: "system",
//       content: `You are a language teacher. Explain in ${targetLanguage} why the given text was translated the way it was. Focus on key grammar points, idiomatic choices, and vocabulary differences. Be concise (3–5 sentences max).`
//     },
//     {
//       role: "user",
//       content: `Original: ${original}\nTranslation: ${translation}`
//     }
//   ];
// }
// ──────────────────────────────────────────────
