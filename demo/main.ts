import '../src/style.css';
import './style.css';
import {
  createBracket,
  type BracketData,
  type ConnectorType,
  type HighlightTrigger,
} from '../src/index';

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
            label: 'Court 1 · 10:00',
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
            label: 'Court 2 · 10:00',
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
            label: 'Court 1 · 11:30',
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
            label: 'Court 2 · 11:30',
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
            label: 'Center Court · 13:30',
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
            label: 'Center Court · 15:00',
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
            label: 'Center Court · Final',
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
      label: 'Court 2 · 16:00',
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
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
const connectorSelect = document.getElementById('connector-select') as HTMLSelectElement | null;
const highlightTriggerSelect = document.getElementById(
  'highlight-trigger-select',
) as HTMLSelectElement | null;
const visibleRoundsSelect = document.getElementById(
  'visible-rounds-select',
) as HTMLSelectElement | null;
const liveUpdateBtn = document.getElementById('live-update-btn') as HTMLButtonElement | null;

if (!container) {
  throw new Error('#bracket-root が見つかりません');
}

const data = createInitialData();
let liveStep = 0;

const bracket = createBracket(container, data, {
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
    if (!clickLogEl) return;
    const stageName = ctx.isThirdPlace ? '3位決定戦' : (ctx.round?.name ?? `Round ${ctx.roundIndex + 1}`);
    const teamA = match.teams[0]?.name ?? 'TBD';
    const teamB = match.teams[1]?.name ?? 'TBD';
    clickLogEl.textContent = `[${stageName}] 試合ID: ${match.id} (${match.status ?? '-'}) | ${teamA} vs ${teamB}`;
  },
});

themeSelect?.addEventListener('change', () => {
  if (!stageEl) return;
  stageEl.dataset.theme = themeSelect.value;
});

connectorSelect?.addEventListener('change', () => {
  bracket.update(data, {
    connectorType: connectorSelect.value as ConnectorType,
  });
});

highlightTriggerSelect?.addEventListener('change', () => {
  bracket.highlightTeam(null);
  bracket.update(data, {
    highlightTrigger: highlightTriggerSelect.value as HighlightTrigger,
  });
});

visibleRoundsSelect?.addEventListener('change', () => {
  const val = visibleRoundsSelect.value;
  bracket.update(data, {
    visibleRoundsCount: val === 'all' ? undefined : Number(val),
  });
});

// 特定試合のみを部分更新する updateMatches のデモ
liveUpdateBtn?.addEventListener('click', () => {
  liveStep = (liveStep + 1) % 3;

  if (liveStep === 1) {
    bracket.updateMatches([
      {
        id: 'm7',
        status: 'live',
        teams: [
          {
            id: 't1',
            seed: 1,
            flag: '🇯🇵',
            name: '東京サンダーズ',
            score: [{ main: 6, isWinner: true }, 5],
            isServing: false,
          },
          {
            id: 't3',
            seed: 3,
            flag: '🇯🇵',
            name: '横浜ベイサイド',
            score: [4, 4],
            isServing: true,
          },
        ],
      },
    ]);
  } else if (liveStep === 2) {
    bracket.updateMatches([
      {
        id: 'm7',
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
            isServing: false,
          },
          {
            id: 't3',
            seed: 3,
            flag: '🇯🇵',
            name: '横浜ベイサイド',
            score: [4, 4],
            isWinner: false,
            isServing: false,
          },
        ],
      },
    ]);
  } else {
    bracket.updateMatches([
      {
        id: 'm7',
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
            isServing: false,
          },
        ],
      },
    ]);
  }
});
