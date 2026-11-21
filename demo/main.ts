import '../src/style.css';
import './style.css';
import {
  createBracket,
  generateBracketData,
  type BracketData,
  type ConnectorType,
  type HighlightTrigger,
  type MatchTeam,
  type MatchVenue,
} from '../src/index';

/**
 * 大規模トーナメント（16 / 20 / 32 / 64チーム）のダミーデータを生成し、
 * 決勝直前まで試合進行した状態を作成する
 */
function createLargeSampleData(teamCount: number): BracketData {
  const prefectures = [
    '東京', '大阪', '愛知', '福岡', '北海道', '神奈川', '広島', '宮城',
    '埼玉', '千葉', '兵庫', '静岡', '京都', '新潟', '長野', '熊本',
  ];
  const suffixes = ['サンダーズ', 'ブレイズ', 'ウェーブス', 'スターズ', 'フォレスト', 'フェニックス', 'イーグルス', 'ライオンズ'];

  const teams: MatchTeam[] = Array.from({ length: teamCount }, (_, i) => {
    const pref = prefectures[i % prefectures.length];
    const suf = suffixes[Math.floor(i / prefectures.length) % suffixes.length];
    return {
      id: `team-${i + 1}`,
      seed: i + 1,
      name: `${pref}${suf} #${i + 1}`,
    };
  });

  const venues: MatchVenue[] = [
    { id: 'c1', name: '第1コート', color: '#2563eb' },
    { id: 'c2', name: '第2コート', color: '#059669' },
    { id: 'c3', name: '第3コート', color: '#d97706' },
    { id: 'c4', name: '第4コート', color: '#7c3aed' },
  ];

  const data = generateBracketData(teams, {
    includeThirdPlace: true,
    thirdPlaceTitle: '3位決定戦',
    venues,
  });

  // 準決勝まで勝敗を自動進行させ、決勝を LIVE 状態にする
  const totalRounds = data.rounds.length;
  for (let r = 0; r < totalRounds; r++) {
    const round = data.rounds[r];
    const isFinal = r === totalRounds - 1;
    const baseHour = 9 + r * 2;

    round.matches.forEach((match, mIdx) => {
      const minutes = (mIdx % 4) * 15;
      match.startTime = `${String(baseHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      if (match.status === 'bye') {
        return;
      }

      const [tA, tB] = match.teams;
      if (!tA || !tB) {
        return;
      }

      if (isFinal) {
        match.venue = { id: 'center', name: 'センターコート', color: '#ef4444' };
        match.status = 'live';
        tA.score = [{ main: 6, isWinner: true }, 4];
        tA.isServing = true;
        tB.score = [4, 4];
        return;
      }

      // シード上位を少し勝ちやすくしつつ適度にアップセットを混ぜる
      const aWins = (r + mIdx) % 5 !== 2;
      match.status = 'completed';
      tA.isWinner = aWins;
      tB.isWinner = !aWins;
      tA.score = aWins ? [6, 6] : [4, 3];
      tB.score = aWins ? [4, 3] : [6, 6];

      const winner = aWins ? tA : tB;
      const nextRound = data.rounds[r + 1];
      if (nextRound) {
        const nextMatch = nextRound.matches[Math.floor(mIdx / 2)];
        nextMatch.teams[mIdx % 2] = {
          id: winner.id,
          seed: winner.seed,
          name: winner.name,
        };
      }

      // 準決勝の敗者を3位決定戦へ配置
      if (r === totalRounds - 2 && data.thirdPlaceMatch) {
        const loser = aWins ? tB : tA;
        data.thirdPlaceMatch.teams[mIdx] = {
          id: loser.id,
          seed: loser.seed,
          name: loser.name,
          score: mIdx === 0 ? [6, 6] : [4, 5],
          isWinner: mIdx === 0,
        };
        data.thirdPlaceMatch.status = 'completed';
        data.thirdPlaceMatch.startTime = `${String(baseHour + 1).padStart(2, '0')}:30`;
      }
    });
  }

  return data;
}

/**
 * 8チーム・シングルエリミネーション + 3位決定戦のサンプルデータ
 * （複数セットスコア・タイブレーク・LIVE試合・サーブ権表示を含む）
 */
function createInitialData(): BracketData {
  return {
    rounds: [
      {
        id: 'qf',
        name: '準々決勝',
        matches: [
          {
            id: 'm1',
            venue: '第1コート',
            startTime: '10:00',
            status: 'completed',
            teams: [
              {
                id: 't1',
                seed: 1,
                flag: '🇯🇵',
                name: '東京サンダーズ',
                score: [
                  { main: 6, isWinner: true },
                  { main: 7, sub: 5, isWinner: true },
                ],
                isWinner: true,
              },
              {
                id: 't8',
                seed: 8,
                flag: '🇯🇵',
                name: '札幌ノースウィンド',
                score: [4, { main: 6, sub: 3 }],
              },
            ],
          },
          {
            id: 'm2',
            venue: '第2コート',
            startTime: '10:00',
            status: 'completed',
            teams: [
              {
                id: 't4',
                seed: 4,
                flag: '🇯🇵',
                name: '名古屋ブレイズ',
                score: [{ main: 6, isWinner: true }, 3, 4],
              },
              {
                id: 't5',
                seed: 5,
                flag: '🇯🇵',
                name: '大阪スターズFC（長いチーム名の省略確認）',
                score: [
                  4,
                  { main: 6, isWinner: true },
                  { main: 6, isWinner: true },
                ],
                isWinner: true,
              },
            ],
          },
          {
            id: 'm3',
            venue: '第1コート',
            startTime: '11:30',
            status: 'completed',
            teams: [
              {
                id: 't2',
                seed: 2,
                flag: '🇯🇵',
                name: '福岡ウェーブス',
                score: [
                  { main: 6, isWinner: true },
                  { main: 6, isWinner: true },
                ],
                isWinner: true,
              },
              {
                id: 't7',
                seed: 7,
                flag: '🇯🇵',
                name: '仙台フォレスト',
                score: [2, 3],
              },
            ],
          },
          {
            id: 'm4',
            venue: '第2コート',
            startTime: '11:30',
            status: 'completed',
            teams: [
              {
                id: 't3',
                seed: 3,
                flag: '🇯🇵',
                name: '横浜ベイサイド',
                score: [
                  { main: 7, sub: 4, isWinner: true },
                  { main: 6, isWinner: true },
                ],
                isWinner: true,
              },
              {
                id: 't6',
                seed: 6,
                flag: '🇯🇵',
                name: '広島フェニックス',
                score: [{ main: 6, sub: 2 }, 4],
              },
            ],
          },
        ],
      },
      {
        id: 'sf',
        name: '準決勝',
        matches: [
          {
            id: 'm5',
            venue: 'センターコート',
            startTime: '2026-11-21T13:30:00+09:00',
            status: 'completed',
            teams: [
              {
                id: 't1',
                seed: 1,
                flag: '🇯🇵',
                name: '東京サンダーズ',
                score: [
                  { main: 6, isWinner: true },
                  { main: 6, isWinner: true },
                ],
                isWinner: true,
              },
              {
                id: 't5',
                seed: 5,
                flag: '🇯🇵',
                name: '大阪スターズFC（長いチーム名の省略確認）',
                score: [3, 4],
              },
            ],
          },
          {
            id: 'm6',
            venue: 'センターコート',
            startTime: '2026-11-21T15:00:00+09:00',
            status: 'completed',
            teams: [
              {
                id: 't2',
                seed: 2,
                flag: '🇯🇵',
                name: '福岡ウェーブス',
                score: [4, { main: 6, isWinner: true }, 5],
              },
              {
                id: 't3',
                seed: 3,
                flag: '🇯🇵',
                name: '横浜ベイサイド',
                score: [
                  { main: 6, isWinner: true },
                  3,
                  { main: 7, isWinner: true },
                ],
                isWinner: true,
              },
            ],
          },
        ],
      },
      {
        id: 'final',
        name: '決勝',
        matches: [
          {
            id: 'm7',
            venue: 'センターコート',
            label: '決勝戦',
            startTime: new Date('2026-11-21T17:00:00+09:00'),
            status: 'live',
            teams: [
              {
                id: 't1',
                seed: 1,
                flag: '🇯🇵',
                name: '東京サンダーズ',
                score: [{ main: 6, isWinner: true }, 4],
                isServing: true,
              },
              {
                id: 't3',
                seed: 3,
                flag: '🇯🇵',
                name: '横浜ベイサイド',
                score: [4, 4],
              },
            ],
          },
        ],
      },
    ],
    thirdPlaceTitle: '3位決定戦',
    thirdPlaceMatch: {
      id: 'm-3rd',
      venue: '第2コート',
      startTime: '16:00',
      status: 'completed',
      teams: [
        {
          id: 't5',
          seed: 5,
          flag: '🇯🇵',
          name: '大阪スターズFC（長いチーム名の省略確認）',
          score: [5, 4],
        },
        {
          id: 't2',
          seed: 2,
          flag: '🇯🇵',
          name: '福岡ウェーブス',
          score: [
            { main: 7, isWinner: true },
            { main: 6, isWinner: true },
          ],
          isWinner: true,
        },
      ],
    },
  };
}

const container = document.getElementById('bracket-root');
const stageEl = document.getElementById('bracket-stage');
const clickLogEl = document.getElementById('click-log');
const sizeSelect = document.getElementById('size-select') as HTMLSelectElement | null;
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
const connectorSelect = document.getElementById('connector-select') as HTMLSelectElement | null;
const highlightTriggerSelect = document.getElementById(
  'highlight-trigger-select',
) as HTMLSelectElement | null;
const visibleRoundsSelect = document.getElementById(
  'visible-rounds-select',
) as HTMLSelectElement | null;
const liveUpdateBtn = document.getElementById('live-update-btn') as HTMLButtonElement | null;
const selectedMatchLabelEl = document.getElementById('selected-match-label');
const venueInput = document.getElementById('venue-input') as HTMLInputElement | null;
const timeInput = document.getElementById('time-input') as HTMLInputElement | null;
const applyScheduleBtn = document.getElementById('apply-schedule-btn') as HTMLButtonElement | null;
const teamSearchInput = document.getElementById('team-search-input') as HTMLInputElement | null;
const teamSearchBtn = document.getElementById('team-search-btn') as HTMLButtonElement | null;

if (!container) {
  throw new Error('#bracket-root が見つかりません');
}

let currentData: BracketData = createInitialData();
let liveStep = 0;
let selectedMatchId = 'm7';

/**
 * 現在のブラケットデータから決勝戦のマッチIDを取得する
 */
function getFinalMatchId(bracketData: BracketData): string {
  const lastRound = bracketData.rounds[bracketData.rounds.length - 1];
  return lastRound?.matches[0]?.id ?? 'm7';
}

const bracket = createBracket(container, currentData, {
  connectorType: 'orthogonal',
  highlightTeamHistory: true,
  highlightTrigger: 'click',
  showNavigation: true,
  onTeamClick: (team, ctx) => {
    if (!clickLogEl) return;
    const stageName = ctx.isThirdPlace ? '3位決定戦' : (ctx.round?.name ?? `Round ${ctx.roundIndex + 1}`);
    clickLogEl.textContent = `チーム選択: ${team.name ?? 'TBD'} (${stageName} / 試合ID: ${ctx.match.id})`;
  },
  onMatchClick: (match, ctx) => {
    const stageName = ctx.isThirdPlace ? '3位決定戦' : (ctx.round?.name ?? `Round ${ctx.roundIndex + 1}`);
    selectedMatchId = match.id;
    if (selectedMatchLabelEl) {
      selectedMatchLabelEl.textContent = `対象: ${stageName} (${match.id})`;
    }
    if (venueInput) {
      venueInput.value =
        typeof match.venue === 'string' ? match.venue : (match.venue?.name ?? '');
    }
    if (timeInput) {
      timeInput.value =
        match.startTime instanceof Date
          ? `${String(match.startTime.getHours()).padStart(2, '0')}:${String(match.startTime.getMinutes()).padStart(2, '0')}`
          : (match.startTime ?? '');
    }

    if (!clickLogEl) return;
    const teamA = match.teams[0]?.name ?? 'TBD';
    const teamB = match.teams[1]?.name ?? 'TBD';
    clickLogEl.textContent = `[${stageName}] 試合ID: ${match.id} (${match.status ?? '-'}) | ${teamA} vs ${teamB}`;
  },
});

// 規模（8 / 16 / 20 / 32 / 64チーム）の切り替え
sizeSelect?.addEventListener('change', () => {
  const size = Number(sizeSelect.value);
  currentData = size === 8 ? createInitialData() : createLargeSampleData(size);
  selectedMatchId = getFinalMatchId(currentData);
  liveStep = 0;

  if (selectedMatchLabelEl) {
    selectedMatchLabelEl.textContent = `対象: 決勝 (${selectedMatchId})`;
  }

  bracket.highlightTeam(null);
  bracket.setBaseRoundIndex(0);
  bracket.update(currentData);
});

// 選択中の試合のコート名・開始時間を動的に反映する
applyScheduleBtn?.addEventListener('click', () => {
  const nextVenue = venueInput?.value.trim() ?? '';
  const nextTime = timeInput?.value.trim() ?? '';
  bracket.updateMatches([
    {
      id: selectedMatchId,
      venue: nextVenue || undefined,
      startTime: nextTime || undefined,
    },
  ]);
});

// チーム名部分一致で検索してフォーカス＆ハイライトする
const runTeamSearch = (): void => {
  const query = teamSearchInput?.value.trim();
  if (!query) {
    bracket.highlightTeam(null);
    return;
  }

  let matchedKey: string | null = null;
  for (const round of currentData.rounds) {
    for (const match of round.matches) {
      for (const team of match.teams) {
        if (team?.name && team.name.includes(query)) {
          matchedKey = team.id ?? team.name;
          break;
        }
      }
      if (matchedKey) break;
    }
    if (matchedKey) break;
  }

  if (matchedKey) {
    bracket.focusTeam(matchedKey);
    if (clickLogEl) {
      clickLogEl.textContent = `チーム検索ヒット: "${query}" → フォーカスしました`;
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

themeSelect?.addEventListener('change', () => {
  if (!stageEl) return;
  stageEl.dataset.theme = themeSelect.value;
});

connectorSelect?.addEventListener('change', () => {
  bracket.update(currentData, {
    connectorType: connectorSelect.value as ConnectorType,
  });
});

highlightTriggerSelect?.addEventListener('change', () => {
  bracket.highlightTeam(null);
  bracket.update(currentData, {
    highlightTrigger: highlightTriggerSelect.value as HighlightTrigger,
  });
});

visibleRoundsSelect?.addEventListener('change', () => {
  const val = visibleRoundsSelect.value;
  bracket.update(currentData, {
    visibleRoundsCount: val === 'all' ? undefined : Number(val),
  });
});

// 特定試合のみを部分更新する updateMatches のデモ
liveUpdateBtn?.addEventListener('click', () => {
  const finalId = getFinalMatchId(currentData);
  const lastRound = currentData.rounds[currentData.rounds.length - 1];
  const finalMatch = lastRound?.matches[0];
  if (!finalMatch) return;

  const [teamA, teamB] = finalMatch.teams;
  if (!teamA || !teamB) return;

  liveStep = (liveStep + 1) % 3;

  if (liveStep === 1) {
    bracket.updateMatches([
      {
        id: finalId,
        status: 'live',
        teams: [
          { ...teamA, score: [{ main: 6, isWinner: true }, 5], isWinner: false, isServing: false },
          { ...teamB, score: [4, 4], isWinner: false, isServing: true },
        ],
      },
    ]);
  } else if (liveStep === 2) {
    bracket.updateMatches([
      {
        id: finalId,
        status: 'completed',
        teams: [
          {
            ...teamA,
            score: [
              { main: 6, isWinner: true },
              { main: 6, isWinner: true },
            ],
            isWinner: true,
            isServing: false,
          },
          { ...teamB, score: [4, 4], isWinner: false, isServing: false },
        ],
      },
    ]);
  } else {
    bracket.updateMatches([
      {
        id: finalId,
        status: 'live',
        teams: [
          { ...teamA, score: [{ main: 6, isWinner: true }, 4], isWinner: false, isServing: true },
          { ...teamB, score: [4, 4], isWinner: false, isServing: false },
        ],
      },
    ]);
  }
});
