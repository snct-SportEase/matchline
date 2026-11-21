import type {
  BracketData,
  BracketOptions,
  Match,
  MatchScore,
  MatchTeam,
  NavigationState,
  SetScore,
} from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * イベント委譲で参照する試合メタ情報
 */
export interface MatchMeta {
  match: Match;
  roundIndex: number;
  matchIndex: number;
  isThirdPlace: boolean;
}

/**
 * DOMレンダリング結果の参照マップ
 */
export interface RenderResult {
  /** 接続線描画用のSVG要素 */
  svgElement: SVGSVGElement;
  /** ラウンド群を格納するDOM要素 */
  roundsElement: HTMLDivElement;
  /** ラウンドインデックスからラウンドDOM要素へのマップ */
  roundElements: Map<number, HTMLElement>;
  /** マッチIDから試合カードDOM要素へのマップ */
  matchElements: Map<string, HTMLElement>;
  /** マッチIDからデータ・インデックス情報へのマップ（イベント委譲用） */
  matchMetaMap: Map<string, MatchMeta>;
}

/**
 * チームの勝ち上がりパス識別用キーを取得する（id を優先し、なければ name を使用）
 */
export function getTeamKey(team: MatchTeam | null | undefined): string | null {
  if (!team || team.isBye) {
    return null;
  }
  if (team.id !== undefined && team.id !== '') {
    return team.id;
  }
  if (team.name !== undefined && team.name !== '') {
    return team.name;
  }
  return null;
}

/**
 * 値が SetScore オブジェクトかどうか判定する
 */
function isSetScoreObject(value: number | string | SetScore): value is SetScore {
  return typeof value === 'object' && value !== null && 'main' in value;
}

/**
 * スコア領域（単一スコアまたは複数セットスコア）を生成する
 */
function createScoreElement(score: MatchScore): HTMLDivElement {
  const scoresWrap = document.createElement('div');
  scoresWrap.className = 'ml-team-scores';

  if (Array.isArray(score)) {
    scoresWrap.classList.add('ml-team-scores--multi');
    for (const item of score) {
      const cell = document.createElement('span');
      cell.className = 'ml-team-score';

      if (isSetScoreObject(item)) {
        if (item.isWinner) {
          cell.classList.add('ml-team-score--set-winner');
        }
        cell.appendChild(document.createTextNode(String(item.main)));
        if (item.sub !== undefined && item.sub !== '') {
          const sup = document.createElement('sup');
          sup.className = 'ml-team-score-sub';
          sup.textContent = String(item.sub);
          cell.appendChild(sup);
        }
      } else {
        cell.textContent = String(item);
      }

      scoresWrap.appendChild(cell);
    }
  } else {
    const cell = document.createElement('span');
    cell.className = 'ml-team-score';
    cell.textContent = String(score);
    scoresWrap.appendChild(cell);
  }

  return scoresWrap;
}

/**
 * 単一チーム行（スロット）のDOM要素を生成する
 */
