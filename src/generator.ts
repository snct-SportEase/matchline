import type { BracketData, Match, MatchTeam, MatchVenue, Round } from './types';

/**
 * generateBracketData の生成オプション
 */
export interface GenerateBracketOptions {
  /** 3位決定戦を含めるかどうか（デフォルト: false） */
  includeThirdPlace?: boolean;
  /** 3位決定戦の見出し（デフォルト: "3位決定戦"） */
  thirdPlaceTitle?: string;
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
 * 任意のチーム配列から、シングルエリミネーションの BracketData を自動生成する
 *
 * - 16 / 32 / 64 / 128 チームなどの大規模トーナメントに対応
 * - 2のべき乗でないチーム数の場合、上位シードに BYE（不戦勝）を自動配置し2回戦へ進出させる
 */
export function generateBracketData(
  teams: MatchTeam[],
  options: GenerateBracketOptions = {},
): BracketData {
  if (teams.length < 2) {
    return { rounds: [] };
  }

  // 2のべき乗へ切り上げたブラケットサイズとラウンド数を算出
  const totalRounds = Math.ceil(Math.log2(teams.length));
  const bracketSize = 2 ** totalRounds;
  const seedOrder = buildSeedOrder(bracketSize);
  const getRoundName = options.getRoundName ?? defaultGetRoundName;
  const venues = options.venues && options.venues.length > 0 ? options.venues : undefined;

  const rounds: Round[] = [];
  let globalMatchSeq = 1;

  // 各ラウンドの骨格を生成
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const matchCount = bracketSize / 2 ** (roundIndex + 1);
    const matches: Match[] = [];

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex++) {
      const id = `r${roundIndex + 1}-m${matchIndex + 1}`;
      const venue = venues ? venues[(globalMatchSeq - 1) % venues.length] : undefined;
      globalMatchSeq++;

      matches.push({
        id,
        venue,
        status: 'scheduled',
        teams: [null, null],
      });
    }

    rounds.push({
      id: `round-${roundIndex + 1}`,
      name: getRoundName(roundIndex, totalRounds, matchCount),
      matches,
    });
  }

  // 1回戦へ標準シード順でチームおよび BYE を配置
  const firstRound = rounds[0];
  for (let matchIndex = 0; matchIndex < firstRound.matches.length; matchIndex++) {
    const match = firstRound.matches[matchIndex];
    const seedA = seedOrder[matchIndex * 2];
    const seedB = seedOrder[matchIndex * 2 + 1];

    const rawA = teams[seedA - 1];
    const rawB = teams[seedB - 1];

    const slotA: MatchTeam = rawA
      ? { ...rawA, seed: rawA.seed ?? seedA }
      : { isBye: true };
    const slotB: MatchTeam = rawB
      ? { ...rawB, seed: rawB.seed ?? seedB }
      : { isBye: true };

    // 片方が BYE の場合は不戦勝として2回戦へ自動進出させる
    if (slotA.isBye && !slotB.isBye) {
      slotB.isWinner = true;
      match.status = 'bye';
      if (rounds[1]) {
        const nextMatch = rounds[1].matches[Math.floor(matchIndex / 2)];
        const slotIdx = matchIndex % 2;
        nextMatch.teams[slotIdx] = { ...slotB, isWinner: false, score: null };
      }
    } else if (!slotA.isBye && slotB.isBye) {
      slotA.isWinner = true;
      match.status = 'bye';
      if (rounds[1]) {
        const nextMatch = rounds[1].matches[Math.floor(matchIndex / 2)];
        const slotIdx = matchIndex % 2;
        nextMatch.teams[slotIdx] = { ...slotA, isWinner: false, score: null };
      }
    }

    match.teams = [slotA, slotB];
  }

  const result: BracketData = { rounds };

  if (options.includeThirdPlace && totalRounds >= 2) {
    result.thirdPlaceTitle = options.thirdPlaceTitle ?? '3位決定戦';
    result.thirdPlaceMatch = {
      id: 'm-3rd',
      venue: venues ? venues[0] : undefined,
      status: 'scheduled',
      teams: [null, null],
    };
  }

  return result;
}
