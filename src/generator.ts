import type { BracketData, Contestant, Match, MatchVenue, Player, Round, Side } from './types';

/**
 * generateBracketData へ渡す参加者入力の型
 */
export interface SeedContestantInput {
  /** 参加者の一意なID（省略時は "c1", "c2"... を自動採番） */
  id?: string;
  /** 表示名（players を省略した場合に使用） */
  title?: string;
  /** 国籍・地域・国旗絵文字（players を省略した場合に使用） */
  nationality?: string;
  /** シード番号や予選ステータス（省略時は配列順の1始まり番号を自動付与） */
  entryStatus?: string;
  /** ダブルス等で複数選手を指定したい場合 */
  players?: Player[];
}

/**
 * generateBracketData の生成オプション
 */
export interface GenerateBracketOptions {
  /** 3位決定戦（isBronzeMatch）を含めるかどうか（デフォルト: false） */
  includeBronzeMatch?: boolean;
  /** ラウンド名をカスタム生成する関数 */
  getRoundName?: (roundIndex: number, totalRounds: number, matchCount: number) => string;
  /** 各試合へ順番に割り当てるコート・会場リスト（任意） */
  venues?: MatchVenue[];
}

/**
 * 標準的なシングルエリミネーションのシード配置順を生成する
 * 例: size=8 -> [1, 8, 4, 5, 2, 7, 3, 6]
 */
function buildSeedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const nextSize = order.length * 2;
    const nextOrder: number[] = [];
    for (const seed of order) {
      nextOrder.push(seed, nextSize + 1 - seed);
    }
    order = nextOrder;
  }
  return order;
}

/**
 * 試合数に応じたデフォルトの日本語ラウンド名を返す
 */
function defaultGetRoundName(roundIndex: number, _totalRounds: number, matchCount: number): string {
  if (matchCount === 1) return '決勝';
  if (matchCount === 2) return '準決勝';
  if (matchCount === 4) return '準々決勝';
  return `${roundIndex + 1}回戦`;
}

/**
 * 任意の参加者配列から、Bracketry 互換の BracketData（rounds / matches / contestants）を自動生成する
 *
 * - 16 / 32 / 64 / 128 参加者などの大規模トーナメントに対応
 * - 2のべき乗でない場合、上位シードに BYE（不戦勝）を自動配置し2回戦へ進出させる
 */
export function generateBracketData(
  entries: SeedContestantInput[],
  options: GenerateBracketOptions = {},
): BracketData {
  if (entries.length < 2) {
    return { rounds: [], matches: [], contestants: {} };
  }

  const totalRounds = Math.ceil(Math.log2(entries.length));
  const bracketSize = 2 ** totalRounds;
  const seedOrder = buildSeedOrder(bracketSize);
  const getRoundName = options.getRoundName ?? defaultGetRoundName;
  const venues = options.venues && options.venues.length > 0 ? options.venues : undefined;

  const contestants: Record<string, Contestant> = {};
  const contestantIds: string[] = [];

  entries.forEach((entry, index) => {
    const id = entry.id ?? `c${index + 1}`;
    contestantIds.push(id);
    contestants[id] = {
      entryStatus: entry.entryStatus ?? String(index + 1),
      players:
        entry.players && entry.players.length > 0
          ? entry.players
          : [{ title: entry.title ?? `チーム${index + 1}`, nationality: entry.nationality }],
    };
  });

  const rounds: Round[] = [];
  const matchesByRound: Match[][] = [];
  let globalMatchSeq = 1;

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const matchCount = bracketSize / 2 ** (roundIndex + 1);
    rounds.push({
      id: `round-${roundIndex + 1}`,
      name: getRoundName(roundIndex, totalRounds, matchCount),
    });

    const roundMatches: Match[] = [];
    for (let order = 0; order < matchCount; order++) {
      const venue = venues ? venues[(globalMatchSeq - 1) % venues.length] : undefined;
      globalMatchSeq++;

      roundMatches.push({
        roundIndex,
        order,
        venue,
        sides: [],
      });
    }
    matchesByRound.push(roundMatches);
  }

  // 1回戦へ標準シード順で参加者および BYE を配置
  const firstRoundMatches = matchesByRound[0];
  for (let order = 0; order < firstRoundMatches.length; order++) {
    const match = firstRoundMatches[order];
    const seedA = seedOrder[order * 2];
    const seedB = seedOrder[order * 2 + 1];

    const idA = contestantIds[seedA - 1];
    const idB = contestantIds[seedB - 1];

    const sideA: Side = idA ? { contestantId: idA } : { isBye: true };
    const sideB: Side = idB ? { contestantId: idB } : { isBye: true };

    // 片方が BYE の場合は不戦勝として2回戦へ自動進出させる
    if (sideA.isBye && !sideB.isBye && idB) {
      sideB.isWinner = true;
      match.matchStatus = '不戦勝';
      if (matchesByRound[1]) {
        const nextMatch = matchesByRound[1][Math.floor(order / 2)];
        const nextSides = nextMatch.sides ?? [];
        nextSides[order % 2] = { contestantId: idB };
        nextMatch.sides = nextSides;
      }
    } else if (!sideA.isBye && sideB.isBye && idA) {
      sideA.isWinner = true;
      match.matchStatus = '不戦勝';
      if (matchesByRound[1]) {
        const nextMatch = matchesByRound[1][Math.floor(order / 2)];
        const nextSides = nextMatch.sides ?? [];
        nextSides[order % 2] = { contestantId: idA };
        nextMatch.sides = nextSides;
      }
    }

    match.sides = [sideA, sideB];
  }

  const matches: Match[] = matchesByRound.flat();

  if (options.includeBronzeMatch && totalRounds >= 2) {
    matches.push({
      roundIndex: totalRounds - 1,
      order: 1,
      isBronzeMatch: true,
      venue: venues ? venues[0] : undefined,
      sides: [],
    });
  }

  return {
    rounds,
    matches,
    contestants,
  };
}
