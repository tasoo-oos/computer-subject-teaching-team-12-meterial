// act 거부 사유 → 학생용 짧은 안내 문구 (docs/live-api.md §5.1 ActReject).
// 화면은 깨지지 않고 잠깐 보여 주면 다음 state/class 메시지로 다시 동기화된다.
import type { ActAck, ActReject } from '@gagyebu/live';

/** 거부 사항을 학생 안내문으로 바꾼다. 서버가 준 문구가 있으면 그것을 우선한다 */
export function actRejectMessage(reason: ActReject, serverMessage?: string): string {
  if (serverMessage) return serverMessage;
  switch (reason) {
    case 'stale-beat':
      return '이미 다음 단계로 넘어갔어요. 화면이 곧 따라옵니다.';
    case 'too-fast':
      return '잠깐만요, 아직 처리 중이에요. 조금 뒤에 다시 눌러 주세요.';
    case 'not-allowed':
      return '지금은 할 수 없어요.';
    case 'class-ended':
      return '수업이 끝났어요.';
    case 'server-error':
      return '잠시 문제가 생겼어요. 다시 시도해 주세요.';
  }
}

/** ack 실패를 안내문으로. ok면 null */
export function actAckNotice(ack: ActAck<unknown>): string | null {
  return ack.ok ? null : actRejectMessage(ack.reason, ack.message);
}

/** 실패한 ack(ok: false)의 안내문 */
export function actRejectText(ack: ActAck<unknown> & { ok: false }): string {
  return actRejectMessage(ack.reason, ack.message);
}
