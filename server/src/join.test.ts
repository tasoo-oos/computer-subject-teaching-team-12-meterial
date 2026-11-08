// join 거부 이유 (docs/live-api.md §5.1, §5.8): 잘못된 닉네임('invalid-nickname')과
// 입장 마감('join-locked')의 구분. 빈 값·공백만·10자 초과는 전용 이유로 거부되고(§14 #130),
// 'join-locked'은 실제로 잠긴 수업(또는 끝난 수업의 호환 경로)에만 쓰인다.
import { describe, expect, it } from 'vitest';
import type { JoinPayload } from '@gagyebu/live';
import { fakeSocket, makeRoom } from './testutil/helpers.ts';
import { testActivities, testLesson } from './testutil/fake.ts';

async function tryJoin(room: ReturnType<typeof makeRoom>, nickname: string) {
  return room.joinStudent(fakeSocket(), { nickname } satisfies JoinPayload);
}

describe('join: 잘못된 닉네임 → invalid-nickname (§5.1, §14 #130)', () => {
  it('빈 값·공백만·10자 초과는 invalid-nickname', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    expect(await tryJoin(room, '')).toEqual({ ok: false, reason: 'invalid-nickname' });
    expect(await tryJoin(room, '   ')).toEqual({ ok: false, reason: 'invalid-nickname' });
    expect(await tryJoin(room, '\n\t ')).toEqual({ ok: false, reason: 'invalid-nickname' });
    expect(await tryJoin(room, '01234567890')).toEqual({ ok: false, reason: 'invalid-nickname' }); // 11자
    expect(await tryJoin(room, ' 열한글자이상닉네임입니다 ')).toEqual({ ok: false, reason: 'invalid-nickname' }); // 12자(공백 trim 뒤)
    // 로그·명단에 남지 않는다
    expect(room.studentCount).toBe(0);
  });

  it('10자까지는 정상 입장된다 (trim 뒤 기준)', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    const ten = await tryJoin(room, '0123456789');
    expect(ten.ok).toBe(true);
    const kr = await tryJoin(room, '닉네임열글자테스트임'); // 한글 10자
    expect(kr.ok).toBe(true);
    const padded = await tryJoin(room, '  하늘  '); // 앞뒤 공백은 trim되고 입장된다
    expect(padded.ok).toBe(true);
    expect(room.studentCount).toBe(3);
  });

  it('입장 마감·끝난 수업은 여전히 join-locked — 잘못된 닉네임과 구분된다', async () => {
    const room = makeRoom({ lesson: testLesson, activities: testActivities });
    await room.lockJoin(true);
    // 잠긴 수업에서 잘못된 닉네임을 보내도 닉네임 이유가 우선한다 (클라이언트 안내 문구 구분)
    expect(await tryJoin(room, '')).toEqual({ ok: false, reason: 'invalid-nickname' });
    expect(await tryJoin(room, '하늘')).toEqual({ ok: false, reason: 'join-locked' });
    await room.lockJoin(false);
    expect((await tryJoin(room, '하늘')).ok).toBe(true);
    await room.endClass();
    expect(await tryJoin(room, '구름')).toEqual({ ok: false, reason: 'join-locked' });
  });
});
