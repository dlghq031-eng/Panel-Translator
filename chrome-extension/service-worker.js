/**
 * service-worker.js
 * -----------------
 * 백그라운드에서 실행되는 서비스 워커.
 * - 툴바 아이콘 클릭 시 사이드 패널을 열거나 닫는다.
 * - content-script 및 sidepanel 간의 메시지를 중계한다.
 * - OpenAI API를 직접 호출한다 (API 키가 외부에 노출되지 않도록 여기서 처리).
 */

// ──────────────────────────────────────────────
// 1. 툴바 아이콘 클릭 → 사이드 패널 열기
// ──────────────────────────────────────────────
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ──────────────────────────────────────────────
// 2. 메시지 수신 및 라우팅
//    content-script, sidepanel 양쪽에서 오는
//    메시지를 받아 적절히 처리한다.
// ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    // sidepanel 또는 content-script → 번역 요청
    case "TRANSLATE_REQUEST":
      handleTranslation(message.payload)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(err  => sendResponse({ success: false, error: err.message }));
      return true; // 비동기 응답을 위해 반드시 true 반환

    // content-script → 드래그 선택 텍스트를 사이드 패널로 전달
    case "SELECTION_TO_SIDEPANEL":
      forwardToSidePanel(message);
      break;

    // 설정 저장 요청
    case "SAVE_SETTINGS":
      saveSettings(message.payload, sendResponse);
      return true;

    // 설정 불러오기 요청
    case "LOAD_SETTINGS":
      loadSettings(sendResponse);
      return true;

    default:
      break;
  }
});

// ──────────────────────────────────────────────
// 3. OpenAI API 호출 함수
// ──────────────────────────────────────────────
async function handleTranslation({ text, targetLanguage }) {
  // API 키는 chrome.storage.local에 저장된 값을 사용 (코드에 하드코딩하지 않음)
  const { openaiApiKey } = await chrome.storage.local.get("openaiApiKey");

  if (!openaiApiKey) {
    throw new Error("API 키가 설정되지 않았습니다. 사이드 패널에서 API 키를 입력해 주세요.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the given text into ${targetLanguage}. Return only the translated text without any explanation or additional commentary.`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3
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
// 4. 사이드 패널로 메시지 전달
//    (현재 탭의 content-script → sidepanel)
// ──────────────────────────────────────────────
async function forwardToSidePanel(message) {
  // 모든 탭을 대상으로 메시지를 브로드캐스트하면 오버헤드가 크므로
  // runtime.sendMessage로 extension 내부에 전달한다.
  chrome.runtime.sendMessage({ ...message, type: "FILL_SIDEPANEL" }).catch(() => {
    // 사이드 패널이 닫혀 있으면 에러가 발생할 수 있어 무시
  });
}

// ──────────────────────────────────────────────
// 5. 설정 저장 / 불러오기 (chrome.storage.local)
// ──────────────────────────────────────────────
async function saveSettings(payload, sendResponse) {
  await chrome.storage.local.set(payload);
  sendResponse({ success: true });
}

async function loadSettings(sendResponse) {
  const data = await chrome.storage.local.get([
    "openaiApiKey",
    "defaultTargetLanguage"
  ]);
  sendResponse({ success: true, data });
}
