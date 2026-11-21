import { getMatchKey, isBronze } from './renderer';
import type { BracketData, Match } from './types';

/**
 * バリデーションで検出されるエラー・警告コード
 */
export type ValidationErrorCode =
  | 'INVALID_DATA'
  | 'EMPTY_ROUNDS'
  | 'INVALID_ROUND_INDEX'
  | 'INVALID_MATCH_ORDER'
  | 'DUPLICATE_MATCH_ORDER'
  | 'DUPLICATE_MATCH_ID'
  | 'DUPLICATE_BRONZE_MATCH'
  | 'UNKNOWN_CONTESTANT'
  | 'TOO_MANY_SIDES'
  | 'MULTIPLE_WINNERS'
  | 'INVALID_NEXT_MATCH_ID'
  | 'BROKEN_ROUND_CONNECTION'
  | 'WINNER_PROGRESSION_MISMATCH';

/**
 * 単一のバリデーション指摘事項
 */
export interface BracketValidationIssue {
  /** 機械判別用のコード */
  code: ValidationErrorCode;
  /** 重要度（'error' は不正データ、'warning' は注意喚起） */
  severity: 'error' | 'warning';
  /** 管理画面等にそのまま表示できる日本語メッセージ */
  message: string;
  /** 問題箇所のデータパス（例: "matches[2].sides[0].contestantId"） */
  path?: string;
  /** matches 配列内のインデックス（試合に紐づく場合） */
  matchIndex?: number;
  /** 該当試合のラウンドインデックス */
  roundIndex?: number;
  /** 該当試合の並び順 */
  order?: number;
  /** 該当試合のID */
  matchId?: string;
}

/**
 * validateBracketData の戻り値
 */
export interface BracketValidationResult {
  /** エラーが0件の場合 true（warnings のみの場合は true） */
  valid: boolean;
  /** 検出されたエラー一覧 */
  errors: BracketValidationIssue[];
  /** 検出された警告一覧 */
  warnings: BracketValidationIssue[];
}

/**
 * BracketData の整合性を検証する（例外は投げず結果オブジェクトを返す）
 *
 * 検査項目:
 * - rounds / matches の基本構造
 * - roundIndex が rounds の範囲内か
 * - 同一ラウンドで order が重複していないか（および 0 以上の整数か）
 * - 3位決定戦（isBronzeMatch）が重複していないか
 * - 同じ試合 ID（match.id）が重複していないか
 * - contestantId が contestants 辞書に存在するか
 * - 1試合に3チーム以上（sides.length > 2）入っていないか
 * - 勝者（isWinner: true）が複数指定されていないか
 * - 次ラウンドとの接続関係（nextMatchId および標準ブラケットの order 整合性）が成立しているか
 */
