"use client";

import { useState, useEffect, useRef } from "react";

/**
 * 사용자 활동 감지 훅
 *
 * 마우스, 키보드, 터치, 스크롤 등의 활동을 감지하여
 * 일정 시간(기본 1분) 동안 활동이 없으면 isIdle=true 반환.
 *
 * 무료 API 한도 보호를 위해 비활동 시 폴링을 중지하는 데 사용.
 * - 탭 전환 후 복귀 시 활성으로 판단
 * - 이벤트 스로틀링 (1초) 적용
 */
export function useUserActivity(idleTimeoutMs = 60000): boolean {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef(false);

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (isIdleRef.current) {
        isIdleRef.current = false;
        setIsIdle(false);
      }
      timerRef.current = setTimeout(() => {
        isIdleRef.current = true;
        setIsIdle(true);
      }, idleTimeoutMs);
    };

    // 스로틀: 초당 최대 1회만 타이머 리셋
    let lastActivity = Date.now();
    const handler = () => {
      const now = Date.now();
      if (now - lastActivity > 1000) {
        lastActivity = now;
        resetTimer();
      }
    };

    // 탭 복귀도 활동으로 감지
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        lastActivity = Date.now();
        resetTimer();
      }
    };

    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((e) =>
      window.addEventListener(e, handler, { passive: true })
    );
    document.addEventListener("visibilitychange", handleVisibility);

    resetTimer(); // 초기 타이머 시작

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idleTimeoutMs]);

  return isIdle;
}
