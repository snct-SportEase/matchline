import '../src/style.css';
import './style.css';
import {
  createBracket,
  generateBracketData,
  type BracketData,
  type Match,
  type MatchVenue,
  type SeedContestantInput,
} from '../src/index';

/**
 * 8チーム・Bracketry互換スキーマのサンプルデータ（3位決定戦・LIVE・現在スコア含む）
 */
function createInitialData(): BracketData {
  return {
    rounds: [{ name: '準々決勝' }, { name: '準決勝' }, { name: '決勝' }],
    contestants: {
      t1: { entryStatus: '1', players: [{ title: '東京サンダーズ', nationality: '🇯🇵' }] },
      t2: { entryStatus: '2', players: [{ title: '福岡ウェーブス', nationality: '🇯🇵' }] },
      t3: { entryStatus: '3', players: [{ title: '横浜ベイサイド', nationality: '🇯🇵' }] },
      t4: { entryStatus: '4', players: [{ title: '名古屋ブレイズ', nationality: '🇯🇵' }] },
      t5: {
        entryStatus: '5',
        players: [{ title: '大阪スターズFC（長いチーム名の省略確認）', nationality: '🇯🇵' }],
      },
      t6: { entryStatus: '6', players: [{ title: '広島フェニックス', nationality: '🇯🇵' }] },
      t7: { entryStatus: '7', players: [{ title: '仙台フォレスト', nationality: '🇯🇵' }] },
      t8: { entryStatus: '8', players: [{ title: '札幌ノースウィンド', nationality: '🇯🇵' }] },
    },
    matches: [
      // 準々決勝 (roundIndex: 0)
      {
        roundIndex: 0,
        order: 0,
        venue: { id: 'c1', name: '第1コート', color: '#2563eb' },
        startTime: '10:00',
        sides: [
          {
            contestantId: 't1',
            isWinner: true,
            scores: [
              { mainScore: 6, isWinner: true },
              { mainScore: 7, subscore: 5, isWinner: true },
            ],
          },
          {
            contestantId: 't8',
            scores: [{ mainScore: 4 }, { mainScore: 6, subscore: 3 }],
          },
        ],
      },
      {
        roundIndex: 0,
        order: 1,
        venue: { id: 'c2', name: '第2コート', color: '#059669' },
        startTime: '10:00',
        sides: [
          {
            contestantId: 't4',
            scores: [{ mainScore: 6, isWinner: true }, { mainScore: 3 }, { mainScore: 4 }],
          },
          {
            contestantId: 't5',
            isWinner: true,
            scores: [
              { mainScore: 4 },
              { mainScore: 6, isWinner: true },
              { mainScore: 6, isWinner: true },
            ],
          },
        ],
      },
      {
        roundIndex: 0,
        order: 2,
        venue: { id: 'c1', name: '第1コート', color: '#2563eb' },
        startTime: '11:30',
        sides: [
          {
            contestantId: 't2',
            isWinner: true,
            scores: [
              { mainScore: 6, isWinner: true },
              { mainScore: 6, isWinner: true },
            ],
          },
          {
            contestantId: 't7',
            scores: [{ mainScore: 2 }, { mainScore: 3 }],
          },
        ],
      },
      {
        roundIndex: 0,
        order: 3,
        venue: { id: 'c2', name: '第2コート', color: '#059669' },
        startTime: '11:30',
        sides: [
          {
            contestantId: 't3',
            isWinner: true,
            scores: [
              { mainScore: 7, subscore: 4, isWinner: true },
              { mainScore: 6, isWinner: true },
            ],
          },
          {
            contestantId: 't6',
            scores: [{ mainScore: 6, subscore: 2 }, { mainScore: 4 }],
          },
        ],
      },
      // 準決勝 (roundIndex: 1)
      {
        roundIndex: 1,
        order: 0,
        venue: { id: 'center', name: 'センターコート', color: '#ef4444' },
        startTime: '2026-11-21T13:30:00+09:00',
        sides: [
          {
            contestantId: 't1',
            isWinner: true,
            scores: [
              { mainScore: 6, isWinner: true },
              { mainScore: 6, isWinner: true },
            ],
          },
          {
            contestantId: 't5',
            scores: [{ mainScore: 3 }, { mainScore: 4 }],
          },
        ],
      },
      {
        roundIndex: 1,
        order: 1,
        venue: { id: 'center', name: 'センターコート', color: '#ef4444' },
        startTime: '2026-11-21T15:00:00+09:00',
        sides: [
          {
            contestantId: 't2',
            scores: [{ mainScore: 4 }, { mainScore: 6, isWinner: true }, { mainScore: 5 }],
          },
          {
            contestantId: 't3',
            isWinner: true,
            scores: [
              { mainScore: 6, isWinner: true },
              { mainScore: 3 },
              { mainScore: 7, isWinner: true },
            ],
          },
        ],
      },
      // 決勝 (roundIndex: 2)
      {
        roundIndex: 2,
        order: 0,
        venue: { id: 'center', name: 'センターコート', color: '#ef4444' },
        label: '決勝戦',
        startTime: new Date('2026-11-21T17:00:00+09:00'),
        isLive: true,
        sides: [
          {
            contestantId: 't1',
            scores: [{ mainScore: 6, isWinner: true }, { mainScore: 4 }],
            currentScore: '30',
            isServing: true,
          },
          {
            contestantId: 't3',
            scores: [{ mainScore: 4 }, { mainScore: 4 }],
            currentScore: '15',
          },
        ],
      },
      // 3位決定戦 (isBronzeMatch: true)
      {
        roundIndex: 2,
        order: 1,
        isBronzeMatch: true,
        venue: { id: 'c2', name: '第2コート', color: '#059669' },
        startTime: '16:00',
        sides: [
          {
            contestantId: 't5',
            scores: [{ mainScore: 5 }, { mainScore: 4 }],
          },
          {
            contestantId: 't2',
            isWinner: true,
            scores: [
              { mainScore: 7, isWinner: true },
              { mainScore: 6, isWinner: true },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * 大規模トーナメント（16 / 20 / 32 / 64チーム）の Bracketry 互換ダミーデータを生成する
 */
function createLargeSampleData(teamCount: number): BracketData {
  const prefectures = [
    '東京', '大阪', '愛知', '福岡', '北海道', '神奈川', '広島', '宮城',
    '埼玉', '千葉', '兵庫', '静岡', '京都', '新潟', '長野', '熊本',
  ];
  const suffixes = [
    'サンダーズ', 'ブレイズ', 'ウェーブス', 'スターズ',
    'フォレスト', 'フェニックス', 'イーグルス', 'ライオンズ',
  ];

  const entries: SeedContestantInput[] = Array.from({ length: teamCount }, (_, i) => {
    const pref = prefectures[i % prefectures.length];
    const suf = suffixes[Math.floor(i / prefectures.length) % suffixes.length];
    return {
      id: `team-${i + 1}`,
      entryStatus: String(i + 1),
      title: `${pref}${suf} #${i + 1}`,
    };
  });

  const venues: MatchVenue[] = [
    { id: 'c1', name: '第1コート', color: '#2563eb' },
    { id: 'c2', name: '第2コート', color: '#059669' },
    { id: 'c3', name: '第3コート', color: '#d97706' },
    { id: 'c4', name: '第4コート', color: '#7c3aed' },
  ];

  const data = generateBracketData(entries, {
    includeBronzeMatch: true,
    venues,
  });

  const matches = data.matches ?? [];
  const totalRounds = data.rounds.length;
  const bronzeMatch = matches.find((m) => Boolean(m.isBronzeMatch));

  const findMatch = (r: number, o: number): Match | undefined =>
    matches.find((m) => !m.isBronzeMatch && m.roundIndex === r && m.order === o);

  for (let r = 0; r < totalRounds; r++) {
    const isFinal = r === totalRounds - 1;
    const baseHour = 9 + r * 2;
    const roundMatches = matches.filter((m) => !m.isBronzeMatch && m.roundIndex === r);

    for (const match of roundMatches) {
      const minutes = (match.order % 4) * 15;
      match.startTime = `${String(baseHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      if (match.matchStatus === '不戦勝') {
        continue;
      }

      const sideA = match.sides?.[0];
      const sideB = match.sides?.[1];
      if (!sideA?.contestantId || !sideB?.contestantId) {
        continue;
      }

      if (isFinal) {
        match.venue = { id: 'center', name: 'センターコート', color: '#ef4444' };
        match.isLive = true;
        sideA.scores = [{ mainScore: 6, isWinner: true }, { mainScore: 4 }];
        sideA.currentScore = '30';
        sideA.isServing = true;
        sideB.scores = [{ mainScore: 4 }, { mainScore: 4 }];
        sideB.currentScore = '15';
        continue;
      }

      const aWins = (r + match.order) % 5 !== 2;
      sideA.isWinner = aWins;
      sideB.isWinner = !aWins;
      sideA.scores = aWins
        ? [{ mainScore: 6, isWinner: true }, { mainScore: 6, isWinner: true }]
        : [{ mainScore: 4 }, { mainScore: 3 }];
      sideB.scores = aWins
        ? [{ mainScore: 4 }, { mainScore: 3 }]
        : [{ mainScore: 6, isWinner: true }, { mainScore: 6, isWinner: true }];

      const winnerId = aWins ? sideA.contestantId : sideB.contestantId;
      const nextMatch = findMatch(r + 1, Math.floor(match.order / 2));
      if (nextMatch) {
        const nextSides = nextMatch.sides ?? [];
        nextSides[match.order % 2] = { contestantId: winnerId };
        nextMatch.sides = nextSides;
      }

      // 準決勝の敗者を3位決定戦へ配置
      if (r === totalRounds - 2 && bronzeMatch) {
        const loserId = aWins ? sideB.contestantId : sideA.contestantId;
        const bronzeSides = bronzeMatch.sides ?? [];
        bronzeSides[match.order] = {
          contestantId: loserId,
          isWinner: match.order === 0,
          scores:
            match.order === 0
              ? [{ mainScore: 6, isWinner: true }, { mainScore: 6, isWinner: true }]
              : [{ mainScore: 4 }, { mainScore: 5 }],
        };
        bronzeMatch.sides = bronzeSides;
        bronzeMatch.startTime = `${String(baseHour + 1).padStart(2, '0')}:30`;
      }
    }
  }

  return data;
}

const container = document.getElementById('bracket-root');
const clickLogEl = document.getElementById('click-log');
const sizeSelect = document.getElementById('size-select') as HTMLSelectElement | null;
const visibleRoundsSelect = document.getElementById(
  'visible-rounds-select',
) as HTMLSelectElement | null;
const liveUpdateBtn = document.getElementById('live-update-btn') as HTMLButtonElement | null;
const teamSearchInput = document.getElementById('team-search-input') as HTMLInputElement | null;
const teamSearchBtn = document.getElementById('team-search-btn') as HTMLButtonElement | null;

if (!container) {
  throw new Error('#bracket-root が見つかりません');
}

let currentData: BracketData = createInitialData();
let liveStep = 0;

const getContestantTitle = (contestantId: string | undefined): string => {
  if (!contestantId) return 'TBD';
  const contestant = currentData.contestants?.[contestantId];
  if (!contestant || contestant.players.length === 0) return contestantId;
  return contestant.players.map((p) => p.title).join(' / ');
};

// テーマ・接続線・パス強調はコード側オプションで事前指定する
const bracket = createBracket(currentData, container, {
  theme: 'light', // 'light' | 'dark' | 'emerald' または CSS変数マップ
  connectorType: 'orthogonal', // 'orthogonal' | 'curved'
  highlightContestantHistory: true,
  highlightTrigger: 'click', // 'click' | 'hover'
  showNavigation: true,
  onSideClick: (side, ctx) => {
    if (!clickLogEl) return;
    const stageName = ctx.isBronzeMatch
      ? '3位決定戦'
      : (ctx.round?.name ?? `Round ${ctx.roundIndex + 1}`);
    const name = getContestantTitle(side.contestantId ?? side.title);
    clickLogEl.textContent = `参加者選択: ${name} (${stageName} / order: ${ctx.order})`;
  },
  onMatchClick: (match, ctx) => {
    if (!clickLogEl) return;
    const stageName = ctx.isBronzeMatch
      ? '3位決定戦'
      : (ctx.round?.name ?? `Round ${ctx.roundIndex + 1}`);
    const teamA = getContestantTitle(match.sides?.[0]?.contestantId ?? match.sides?.[0]?.title);
    const teamB = getContestantTitle(match.sides?.[1]?.contestantId ?? match.sides?.[1]?.title);
    clickLogEl.textContent = `[${stageName}] ${teamA} vs ${teamB}`;
  },
});

// 規模（8 / 16 / 20 / 32 / 64チーム）の切り替え
sizeSelect?.addEventListener('change', () => {
  const size = Number(sizeSelect.value);
  currentData = size === 8 ? createInitialData() : createLargeSampleData(size);
  liveStep = 0;

  bracket.highlightContestantHistory(null);
  bracket.setBaseRoundIndex(0);
  bracket.replaceData(currentData);
});

// 参加者名部分一致で検索してフォーカス＆ハイライトする
const runTeamSearch = (): void => {
  const query = teamSearchInput?.value.trim();
  if (!query) {
    bracket.highlightContestantHistory(null);
    return;
  }

  let matchedId: string | null = null;
  const contestants = currentData.contestants ?? {};
  for (const [id, contestant] of Object.entries(contestants)) {
    if (contestant.players.some((p) => p.title.includes(query))) {
      matchedId = id;
      break;
    }
  }

  if (matchedId) {
    bracket.focusContestant(matchedId);
    if (clickLogEl) {
      clickLogEl.textContent = `チーム検索ヒット: "${getContestantTitle(matchedId)}" → フォーカスしました`;
    }
  } else if (clickLogEl) {
    clickLogEl.textContent = `チーム検索: "${query}" に一致するチームが見つかりません`;
  }
};

teamSearchBtn?.addEventListener('click', runTeamSearch);
teamSearchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    runTeamSearch();
  }
});

visibleRoundsSelect?.addEventListener('change', () => {
  const val = visibleRoundsSelect.value;
  bracket.applyNewOptions({
    visibleRoundsCount: val === 'all' ? undefined : val === 'auto' ? 'auto' : Number(val),
  });
});

// 特定試合のみを部分更新する applyMatchesUpdates のデモ
liveUpdateBtn?.addEventListener('click', () => {
  const finalRoundIndex = currentData.rounds.length - 1;
  const finalMatch = (currentData.matches ?? []).find(
    (m) => !m.isBronzeMatch && m.roundIndex === finalRoundIndex && m.order === 0,
  );
  if (!finalMatch) return;

  const sideA = finalMatch.sides?.[0];
  const sideB = finalMatch.sides?.[1];
  if (!sideA || !sideB) return;

  liveStep = (liveStep + 1) % 3;

  if (liveStep === 1) {
    bracket.applyMatchesUpdates([
      {
        roundIndex: finalRoundIndex,
        order: 0,
        isLive: true,
        sides: [
          {
            ...sideA,
            scores: [{ mainScore: 6, isWinner: true }, { mainScore: 5 }],
            currentScore: '15',
            isWinner: false,
            isServing: false,
          },
          {
            ...sideB,
            scores: [{ mainScore: 4 }, { mainScore: 4 }],
            currentScore: '40',
            isWinner: false,
            isServing: true,
          },
        ],
      },
    ]);
  } else if (liveStep === 2) {
    bracket.applyMatchesUpdates([
      {
        roundIndex: finalRoundIndex,
        order: 0,
        isLive: false,
        matchStatus: '試合終了',
        sides: [
          {
            ...sideA,
            scores: [
              { mainScore: 6, isWinner: true },
              { mainScore: 6, isWinner: true },
            ],
            currentScore: undefined,
            isWinner: true,
            isServing: false,
          },
          {
            ...sideB,
            scores: [{ mainScore: 4 }, { mainScore: 4 }],
            currentScore: undefined,
            isWinner: false,
            isServing: false,
          },
        ],
      },
    ]);
  } else {
    bracket.applyMatchesUpdates([
      {
        roundIndex: finalRoundIndex,
        order: 0,
        isLive: true,
        matchStatus: undefined,
        sides: [
          {
            ...sideA,
            scores: [{ mainScore: 6, isWinner: true }, { mainScore: 4 }],
            currentScore: '30',
            isWinner: false,
            isServing: true,
          },
          {
            ...sideB,
            scores: [{ mainScore: 4 }, { mainScore: 4 }],
            currentScore: '15',
            isWinner: false,
            isServing: false,
          },
        ],
      },
    ]);
  }
});