function createTeamRow(
  team: MatchTeam | null,
  match: Match,
  roundIndex: number,
  matchIndex: number,
  teamIndex: 0 | 1,
  isThirdPlace: boolean,
  options: BracketOptions,
  tbdLabel: string,
  byeLabel: string,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'ml-team';
  row.dataset.teamIndex = String(teamIndex);

  const teamKey = getTeamKey(team);
  if (teamKey) {
    row.dataset.teamKey = teamKey;
  }

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

  if (teamKey && (options.highlightTeamHistory !== false || typeof options.onTeamClick === 'function')) {
    row.classList.add('ml-team--interactive');
  }

  // カスタムレンダラーが指定されていれば優先使用する
  if (typeof options.renderTeam === 'function') {
    const custom = options.renderTeam(team, {
      match,
      roundIndex,
      matchIndex,
      teamIndex,
      isThirdPlace,
    });
    if (custom !== null) {
      if (typeof custom === 'string') {
        const span = document.createElement('span');
        span.className = 'ml-team-custom';
        span.textContent = custom;
        row.appendChild(span);
      } else {
        row.appendChild(custom);
      }
      return row;
    }
  }

  // シード番号
  if (team?.seed !== undefined) {
    const seedEl = document.createElement('span');
    seedEl.className = 'ml-team-seed';
    seedEl.textContent = String(team.seed);
    row.appendChild(seedEl);
  }

  // 国旗 / アイコンバッジ
  if (team?.flag) {
    const flagEl = document.createElement('span');
    flagEl.className = 'ml-team-flag';
    flagEl.textContent = team.flag;
    row.appendChild(flagEl);
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

  // サーブ権などのアクティブドット
  if (team?.isServing) {
    const serveEl = document.createElement('span');
    serveEl.className = 'ml-team-serving';
    serveEl.setAttribute('aria-label', 'サーブ中');
    row.appendChild(serveEl);
  }

  // スコア（null / undefined 以外の場合に表示）
  if (team && team.score !== undefined && team.score !== null) {
    row.appendChild(createScoreElement(team.score));
  }

  return row;
}

/**
 * 試合カード上部のヘッダー行（LIVEバッジ・ラベル・カスタムヘッダー）を生成する
 */
function createMatchHeader(
  match: Match,
  roundIndex: number,
  matchIndex: number,
  isThirdPlace: boolean,
  options: BracketOptions,
): HTMLDivElement | null {
  if (typeof options.renderMatchHeader === 'function') {
    const custom = options.renderMatchHeader(match, {
      roundIndex,
      matchIndex,
      isThirdPlace,
    });
    if (custom !== null) {
      const headerEl = document.createElement('div');
      headerEl.className = 'ml-match-header';
      if (typeof custom === 'string') {
        headerEl.textContent = custom;
      } else {
        headerEl.appendChild(custom);
      }
      return headerEl;
    }
  }

  const isLive = match.status === 'live';
  if (!isLive && !match.label) {
    return null;
  }

  const headerEl = document.createElement('div');
  headerEl.className = 'ml-match-header';

  if (match.label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'ml-match-label';
    labelEl.textContent = match.label;
    headerEl.appendChild(labelEl);
  }

  if (isLive) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'ml-live-badge';

    const dotEl = document.createElement('span');
    dotEl.className = 'ml-live-dot';
    dotEl.setAttribute('aria-hidden', 'true');
    badgeEl.appendChild(dotEl);

    badgeEl.appendChild(document.createTextNode(match.liveLabel ?? 'LIVE'));
    headerEl.appendChild(badgeEl);
  }

  return headerEl;
}

/**
 * 1試合分のカードDOM要素を生成する
 */
function createMatchCard(
  match: Match,
  roundIndex: number,
  matchIndex: number,
  isThirdPlace: boolean,
  options: BracketOptions,
  tbdLabel: string,
  byeLabel: string,
): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'ml-match';
  card.dataset.matchId = match.id;
  card.dataset.roundIndex = String(roundIndex);
  card.dataset.matchIndex = String(matchIndex);

  if (isThirdPlace) {
    card.classList.add('ml-match--third-place');
  }

  if (match.status) {
    card.classList.add(`ml-match--${match.status}`);
  }

  if (typeof options.onMatchClick === 'function') {
    card.classList.add('ml-match--clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
  }

  // 試合ヘッダー（LIVEバッジ・試合ラベル等）
  const headerEl = createMatchHeader(match, roundIndex, matchIndex, isThirdPlace, options);
  if (headerEl) {
    card.appendChild(headerEl);
  }

  // チームスロット
  const bodyEl = document.createElement('div');
  bodyEl.className = 'ml-match-body';
  const [topTeam, bottomTeam] = match.teams;
  bodyEl.appendChild(
    createTeamRow(topTeam, match, roundIndex, matchIndex, 0, isThirdPlace, options, tbdLabel, byeLabel),
  );
  bodyEl.appendChild(
    createTeamRow(bottomTeam, match, roundIndex, matchIndex, 1, isThirdPlace, options, tbdLabel, byeLabel),
  );
  card.appendChild(bodyEl);

  return card;
}

/**
 * ラウンドナビゲーションバーを描画・更新する
 */
export function renderNavigationBar(
  navEl: HTMLElement,
  data: BracketData,
  navState: NavigationState,
): void {
  navEl.replaceChildren();

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'ml-nav-btn ml-nav-btn--prev';
  prevBtn.dataset.navAction = 'prev';
  prevBtn.disabled = !navState.canGoPrevious;
  prevBtn.setAttribute('aria-label', '前のラウンドへ');
  prevBtn.textContent = '‹';

  const pillsEl = document.createElement('div');
  pillsEl.className = 'ml-nav-pills';

  const visibleEnd = Math.min(
    navState.baseRoundIndex + navState.visibleRoundsCount - 1,
    data.rounds.length - 1,
  );

  data.rounds.forEach((round, index) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'ml-nav-pill';
    pill.dataset.navRoundIndex = String(index);
    pill.textContent = round.name ?? `Round ${index + 1}`;

    if (index >= navState.baseRoundIndex && index <= visibleEnd) {
      pill.classList.add('ml-nav-pill--active');
    }
    if (index === navState.baseRoundIndex) {
      pill.setAttribute('aria-current', 'step');
    }

    pillsEl.appendChild(pill);
  });

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'ml-nav-btn ml-nav-btn--next';
  nextBtn.dataset.navAction = 'next';
  nextBtn.disabled = !navState.canGoNext;
  nextBtn.setAttribute('aria-label', '次のラウンドへ');
  nextBtn.textContent = '›';

  navEl.appendChild(prevBtn);
  navEl.appendChild(pillsEl);
  navEl.appendChild(nextBtn);
}

