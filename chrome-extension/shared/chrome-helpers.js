/**
 * shared/chrome-helpers.js
 * ------------------------
 * chrome.* API 호출을 Promise 기반으로 쓰기 쉽게 감싼다.
 * (초보자도 읽기 쉬운 정도의 최소 유틸만 둔다)
 */
(function () {
  "use strict";

  const PT = globalThis.PT;

  PT.chrome = PT.chrome || {};

  PT.chrome.sendMessage = function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  };

  PT.chrome.storageGet = function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  };

  PT.chrome.storageSet = function storageSet(payload) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(payload, () => resolve());
      } catch (e) {
        reject(e);
      }
    });
  };
})();