export function validateBracketData(data: BracketData): BracketValidationResult {
  const errors: BracketValidationIssue[] = [];
  const warnings: BracketValidationIssue[] = [];

  if (!data || typeof data !== 'object' || !Array.isArray(data.rounds)) {
    errors.push({
      code: 'INVALID_DATA',
      severity: 'error',
      message: 'ブラケットデータの形式が不正です（rounds 配列が必要です）。',
      path: 'rounds',
    });
    return { valid: false, errors, warnings };
  }

  const totalRounds = data.rounds.length;
  if (totalRounds === 0) {
    errors.push({
      code: 'EMPTY_ROUNDS',
      severity: 'error',
      message: 'rounds が空です。少なくとも1つ以上のラウンドを指定してください。',
      path: 'rounds',
    });
    return { valid: false, errors, warnings };
  }

  const matches = data.matches ?? [];
  if (!Array.isArray(matches)) {
    errors.push({
      code: 'INVALID_DATA',
      severity: 'error',
      message: 'matches は配列で指定してください。',
      path: 'matches',
    });
    return { valid: false, errors, warnings };
  }

  const contestants = data.contestants ?? {};

  // 重複検査および接続検査用のインデックス
  const seenRoundOrders = new Map<string, number>();
  const seenMatchIds = new Map<string, number>();
  const matchKeySet = new Set<string>();
  const normalMatchMap = new Map<string, Match>();
  let bronzeCount = 0;

  // 1パス目: 存在する全マッチキーを収集（nextMatchId 解決用）
  for (const match of matches) {
    if (!match || typeof match !== 'object') continue;
    if (match.id) {
      matchKeySet.add(match.id);
    }
    matchKeySet.add(getMatchKey(match));
    if (
      !isBronze(match) &&
      Number.isInteger(match.roundIndex) &&
      Number.isInteger(match.order)
    ) {
      normalMatchMap.set(`${match.roundIndex}:${match.order}`, match);
    }
  }

  // 2パス目: 各試合の詳細検証
  matches.forEach((match, matchIndex) => {
    const basePath = `matches[${matchIndex}]`;
    if (!match || typeof match !== 'object') {
      errors.push({
        code: 'INVALID_DATA',
        severity: 'error',
        message: `matches[${matchIndex}] が不正なオブジェクトです。`,
        path: basePath,
        matchIndex,
      });
      return;
    }

    const bronze = isBronze(match);
    const commonMeta = {
      matchIndex,
      roundIndex: match.roundIndex,
      order: match.order,
      matchId: match.id,
    };

    // 1. match.id の重複チェック
    if (match.id !== undefined && match.id !== '') {
      const prevIdx = seenMatchIds.get(match.id);
      if (prevIdx !== undefined) {
        errors.push({
          code: 'DUPLICATE_MATCH_ID',
          severity: 'error',
          message: `試合ID "${match.id}" が重複しています（matches[${prevIdx}] と matches[${matchIndex}]）。`,
          path: `${basePath}.id`,
          ...commonMeta,
        });
      } else {
        seenMatchIds.set(match.id, matchIndex);
      }
    }

    // 2. roundIndex の範囲チェック
    const validRoundIndex =
      Number.isInteger(match.roundIndex) &&
      match.roundIndex >= 0 &&
      match.roundIndex < totalRounds;
    if (!validRoundIndex) {
      errors.push({
        code: 'INVALID_ROUND_INDEX',
        severity: 'error',
        message: `roundIndex (${String(match.roundIndex)}) が rounds の範囲（0〜${totalRounds - 1}）外です。`,
        path: `${basePath}.roundIndex`,
        ...commonMeta,
      });
    }

    // 3. order の妥当性および同一ラウンド内重複チェック
    const validOrder = Number.isInteger(match.order) && match.order >= 0;
    if (!validOrder) {
      errors.push({
        code: 'INVALID_MATCH_ORDER',
        severity: 'error',
        message: `order (${String(match.order)}) は 0 以上の整数で指定してください。`,
        path: `${basePath}.order`,
        ...commonMeta,
      });
    }

    if (bronze) {
      bronzeCount++;
      if (bronzeCount > 1) {
        errors.push({
          code: 'DUPLICATE_BRONZE_MATCH',
          severity: 'error',
          message: '3位決定戦（isBronzeMatch）が複数指定されています。',
          path: `${basePath}.isBronzeMatch`,
          ...commonMeta,
        });
      }
    } else if (validRoundIndex && validOrder) {
      const roKey = `${match.roundIndex}:${match.order}`;
      const prevIdx = seenRoundOrders.get(roKey);
      if (prevIdx !== undefined) {
        errors.push({
          code: 'DUPLICATE_MATCH_ORDER',
          severity: 'error',
          message: `ラウンド ${match.roundIndex} で order=${match.order} が重複しています（matches[${prevIdx}] と matches[${matchIndex}]）。`,
          path: `${basePath}.order`,
          ...commonMeta,
        });
      } else {
        seenRoundOrders.set(roKey, matchIndex);
      }
    }

    // 4. sides の件数・contestantId 存在・複数勝者チェック
    const sides = match.sides;
    if (sides !== undefined) {
      if (!Array.isArray(sides)) {
        errors.push({
          code: 'INVALID_DATA',
          severity: 'error',
          message: 'sides は配列で指定してください。',
          path: `${basePath}.sides`,
          ...commonMeta,
        });
      } else {
        if (sides.length > 2) {
          errors.push({
            code: 'TOO_MANY_SIDES',
            severity: 'error',
            message: `1試合に ${sides.length} チーム指定されています（最大2チームまでです）。`,
            path: `${basePath}.sides`,
            ...commonMeta,
          });
        }

        let winnerCount = 0;
        sides.forEach((side, sideIndex) => {
          if (!side || typeof side !== 'object') return;
          if (side.isWinner) {
            winnerCount++;
          }
          if (side.contestantId !== undefined && side.contestantId !== '') {
            if (!Object.prototype.hasOwnProperty.call(contestants, side.contestantId)) {
              errors.push({
                code: 'UNKNOWN_CONTESTANT',
                severity: 'error',
                message: `contestantId "${side.contestantId}" が contestants に存在しません。`,
                path: `${basePath}.sides[${sideIndex}].contestantId`,
                ...commonMeta,
              });
            }
          }
        });

        if (winnerCount > 1) {
          errors.push({
            code: 'MULTIPLE_WINNERS',
            severity: 'error',
            message: `1試合に勝者（isWinner: true）が ${winnerCount} 件指定されています。`,
            path: `${basePath}.sides`,
            ...commonMeta,
          });
        }
      }
    }

    // 5. 次ラウンドとの接続関係チェック
    if (match.nextMatchId !== undefined && match.nextMatchId !== '') {
      const selfKey = getMatchKey(match);
      if (match.nextMatchId === selfKey || match.nextMatchId === match.id) {
        errors.push({
          code: 'INVALID_NEXT_MATCH_ID',
          severity: 'error',
          message: `nextMatchId "${match.nextMatchId}" が自分自身を参照しています。`,
          path: `${basePath}.nextMatchId`,
          ...commonMeta,
        });
      } else if (!matchKeySet.has(match.nextMatchId)) {
        errors.push({
          code: 'INVALID_NEXT_MATCH_ID',
          severity: 'error',
          message: `nextMatchId "${match.nextMatchId}" に対応する試合が存在しません。`,
          path: `${basePath}.nextMatchId`,
          ...commonMeta,
        });
      }
    } else if (!bronze && validRoundIndex && validOrder) {
      const expectedMaxMatches = 2 ** (totalRounds - 1 - match.roundIndex);
      if (match.order >= expectedMaxMatches) {
        errors.push({
          code: 'BROKEN_ROUND_CONNECTION',
          severity: 'error',
          message: `ラウンド ${match.roundIndex} の order=${match.order} が標準ブラケット上限（0〜${expectedMaxMatches - 1}）を超えているため、次ラウンドと正しく接続できません。`,
          path: `${basePath}.order`,
          ...commonMeta,
        });
      } else if (match.roundIndex < totalRounds - 1 && Array.isArray(sides)) {
        // 勝者が確定しているのに、次ラウンド対応スロットに別参加者が入っている場合は警告を出す
        const winnerSide = sides.find((s) => s?.isWinner && s.contestantId);
        if (winnerSide?.contestantId) {
          const nextOrder = Math.floor(match.order / 2);
          const nextSlot = match.order % 2;
          const nextMatch = normalMatchMap.get(`${match.roundIndex + 1}:${nextOrder}`);
          const nextSlotContestantId = nextMatch?.sides?.[nextSlot]?.contestantId;
          if (nextSlotContestantId && nextSlotContestantId !== winnerSide.contestantId) {
            warnings.push({
              code: 'WINNER_PROGRESSION_MISMATCH',
              severity: 'warning',
              message: `ラウンド ${match.roundIndex} (order=${match.order}) の勝者 "${winnerSide.contestantId}" と、次ラウンド対応スロットの参加者 "${nextSlotContestantId}" が一致していません。`,
              path: `${basePath}.sides`,
              ...commonMeta,
            });
          }
        }
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