/**
 * ルート要素内にブラケット全体のDOM（SVGレイヤー + ラウンド・試合カード + 3位決定戦）を描画する
 */
export function renderBracketDOM(
  rootEl: HTMLElement,
  data: BracketData,
  options: BracketOptions,
  navState: NavigationState,
): RenderResult {
  const tbdLabel = options.tbdLabel ?? 'TBD';
  const byeLabel = options.byeLabel ?? 'BYE';
  const showRoundHeaders = options.showRoundHeaders ?? true;
  const restrictVisibleRounds =
    typeof options.visibleRoundsCount === 'number' && options.visibleRoundsCount > 0;

  rootEl.replaceChildren();

  // 背面SVGレイヤー（接続線用）
  const svgElement = document.createElementNS(SVG_NS, 'svg');
  svgElement.setAttribute('class', 'ml-connectors');
  svgElement.setAttribute('aria-hidden', 'true');
  rootEl.appendChild(svgElement);

  // ラウンド一覧コンテナ
  const roundsElement = document.createElement('div');
  roundsElement.className = 'ml-rounds';

  const roundElements = new Map<number, HTMLElement>();
  const matchElements = new Map<string, HTMLElement>();
  const matchMetaMap = new Map<string, MatchMeta>();

  const visibleStart = restrictVisibleRounds ? navState.baseRoundIndex : 0;
  const visibleEnd = restrictVisibleRounds
    ? navState.baseRoundIndex + navState.visibleRoundsCount - 1
    : data.rounds.length - 1;

  data.rounds.forEach((round, roundIndex) => {
    const isVisible = roundIndex >= visibleStart && roundIndex <= visibleEnd;

    const roundEl = document.createElement('section');
    roundEl.className = 'ml-round';
    roundEl.dataset.roundIndex = String(roundIndex);
    if (round.id) {
      roundEl.dataset.roundId = round.id;
    }
    if (!isVisible) {
      roundEl.classList.add('ml-round--hidden');
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

      const cardEl = createMatchCard(
        match,
        roundIndex,
        matchIndex,
        false,
        options,
        tbdLabel,
        byeLabel,
      );

      wrapperEl.appendChild(cardEl);
      matchesEl.appendChild(wrapperEl);

      matchElements.set(match.id, cardEl);
      matchMetaMap.set(match.id, { match, roundIndex, matchIndex, isThirdPlace: false });
    });

    roundEl.appendChild(matchesEl);

    // 最終ラウンドの下に3位決定戦を配置する（決勝の縦中央位置を崩さないよう独立ブロック化）
    const isLastRound = roundIndex === data.rounds.length - 1;
    if (isLastRound && data.thirdPlaceMatch) {
      const thirdPlaceWrap = document.createElement('div');
      thirdPlaceWrap.className = 'ml-third-place';

      const thirdTitle = document.createElement('div');
      thirdTitle.className = 'ml-third-place-header';
      thirdTitle.textContent = data.thirdPlaceTitle ?? '3位決定戦';
      thirdPlaceWrap.appendChild(thirdTitle);

      const thirdCard = createMatchCard(
        data.thirdPlaceMatch,
        -1,
        0,
        true,
        options,
        tbdLabel,
        byeLabel,
      );
      thirdPlaceWrap.appendChild(thirdCard);
      roundEl.appendChild(thirdPlaceWrap);

      matchElements.set(data.thirdPlaceMatch.id, thirdCard);
      matchMetaMap.set(data.thirdPlaceMatch.id, {
        match: data.thirdPlaceMatch,
        roundIndex: -1,
        matchIndex: 0,
        isThirdPlace: true,
      });
    }

    roundsElement.appendChild(roundEl);
    roundElements.set(roundIndex, roundEl);
  });

  rootEl.appendChild(roundsElement);

  return {
    svgElement,
    roundsElement,
    roundElements,
    matchElements,
    matchMetaMap,
  };
}
