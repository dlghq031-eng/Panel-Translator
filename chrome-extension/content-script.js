/**
 * content-script.js
 * -----------------
 * 웹페이지에 자동으로 주입되는 스크립트.
 * - 사용자가 텍스트를 드래그(선택)하면 감지한다.
 * - 선택된 텍스트 근처에 작은 "번역" 플로팅 버튼을 표시한다.
 * - 버튼을 클릭하면 인라인 번역 카드를 화면에 보여주거나
 *   사이드 패널에 텍스트를 채워 넣는다.
 */

(function () {
  "use strict";

  // ──────────────────────────────────────────────
  // 상수 및 상태 변수
  // ──────────────────────────────────────────────
  const FLOAT_BTN_ID  = "ai-translator-float-btn";
  const INLINE_CARD_ID = "ai-translator-inline-card";
  let hideTimer = null;

  // ──────────────────────────────────────────────
  // 1. 텍스트 선택 감지 (mouseup 이벤트)
  // ──────────────────────────────────────────────
  document.addEventListener("mouseup", (e) => {
    // 플로팅 버튼이나 인라인 카드 위에서의 클릭은 무시
    if (e.target.closest(`#${FLOAT_BTN_ID}`) || e.target.closest(`#${INLINE_CARD_ID}`)) return;

    const selectedText = window.getSelection().toString().trim();

    if (selectedText.length > 0) {
      clearTimeout(hideTimer);
      showFloatButton(e.pageX, e.pageY, selectedText);
    } else {
      scheduleHide();
    }
  });

  // 페이지 다른 곳 클릭 시 버튼/카드 숨김
  document.addEventListener("mousedown", (e) => {
    if (e.target.closest(`#${FLOAT_BTN_ID}`) || e.target.closest(`#${INLINE_CARD_ID}`)) return;
    scheduleHide();
  });

  // ──────────────────────────────────────────────
  // 2. 플로팅 번역 버튼 생성 및 표시
  // ──────────────────────────────────────────────
  function showFloatButton(x, y, selectedText) {
    removeElement(FLOAT_BTN_ID);
    removeElement(INLINE_CARD_ID);

    const btn = document.createElement("button");
    btn.id = FLOAT_BTN_ID;
    btn.textContent = "번역";
    btn.setAttribute("aria-label", "선택한 텍스트 번역");

    // [수정] e.pageX / e.pageY 는 이미 스크롤 오프셋을 포함한 문서 기준 좌표다.
    // position: absolute 요소는 문서 기준으로 배치되므로 pageX/Y 를 그대로 사용한다.
    // 이전 코드에서 window.scrollX/Y 를 추가로 더하면 스크롤 값이 2배가 되어
    // 페이지를 스크롤한 상태에서 버튼이 엉뚱한 위치에 나타나는 버그가 있었다.
    btn.style.left = `${x}px`;
    btn.style.top  = `${y - 40}px`;

    btn.addEventListener("click", () => {
      handleTranslateClick(selectedText, btn);
    });

    document.body.appendChild(btn);
  }

  // ──────────────────────────────────────────────
  // 3. 번역 버튼 클릭 처리
  // ──────────────────────────────────────────────
  async function handleTranslateClick(text, btn) {
    // [수정] getBoundingClientRect()는 요소가 DOM에 있을 때만 올바른 좌표를 반환한다.
    // 이전 코드는 removeElement()로 btn을 먼저 제거한 뒤 rect를 읽어
    // 항상 {top:0, left:0, bottom:0} 을 반환했고, 인라인 카드가 화면 최상단에 나타났다.
    // 해결: btn을 제거하기 전에 위치를 미리 캡처한다.
    const btnRect = btn.getBoundingClientRect();
    removeElement(FLOAT_BTN_ID);

    // 기본 목표 언어를 storage에서 읽어온다
    const { defaultTargetLanguage } = await getStorageLocal(["defaultTargetLanguage"]);
    const targetLanguage = defaultTargetLanguage || "Korean";

    // 로딩 카드를 먼저 표시
    const card = showInlineCard("번역 중...", text, btnRect);

    try {
      // service-worker에게 번역 요청
      const response = await sendMessageToBackground({
        type: "TRANSLATE_REQUEST",
        payload: { text, targetLanguage }
      });

      if (response.success) {
        updateInlineCard(card, response.data);
      } else {
        updateInlineCard(card, `오류: ${response.error}`);
      }
    } catch (err) {
      updateInlineCard(card, `오류: ${err.message}`);
    }

    // 사이드 패널에도 텍스트를 전달 (사이드 패널이 열려 있을 경우 자동으로 채워짐)
    chrome.runtime.sendMessage({
      type: "SELECTION_TO_SIDEPANEL",
      payload: { text, targetLanguage }
    }).catch(() => {}); // 사이드 패널이 닫혀있으면 무시
  }

  // ──────────────────────────────────────────────
  // 4. 인라인 번역 카드 생성
  // ──────────────────────────────────────────────
  // [수정] anchorEl(element) 대신 미리 캡처된 anchorRect(DOMRect)를 받는다.
  // getBoundingClientRect()는 뷰포트 기준 좌표를 반환하므로,
  // position:absolute 요소 배치를 위해 window.scrollX/Y 를 더해 문서 기준으로 변환한다.
  function showInlineCard(resultText, originalText, anchorRect) {
    removeElement(INLINE_CARD_ID);

    const card = document.createElement("div");
    card.id = INLINE_CARD_ID;

    // 위치: 앵커(btn) 아래에 표시
    const rect = anchorRect || { left: 0, bottom: 0 };
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    card.style.left = `${rect.left + scrollX}px`;
    card.style.top  = `${rect.bottom + scrollY + 8}px`;

    card.innerHTML = `
      <div class="ait-card-header">
        <span class="ait-card-label">번역 결과</span>
        <button class="ait-card-close" aria-label="닫기">✕</button>
      </div>
      <div class="ait-card-original">${escapeHtml(originalText)}</div>
      <div class="ait-card-divider"></div>
      <div class="ait-card-result">${escapeHtml(resultText)}</div>
    `;

    card.querySelector(".ait-card-close").addEventListener("click", () => {
      removeElement(INLINE_CARD_ID);
    });

    document.body.appendChild(card);
    return card;
  }

  function updateInlineCard(card, resultText) {
    if (!card || !card.isConnected) return;
    const resultEl = card.querySelector(".ait-card-result");
    if (resultEl) resultEl.textContent = resultText;
  }

  // ──────────────────────────────────────────────
  // 5. 유틸리티 함수들
  // ──────────────────────────────────────────────
  function removeElement(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      removeElement(FLOAT_BTN_ID);
      removeElement(INLINE_CARD_ID);
    }, 200);
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  function getStorageLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  // ──────────────────────────────────────────────
  // 6. 사이드 패널에서 오는 메시지 수신
  //    (예: 사이드 패널에서 번역 완료 알림 등 미래 확장용)
  // ──────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TRANSLATE_DONE_FROM_PANEL") {
      // 미래 확장: 사이드 패널 번역 결과를 페이지에 표시하는 용도로 활용 가능
    }
  });

})();
