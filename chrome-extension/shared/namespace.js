/**
 * shared/namespace.js
 * -------------------
 * content-script / sidepanel / service-worker가 "같은 이름"으로 공통 상수/유틸을
 * 참조할 수 있도록 전역 네임스페이스를 만든다.
 *
 * - MV3 환경에서 파일을 모듈로 바꾸지 않고도(초보자 친화)
 *   공통 코드를 안전하게 공유하는 목적이다.
 */
(function () {
  "use strict";

  const root = globalThis;
  if (!root.PT) root.PT = {};
})();

