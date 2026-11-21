import { isBronze } from './renderer';
import type { BracketData, Match, Score, Side } from './types';

/**
 * recordMatchResult へ渡す試合結果入力
 */
export interface RecordMatchResultInput {
  /** 対象試合のラウンドインデックス（0始まり） */
  roundIndex: number;
  /** 対象試合の並び順（0始まり） */
  order: number;
  /** 3位決定戦の結果を記録する場合は true */
  isBronzeMatch?: boolean;
  /** 勝者となったスロットのインデックス（0: 上側, 1: 下側） */
  winnerSideIndex: 0 | 1;
  /** 各スロットのスコア [上側, 下側]（省略時は既存のスコアを維持） */
  scores?: [Score[] | undefined, Score[] | undefined];
  /** 試合ステータス文言（任意。例: "試合終了", "不戦勝"） */
  matchStatus?: string;
  /** 結果確定時に isLive を false にするか（デフォルト: true） */
  finishLive?: boolean;
}

/**
 * Side のディープコピー（scores 配列含む）を作成する
 */
function cloneSide(side: Side | undefined): Side {
  if (!side) {
    return {};
  }
  return {
    ...side,
    scores: side.scores ? side.scores.map((s) => ({ ...s })) : undefined,
  };
}

/**
 * Match のディープコピーを作成する
 */
function cloneMatch(match: Match): Match {
  return {
    ...match,
    sides: match.sides ? match.sides.map((s) => cloneSide(s)) : undefined,
    meta: match.meta ? { ...match.meta } : undefined,
  };
}

/**
 * 試合の勝敗結果を記録し、勝者を次ラウンド（および準決勝敗者を3位決定戦）へ自動進出させた
 * 新しい BracketData を返す純粋関数
 */
export function recordMatchResult(
  data: BracketData,
  input: RecordMatchResultInput,
): BracketData {
  const matches = (data.matches ?? []).map(cloneMatch);
  const finishLive = input.finishLive !== false;

  // 対象試合を検索（未登録なら新規作成）
  let targetMatch = matches.find((m) =>
    input.isBronzeMatch
      ? isBronze(m)
      : !isBronze(m) && m.roundIndex === input.roundIndex && m.order === input.order,
  );

  if (!targetMatch) {
    targetMatch = {
      roundIndex: input.roundIndex,
      order: input.order,
      isBronzeMatch: input.isBronzeMatch ? true : undefined,
      sides: [{}, {}],
    };
    matches.push(targetMatch);
  }

  const side0 = cloneSide(targetMatch.sides?.[0]);
  const side1 = cloneSide(targetMatch.sides?.[1]);
  const loserSideIndex: 0 | 1 = input.winnerSideIndex === 0 ? 1 : 0;
  const sidesPair: [Side, Side] = [side0, side1];

  sidesPair[input.winnerSideIndex].isWinner = true;
  sidesPair[loserSideIndex].isWinner = false;

  if (input.scores) {
    if (input.scores[0] !== undefined) {
      sidesPair[0].scores = input.scores[0].map((s) => ({ ...s }));
    }
    if (input.scores[1] !== undefined) {
      sidesPair[1].scores = input.scores[1].map((s) => ({ ...s }));
    }
  }

  if (finishLive) {
    targetMatch.isLive = false;
    sidesPair[0].isServing = false;
    sidesPair[1].isServing = false;
    sidesPair[0].currentScore = undefined;
    sidesPair[1].currentScore = undefined;
  }

  if (input.matchStatus !== undefined) {
    targetMatch.matchStatus = input.matchStatus;
  }

  targetMatch.sides = sidesPair;

  // 3位決定戦自体は次ラウンドへ進出しない
  if (!isBronze(targetMatch)) {
    const winnerSide = sidesPair[input.winnerSideIndex];
    const loserSide = sidesPair[loserSideIndex];
    const nextRoundIndex = targetMatch.roundIndex + 1;

    // 次ラウンドが存在すれば勝者を自動進出させる
    if (nextRoundIndex < data.rounds.length) {
      const nextOrder = Math.floor(targetMatch.order / 2);
      const nextSlotIndex = (targetMatch.order % 2) as 0 | 1;

      let nextMatch = matches.find(
        (m) => !isBronze(m) && m.roundIndex === nextRoundIndex && m.order === nextOrder,
      );
      if (!nextMatch) {
        nextMatch = {
          roundIndex: nextRoundIndex,
          order: nextOrder,
          sides: [{}, {}],
        };
        matches.push(nextMatch);
      }

      const nextSides: [Side, Side] = [
        cloneSide(nextMatch.sides?.[0]),
        cloneSide(nextMatch.sides?.[1]),
      ];

      nextSides[nextSlotIndex] = {
        ...nextSides[nextSlotIndex],
        contestantId: winnerSide.contestantId,
        title: winnerSide.contestantId ? undefined : winnerSide.title,
        isBye: false,
      };
      nextMatch.sides = nextSides;
    }

    // 準決勝の敗者を3位決定戦へ自動配置する（3位決定戦が定義されている場合）
    const isSemifinal = targetMatch.roundIndex === data.rounds.length - 2;
    if (isSemifinal && (targetMatch.order === 0 || targetMatch.order === 1)) {
      const bronzeMatch = matches.find((m) => isBronze(m));
      if (bronzeMatch) {
        const bronzeSides: [Side, Side] = [
          cloneSide(bronzeMatch.sides?.[0]),
          cloneSide(bronzeMatch.sides?.[1]),
        ];
        bronzeSides[targetMatch.order] = {
          ...bronzeSides[targetMatch.order],
          contestantId: loserSide.contestantId,
          title: loserSide.contestantId ? undefined : loserSide.title,
          isBye: false,
        };
        bronzeMatch.sides = bronzeSides;
      }
    }
  }

  return {
    ...data,
    matches,
  };
}
