/**
 * shared/text-utils.js
 * --------------------
 * 텍스트 처리 유틸.
 * - 나중에 "한글 선택 시 링크 액션" 같은 기능을 붙이기 위한 기반이기도 하다.
 */
(function () {
  "use strict";

  const PT = globalThis.PT;

  PT.text = PT.text || {};

  PT.text.isHangulIncluded = function isHangulIncluded(text) {
    if (!text) return false;
    // 한글 음절/자모 범위를 넉넉히 포함
    return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
  };

  PT.text.escapeHtml = function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };
})();

