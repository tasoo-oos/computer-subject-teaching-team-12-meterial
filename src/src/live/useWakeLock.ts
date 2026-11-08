// Wake Lock (docs/live-api.md §10.3). 학생 화면 마운트 시 화면 꺼짐 방지를 요청하고
// 언마운트·숨김 시 해제, 다시 보이면 재요청한다. 미지원 브라우저는 조용히 넘어간다.
import { useEffect } from 'react';

/** lib 버전에 Wake Lock 타입이 없을 수 있어 구조 타입으로만 쓴다 */
interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: string, listener: () => void): void;
}

export function useWakeLock(): void {
  useEffect(() => {
    const nav = navigator as { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };
    let lock: WakeLockSentinelLike | null = null;
    let disposed = false;

    const request = async () => {
      if (disposed || lock || !nav.wakeLock) return;
      try {
        lock = await nav.wakeLock.request('screen');
        lock.addEventListener('release', () => {
          lock = null;
        });
      } catch {
        // 미지원·거부(다른 탭이 잡은 경우 등)는 조용히 넘어간다
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release().catch(() => {});
      lock = null;
    };
  }, []);
}
