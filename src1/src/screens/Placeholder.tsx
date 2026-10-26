import type { ScreenProps } from '@gagyebu/draft-kit';

/** 시안 작업 전 자리표시자. 시안 작업에서 지운다 */
export function Placeholder({ name, fixture }: ScreenProps & { name: string }) {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>{name}</h1>
      <p>
        {fixture.label}: {fixture.note}
      </p>
    </main>
  );
}
