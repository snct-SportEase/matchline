import type { BracketData, BracketOptions, Match, MatchTeam } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * DOMレンダリング結果の参照マップ
 */
export interface RenderResult {
  /** 接続線描画用のSVG要素 */
  svgElement: SVGSVGElement;
  /** ラウンド群を格納するDOM要素 */
  roundsElement: HTMLDivElement;
  /** マッチIDから試合カードDOM要素へのマップ */
  matchElements: Map<string, HTMLElement>;
  /** マッチIDからデータ・インデックス情報へのマップ（イベント委譲用） */
  matchMetaMap: Map<string, { match: Match; roundIndex: number; matchIndex: number }>;
}

/**
 * 単一チーム行（スロット）のDOM要素を生成する
 */
function createTeamRow(
  team: MatchTeam | null,
  tbdLabel: string,
  byeLabel: string,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'ml-team';

  if (!team) {
    row.classList.add('ml-team--tbd');
  } else {
    if (team.isWinner) {
      row.classList.add('ml-team--winner');
    }
    if (team.isBye) {
      row.classList.add('ml-team--bye');
    }
    if (!team.isBye && !team.name) {
      row.classList.add('ml-team--tbd');
    }
  }

  // シード番号（指定がある場合のみ表示）
  if (team?.seed !== undefined) {
    const seedEl = document.createElement('span');
    seedEl.className = 'ml-team-seed';
    seedEl.textContent = String(team.seed);
    row.appendChild(seedEl);
  }

  // チーム名
  const nameEl = document.createElement('span');
  nameEl.className = 'ml-team-name';
  let displayName = tbdLabel;
  if (team?.isBye) {
    displayName = team.name || byeLabel;
  } else if (team?.name) {
    displayName = team.name;
  }
  nameEl.textContent = displayName;
  nameEl.title = displayName;
  row.appendChild(nameEl);

  // スコア（null / undefined 以外の場合に表示）
  if (team && team.score !== undefined && team.score !== null) {
    const scoreEl = document.createElement('span');
    scoreEl.className = 'ml-team-score';
    scoreEl.textContent = String(team.score);
    row.appendChild(scoreEl);
  }

  return row;
}

/**
 * 1試合分のカードDOM要素を生成する
 */
function createMatchCard(
  match: Match,
  roundIndex: number,
  matchIndex: number,
  options: Required<Pick<BracketOptions, 'tbdLabel' | 'byeLabel'>> & {
    clickable: boolean;
  },
): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'ml-match';
  card.dataset.matchId = match.id;
  card.dataset.roundIndex = String(roundIndex);
  card.dataset.matchIndex = String(matchIndex);

  if (match.status) {
    card.classList.add(`ml-match--${match.status}`);
  }

  if (options.clickable) {
    card.classList.add('ml-match--clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
  }

  const [topTeam, bottomTeam] = match.teams;
  card.appendChild(createTeamRow(topTeam, options.tbdLabel, options.byeLabel));
  card.appendChild(createTeamRow(bottomTeam, options.tbdLabel, options.byeLabel));

  return card;
}

/**
 * ルート要素内にブラケット全体のDOM（SVGレイヤー + ラウンド・試合カード）を描画する
 */
export function renderBracketDOM(
  rootEl: HTMLElement,
  data: BracketData,
  options: BracketOptions,
): RenderResult {
  const tbdLabel = options.tbdLabel ?? 'TBD';
  const byeLabel = options.byeLabel ?? 'BYE';
  const showRoundHeaders = options.showRoundHeaders ?? true;
  const clickable = typeof options.onMatchClick === 'function';

  // 既存の子要素を安全にクリアする
  rootEl.replaceChildren();

  // 背面SVGレイヤー（接続線用）
  const svgElement = document.createElementNS(SVG_NS, 'svg');
  svgElement.setAttribute('class', 'ml-connectors');
  svgElement.setAttribute('aria-hidden', 'true');
  rootEl.appendChild(svgElement);

  // ラウンド一覧コンテナ
  const roundsElement = document.createElement('div');
  roundsElement.className = 'ml-rounds';

  const matchElements = new Map<string, HTMLElement>();
  const matchMetaMap = new Map<string, { match: Match; roundIndex: number; matchIndex: number }>();

  data.rounds.forEach((round, roundIndex) => {
    const roundEl = document.createElement('section');
    roundEl.className = 'ml-round';
    roundEl.dataset.roundIndex = String(roundIndex);
    if (round.id) {
      roundEl.dataset.roundId = round.id;
    }

    // ラウンドヘッダー
    if (showRoundHeaders) {
      const headerEl = document.createElement('div');
      headerEl.className = 'ml-round-header';
      headerEl.textContent = round.name ?? `Round ${roundIndex + 1}`;
      roundEl.appendChild(headerEl);
    }

    // 試合カード一覧
    const matchesEl = document.createElement('div');
    matchesEl.className = 'ml-matches';

    round.matches.forEach((match, matchIndex) => {
      const wrapperEl = document.createElement('div');
      wrapperEl.className = 'ml-match-wrapper';

      const cardEl = createMatchCard(match, roundIndex, matchIndex, {
        tbdLabel,
        byeLabel,
        clickable,
      });

      wrapperEl.appendChild(cardEl);
      matchesEl.appendChild(wrapperEl);

      matchElements.set(match.id, cardEl);
      matchMetaMap.set(match.id, { match, roundIndex, matchIndex });
    });

    roundEl.appendChild(matchesEl);
    roundsElement.appendChild(roundEl);
  });

  rootEl.appendChild(roundsElement);

  return {
    svgElement,
    roundsElement,
    matchElements,
    matchMetaMap,
  };
}
