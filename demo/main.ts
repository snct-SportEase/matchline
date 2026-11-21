import '../src/style.css';
import './style.css';
import { createBracket, type BracketData, type ConnectorType } from '../src/index';

/**
 * 8チーム・シングルエリミネーションのダミーデータを作成する
 * @param finalCompleted 決勝が完了済みかどうか
 */
function createSampleData(finalCompleted: boolean): BracketData {
  return {
    rounds: [
      {
        id: 'qf',
        name: '準々決勝',
        matches: [
          {
            id: 'm1',
            status: 'completed',
            teams: [
              { id: 't1', seed: 1, name: '東京サンダーズ', score: 3, isWinner: true },
              { id: 't8', seed: 8, name: '札幌ノースウィンド', score: 1 },
            ],
          },
          {
            id: 'm2',
            status: 'completed',
            teams: [
              { id: 't4', seed: 4, name: '名古屋ブレイズ', score: 1 },
              { id: 't5', seed: 5, name: '大阪スターズFC（長いチーム名の省略確認）', score: 2, isWinner: true },
            ],
          },
          {
            id: 'm3',
            status: 'completed',
            teams: [
              { id: 't2', seed: 2, name: '福岡ウェーブス', score: 4, isWinner: true },
              { id: 't7', seed: 7, name: '仙台フォレスト', score: 0 },
            ],
          },
          {
            id: 'm4',
            status: 'completed',
            teams: [
              { id: 't3', seed: 3, name: '横浜ベイサイド', score: 2, isWinner: true },
              { id: 't6', seed: 6, name: '広島フェニックス', score: 1 },
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
            status: 'completed',
            teams: [
              { id: 't1', seed: 1, name: '東京サンダーズ', score: 2, isWinner: true },
              { id: 't5', seed: 5, name: '大阪スターズFC（長いチーム名の省略確認）', score: 0 },
            ],
          },
          {
            id: 'm6',
            status: 'completed',
            teams: [
              { id: 't2', seed: 2, name: '福岡ウェーブス', score: 1 },
              { id: 't3', seed: 3, name: '横浜ベイサイド', score: 3, isWinner: true },
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
            status: finalCompleted ? 'completed' : 'scheduled',
            teams: [
              {
                id: 't1',
                seed: 1,
                name: '東京サンダーズ',
                score: finalCompleted ? 2 : null,
                isWinner: finalCompleted,
              },
              {
                id: 't3',
                seed: 3,
                name: '横浜ベイサイド',
                score: finalCompleted ? 1 : null,
                isWinner: false,
              },
            ],
          },
        ],
      },
    ],
  };
}

const container = document.getElementById('bracket-root');
const stageEl = document.getElementById('bracket-stage');
const clickLogEl = document.getElementById('click-log');
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
const connectorSelect = document.getElementById('connector-select') as HTMLSelectElement | null;
const toggleFinalBtn = document.getElementById('toggle-final-btn') as HTMLButtonElement | null;

if (!container) {
  throw new Error('#bracket-root が見つかりません');
}

let isFinalCompleted = false;
let currentConnectorType: ConnectorType = 'orthogonal';

const bracket = createBracket(container, createSampleData(isFinalCompleted), {
  connectorType: currentConnectorType,
  onMatchClick: (match, ctx) => {
    if (!clickLogEl) return;
    const teamA = match.teams[0]?.name ?? 'TBD';
    const teamB = match.teams[1]?.name ?? 'TBD';
    const scoreA = match.teams[0]?.score ?? '-';
    const scoreB = match.teams[1]?.score ?? '-';
    clickLogEl.textContent = `[${ctx.round.name ?? `Round ${ctx.roundIndex + 1}`}] 試合ID: ${match.id} | ${teamA} (${scoreA}) vs (${scoreB}) ${teamB}`;
  },
});

themeSelect?.addEventListener('change', () => {
  if (!stageEl) return;
  stageEl.dataset.theme = themeSelect.value;
});

connectorSelect?.addEventListener('change', () => {
  currentConnectorType = connectorSelect.value as ConnectorType;
  bracket.update(createSampleData(isFinalCompleted), {
    connectorType: currentConnectorType,
  });
});

toggleFinalBtn?.addEventListener('click', () => {
  isFinalCompleted = !isFinalCompleted;
  bracket.update(createSampleData(isFinalCompleted), {
    connectorType: currentConnectorType,
  });
});
