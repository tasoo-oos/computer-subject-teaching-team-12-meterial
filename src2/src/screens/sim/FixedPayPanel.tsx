import { formatWon, type Choice } from '@gagyebu/core';
import { CreditCard, Info } from 'lucide-react';
import { AccountIcon } from '../../components/AccountBadge.tsx';
import { Button } from '../../components/ui.tsx';
import { Sheet } from './Sheet.tsx';

/** 고정 지불형: 지불 방식이 정해져 있어 확인만 한다 */
export function FixedPayPanel({ choice, onClose, onConfirm }: { choice: Choice; onClose: () => void; onConfirm: () => void }) {
  const fp = choice.fixedPay!;
  const months = fp.cardMonths ?? 1;
  const monthly = Math.round(fp.amount / months);
  return (
    <Sheet
      title={choice.label}
      subtitle="지불 방식이 이미 정해져 있습니다. 내용을 확인하고 확정하세요."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] text-ink-2">
            <span className="text-ink-3">총액 </span>
            <strong className="num text-ink">{formatWon(fp.amount)}</strong>
            <span className="num text-ink-3"> · {months === 1 ? '일시불' : `${months}개월`}</span>
          </div>
          <Button size="lg" onClick={onConfirm}>
            이 방식으로 확정
          </Button>
        </div>
      }
    >
      <div className="rounded-2xl border border-line bg-surface-2 p-3.5">
        <div className="flex items-center gap-2">
          <AccountIcon id="card" />
          <div>
            <div className="text-[13px] font-bold text-ink">지불 방식</div>
            <div className="text-[12px] text-ink-2">{fp.label}</div>
          </div>
          <span className="num ml-auto text-lg font-bold text-ink">{formatWon(fp.amount)}</span>
        </div>
        <dl className="num mt-3 grid grid-cols-2 gap-2 border-t border-line pt-2.5 text-[13px]">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-3">개월 수</dt>
            <dd className="font-bold text-ink">{months}개월</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-3">매달 갚을 돈</dt>
            <dd className="font-bold text-ink">{formatWon(monthly)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-3">수수료</dt>
            <dd className="font-bold text-ink">{fp.interestFree ? '무이자' : '연 15% (가정)'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-3">갚는 기간</dt>
            <dd className="font-bold text-ink">다음 달부터</dd>
          </div>
        </dl>
      </div>
      <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-ink-3">
        <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
        할부는 월 납입금이 아니라 총액으로 판단합니다. 결산 때 남은 부채가 있으면 엔딩에 반영됩니다.
      </p>
    </Sheet>
  );
}
