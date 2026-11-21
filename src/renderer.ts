import type {
  BracketData,
  BracketOptions,
  Contestant,
  CustomMarkupResult,
  Match,
  NavigationState,
  PlayerRenderContext,
  Score,
  Side,
  SideRenderContext,
} from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/**
 * イベント委譲・コネクタ描画で参照する試合メタ情報
 */
export interface MatchMeta {
  matchKey: string;
  match: Match;
  roundIndex: number;
  order: number;
  isBronzeMatch: boolean;
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
  /** 正規化済みのラウンド別試合リスト（未登録枠を自動補完済み） */
  normalizedRounds: Match[][];
  /** 3位決定戦（存在する場合） */
  bronzeMatch: Match | null;
  /** マッチキーから試合カードDOM要素へのマップ */
  matchElements: Map<string, HTMLElement>;
  /** マッチキーからデータ・位置情報へのマップ */
  matchMetaMap: Map<string, MatchMeta>;
}

/**
 * 試合の一意キーを解決する（id 指定があれば優先、なければ roundIndex/order から生成）
 */
export function getMatchKey(match: Match): string {
  if (match.id) {
    return match.id;
  }
  if (isBronze(match)) {
    return 'bronze';
  }
  return `r${match.roundIndex}-o${match.order}`;
}

/**
 * 3位決定戦かどうかを判定する
 */
export function isBronze(match: Match): boolean {
  return Boolean(match.isBronzeMatch);
}

/**
 * 参加者スロットの勝ち上がりパス識別キーを取得する（contestantId を優先し、なければ title）
 */
export function getContestantKey(side: Side | null | undefined): string | null {
  if (!side || side.isBye) {
    return null;
  }
  if (side.contestantId !== undefined && side.contestantId !== '') {
    return side.contestantId;
  }
  if (side.title !== undefined && side.title !== '') {
    return side.title;
  }
  return null;
}

/**
 * カスタムHTMLフックの戻り値（HTML文字列またはHTMLElement）を指定コンテナへ挿入する
 */
function appendCustomMarkup(target: HTMLElement, content: CustomMarkupResult): boolean {
  if (content === null || content === undefined) {
    return false;
  }
  if (typeof content === 'string') {
    const tpl = document.createElement('template');
    tpl.innerHTML = content;
    target.appendChild(tpl.content);
    return true;
  }
  target.appendChild(content);
  return true;
}

/**
 * ボタン要素にデフォルトラベルまたはカスタムHTMLを設定する
 */
export function setButtonContent(button: HTMLButtonElement, customHTML: string | undefined, fallbackText: string): void {
  if (customHTML !== undefined) {
    const tpl = document.createElement('template');
    tpl.innerHTML = customHTML;
    button.replaceChildren(tpl.content);
  } else {
    button.textContent = fallbackText;
  }
}

/**
 * BracketData のフラットな matches 配列を、ラウンド別2次元配列（未登録枠は自動補完）へ正規化する
 */
export function normalizeBracketMatches(data: BracketData): {
  normalizedRounds: Match[][];
  bronzeMatch: Match | null;
} {
  const totalRounds = data.rounds.length;
  const allMatches = data.matches ?? [];
  let bronzeMatch: Match | null = null;

  const byRound = new Map<number, Map<number, Match>>();
  const maxOrderByRound = new Map<number, number>();

  for (const match of allMatches) {
    if (isBronze(match)) {
      bronzeMatch = match;
      continue;
    }
    if (match.roundIndex < 0 || match.roundIndex >= totalRounds) {
      continue;
    }
    let orderMap = byRound.get(match.roundIndex);
    if (!orderMap) {
      orderMap = new Map<number, Match>();
      byRound.set(match.roundIndex, orderMap);
    }
    orderMap.set(match.order, match);

    const prevMax = maxOrderByRound.get(match.roundIndex) ?? -1;
    if (match.order > prevMax) {
      maxOrderByRound.set(match.roundIndex, match.order);
    }
  }

  const normalizedRounds: Match[][] = [];
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const standardCount = 2 ** (totalRounds - 1 - roundIndex);
    const actualCount = (maxOrderByRound.get(roundIndex) ?? -1) + 1;
    const matchCount = Math.max(standardCount, actualCount);
    const orderMap = byRound.get(roundIndex);

    const roundMatches: Match[] = [];
    for (let order = 0; order < matchCount; order++) {
      const existing = orderMap?.get(order);
      if (existing) {
        roundMatches.push(existing);
      } else {
        roundMatches.push({
          roundIndex,
          order,
          sides: [],
        });
      }
    }
    normalizedRounds.push(roundMatches);
  }

  return { normalizedRounds, bronzeMatch };
}

/**
 * Date または ISO 8601 文字列を見やすい "M/D HH:mm" 形式へデフォルト整形する
 */
function defaultFormatStartTime(startTime: string | Date): { text: string; dateTimeAttr?: string } {
  if (startTime instanceof Date) {
    if (Number.isNaN(startTime.getTime())) {
      return { text: '' };
    }
    const month = startTime.getMonth() + 1;
    const day = startTime.getDate();
    const hours = String(startTime.getHours()).padStart(2, '0');
    const minutes = String(startTime.getMinutes()).padStart(2, '0');
    return {
      text: `${month}/${day} ${hours}:${minutes}`,
      dateTimeAttr: startTime.toISOString(),
    };
  }

  if (ISO_DATETIME_RE.test(startTime)) {
    const parsed = new Date(startTime);
    if (!Number.isNaN(parsed.getTime())) {
      const month = parsed.getMonth() + 1;
      const day = parsed.getDate();
      const hours = String(parsed.getHours()).padStart(2, '0');
      const minutes = String(parsed.getMinutes()).padStart(2, '0');
      return {
        text: `${month}/${day} ${hours}:${minutes}`,
        dateTimeAttr: parsed.toISOString(),
      };
    }
  }

  return { text: startTime, dateTimeAttr: startTime };
}

/**
 * スコア領域（scores 配列 + currentScore、または getScoresHTML フック）を生成する
 */
function createScoresElement(
  side: Side,
  match: Match,
  options: BracketOptions,
): HTMLDivElement | null {
  if (typeof options.getScoresHTML === 'function') {
    const custom = options.getScoresHTML(side, match);
    if (custom !== null && custom !== undefined) {
      const wrap = document.createElement('div');
      wrap.className = 'ml-team-scores ml-team-scores--custom';
      appendCustomMarkup(wrap, custom);
      return wrap;
    }
  }

  const scores: Score[] | undefined = side.scores;
  const currentScore = side.currentScore;
  const hasScores = Array.isArray(scores) && scores.length > 0;
  const hasCurrent = currentScore !== undefined && currentScore !== '';

  if (!hasScores && !hasCurrent) {
    return null;
  }

  const scoresWrap = document.createElement('div');
  scoresWrap.className = 'ml-team-scores';
  if ((scores?.length ?? 0) > 1 || (hasScores && hasCurrent)) {
    scoresWrap.classList.add('ml-team-scores--multi');
  }

  if (hasScores) {
    for (const item of scores!) {
      const cell = document.createElement('span');
      cell.className = 'ml-team-score';
      if (item.isWinner) {
        cell.classList.add('ml-team-score--set-winner');
      }
      cell.appendChild(document.createTextNode(String(item.mainScore)));
      if (item.subscore !== undefined && item.subscore !== '') {
        const sup = document.createElement('sup');
        sup.className = 'ml-team-score-sub';
        sup.textContent = String(item.subscore);
        cell.appendChild(sup);
      }
      scoresWrap.appendChild(cell);
    }
  }

  if (hasCurrent) {
    const currentCell = document.createElement('span');
    currentCell.className = 'ml-team-score ml-team-score--current';
    currentCell.textContent = String(currentScore);
    scoresWrap.appendChild(currentCell);
  }

  return scoresWrap;
}

/**
 * 試合番号のデフォルト整形（数値なら "#12"、文字列ならそのまま）
 */
function defaultFormatMatchNumber(matchNumber: number | string): string {
  return typeof matchNumber === 'number' ? `#${matchNumber}` : matchNumber;
}

/**
 * 進出元プレースホルダー文字列（"#1の勝者" / "#5の敗者"）を解決する
 */
function resolveSourcePlaceholder(
  normalizedRounds: Match[][],
  matchNumberMap: Map<string, number | string>,
  match: Match,
  sideIndex: 0 | 1,
  isBronzeMatch: boolean,
  options: BracketOptions,
): string | null {
  if (options.showSourcePlaceholder === false) {
    return null;
  }

  let sourceMatch: Match | undefined;
  let isLoser = false;

  if (isBronzeMatch) {
    // 3位決定戦は準決勝（最終の1つ前ラウンド）の敗者同士
    const semiRound = normalizedRounds[normalizedRounds.length - 2];
    sourceMatch = semiRound?.[sideIndex];
    isLoser = true;
  } else if (match.roundIndex > 0) {
    // 通常試合は前ラウンドの order * 2 + sideIndex の勝者
    const prevRound = normalizedRounds[match.roundIndex - 1];
    sourceMatch = prevRound?.[match.order * 2 + sideIndex];
  }

  if (!sourceMatch) {
    return null;
  }

  const sourceNum = matchNumberMap.get(getMatchKey(sourceMatch));
  if (sourceNum === undefined) {
    return null;
  }

  if (isLoser) {
    if (typeof options.formatLoserPlaceholder === 'function') {
      return options.formatLoserPlaceholder(sourceNum, sourceMatch);
    }
    return `${defaultFormatMatchNumber(sourceNum)}の敗者`;
  }

  if (typeof options.formatWinnerPlaceholder === 'function') {
    return options.formatWinnerPlaceholder(sourceNum, sourceMatch);
  }
  return `${defaultFormatMatchNumber(sourceNum)}の勝者`;
}

/**
 * 単一の参加者スロット行（Side）のDOM要素を生成する
 */
function createSideRow(
  side: Side | null,
  contestants: Record<string, Contestant> | undefined,
  match: Match,
  sideIndex: 0 | 1,
  isBronzeMatch: boolean,
  options: BracketOptions,
  tbdLabel: string,
  byeLabel: string,
  sourcePlaceholder: string | null,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'ml-team';
  row.dataset.sideIndex = String(sideIndex);

  const contestant =
    side?.contestantId && contestants ? (contestants[side.contestantId] ?? null) : null;
  const contestantKey = getContestantKey(side);

  if (contestantKey) {
    row.dataset.contestantKey = contestantKey;
  }

  const hasName = Boolean(
    (contestant && contestant.players.length > 0) || (side?.title && side.title !== ''),
  );

  if (!side) {
    row.classList.add('ml-team--tbd');
  } else {
    if (side.isWinner) {
      row.classList.add('ml-team--winner');
    }
    if (side.isBye) {
      row.classList.add('ml-team--bye');
    }
    if (!side.isBye && !hasName) {
      row.classList.add('ml-team--tbd');
    }
  }

  const highlightEnabled =
    options.disableHighlight !== true && options.highlightContestantHistory !== false;
  if (
    contestantKey &&
    (highlightEnabled ||
      typeof options.onSideClick === 'function' ||
      typeof options.onMatchSideClick === 'function')
  ) {
    row.classList.add('ml-team--interactive');
  }

  const sideCtx: SideRenderContext = {
    match,
    contestant,
    roundIndex: match.roundIndex,
    order: match.order,
    sideIndex,
    isBronzeMatch,
  };

  // カスタムレンダラー（renderSide）が指定されていれば優先使用する
  if (typeof options.renderSide === 'function') {
    const custom = options.renderSide(side, sideCtx);
    if (custom !== null && custom !== undefined) {
      const wrap = document.createElement('div');
      wrap.className = 'ml-team-custom';
      appendCustomMarkup(wrap, custom);
      row.appendChild(wrap);
      return row;
    }
  }

  // シード番号・エントリーステータス（contestant.entryStatus + getEntryStatusHTML）
  if (contestant?.entryStatus) {
    const seedEl = document.createElement('span');
    seedEl.className = 'ml-team-seed';
    const customEntry =
      typeof options.getEntryStatusHTML === 'function'
        ? options.getEntryStatusHTML(contestant.entryStatus, sideCtx)
        : null;
    if (!appendCustomMarkup(seedEl, customEntry)) {
      seedEl.textContent = contestant.entryStatus;
    }
    row.appendChild(seedEl);
  }

  // 参加者名エリア（シングルス/チーム戦は1行、ダブルスは縦並び複数行に対応）
  const playersWrap = document.createElement('div');
  playersWrap.className = 'ml-players';

  if (side?.isBye) {
    const byeEl = document.createElement('span');
    byeEl.className = 'ml-team-name';
    byeEl.textContent = side.title || byeLabel;
    playersWrap.appendChild(byeEl);
  } else if (contestant && contestant.players.length > 0) {
    contestant.players.forEach((player, playerIndex) => {
      const playerCtx: PlayerRenderContext = {
        ...sideCtx,
        playerIndex,
        contestantId: side?.contestantId,
      };
      const playerLine = document.createElement('div');
      playerLine.className = 'ml-player';

      // 国籍・国旗（getNationalityHTML フック優先）
      const customNat =
        typeof options.getNationalityHTML === 'function'
          ? options.getNationalityHTML(player, playerCtx)
          : null;
      if (customNat !== null && customNat !== undefined) {
        const natEl = document.createElement('span');
        natEl.className = 'ml-team-flag';
        appendCustomMarkup(natEl, customNat);
        playerLine.appendChild(natEl);
      } else if (player.nationality) {
        const natEl = document.createElement('span');
        natEl.className = 'ml-team-flag';
        natEl.textContent = player.nationality;
        playerLine.appendChild(natEl);
      }

      // 選手名（getPlayerTitleHTML フック優先）
      const nameEl = document.createElement('span');
      nameEl.className = 'ml-team-name';
      const customTitle =
        typeof options.getPlayerTitleHTML === 'function'
          ? options.getPlayerTitleHTML(player, playerCtx)
          : null;
      if (!appendCustomMarkup(nameEl, customTitle)) {
        nameEl.textContent = player.title;
        nameEl.title = player.title;
      }
      playerLine.appendChild(nameEl);

      playersWrap.appendChild(playerLine);
    });
  } else {
    const nameEl = document.createElement('span');
    nameEl.className = 'ml-team-name';
    const text = side?.title || sourcePlaceholder || tbdLabel;
    nameEl.textContent = text;
    nameEl.title = text;
    playersWrap.appendChild(nameEl);
  }

  row.appendChild(playersWrap);

  // サーブ権などのアクティブドット
  if (side?.isServing) {
    const serveEl = document.createElement('span');
    serveEl.className = 'ml-team-serving';
    serveEl.setAttribute('aria-label', 'サーブ中');
    row.appendChild(serveEl);
  }

  // スコア（scores + currentScore / getScoresHTML）
  if (side) {
    const scoresEl = createScoresElement(side, match, options);
    if (scoresEl) {
      row.appendChild(scoresEl);
    }
  }

  return row;
}

/**
 * 試合カード上部のヘッダー行（試合番号・会場・ラベル・開始時間・LIVEバッジ・カスタムヘッダー）を生成する
 */
function createMatchHeader(
  match: Match,
  resolvedMatchNumber: number | string | undefined,
  isBronzeMatch: boolean,
  options: BracketOptions,
): HTMLDivElement | null {
  if (typeof options.renderMatchHeader === 'function') {
    const custom = options.renderMatchHeader(match, {
      roundIndex: match.roundIndex,
      order: match.order,
      isBronzeMatch,
    });
    if (custom !== null && custom !== undefined) {
      const headerEl = document.createElement('div');
      headerEl.className = 'ml-match-header';
      appendCustomMarkup(headerEl, custom);
      return headerEl;
    }
  }

  const isLive = Boolean(match.isLive);
  const showMatchNumber =
    options.showMatchNumber !== false &&
    resolvedMatchNumber !== undefined &&
    resolvedMatchNumber !== '';
  const showStartTime =
    options.showStartTime !== false && match.startTime !== undefined && match.startTime !== '';
  const showVenue =
    options.showVenue !== false &&
    match.venue !== undefined &&
    (typeof match.venue === 'string' ? match.venue !== '' : match.venue.name !== '');
  const hasLeftInfo = Boolean(showMatchNumber || match.label || showVenue);

  if (!isLive && !hasLeftInfo && !showStartTime) {
    return null;
  }

  const headerEl = document.createElement('div');
  headerEl.className = 'ml-match-header';

  // 左側: 通し試合番号 / 会場・コート名 / ラベル
  const leftEl = document.createElement('div');
  leftEl.className = 'ml-match-header-left';

  if (showMatchNumber && resolvedMatchNumber !== undefined) {
    const numEl = document.createElement('span');
    numEl.className = 'ml-match-number';
    numEl.textContent =
      typeof options.formatMatchNumber === 'function'
        ? options.formatMatchNumber(resolvedMatchNumber, match)
        : defaultFormatMatchNumber(resolvedMatchNumber);
    leftEl.appendChild(numEl);
  }

  if (showVenue && match.venue !== undefined) {
    const venueText =
      typeof options.formatVenue === 'function'
        ? options.formatVenue(match.venue, match)
        : typeof match.venue === 'string'
          ? match.venue
          : match.venue.name;

    if (venueText) {
      const venueEl = document.createElement('span');
      venueEl.className = 'ml-match-venue';
      venueEl.dataset.venue =
        typeof match.venue === 'string' ? match.venue : (match.venue.id ?? match.venue.name);

      if (typeof match.venue !== 'string' && match.venue.color) {
        const dot = document.createElement('span');
        dot.className = 'ml-match-venue-dot';
        dot.style.backgroundColor = match.venue.color;
        dot.setAttribute('aria-hidden', 'true');
        venueEl.appendChild(dot);
      }

      venueEl.appendChild(document.createTextNode(venueText));
      leftEl.appendChild(venueEl);
    }
  }

  if (match.label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'ml-match-label';
    labelEl.textContent = match.label;
    leftEl.appendChild(labelEl);
  }

  if (leftEl.childNodes.length > 0) {
    headerEl.appendChild(leftEl);
  }

  // 右側: 試合開始時間 / LIVEバッジ
  const rightEl = document.createElement('div');
  rightEl.className = 'ml-match-header-right';

  if (showStartTime && match.startTime !== undefined) {
    const formatted =
      typeof options.formatStartTime === 'function'
        ? {
            text: options.formatStartTime(match.startTime, match),
            dateTimeAttr:
              match.startTime instanceof Date ? match.startTime.toISOString() : match.startTime,
          }
        : defaultFormatStartTime(match.startTime);

    if (formatted.text) {
      const timeEl = document.createElement('time');
      timeEl.className = 'ml-match-time';
      if (formatted.dateTimeAttr) {
        timeEl.dateTime = formatted.dateTimeAttr;
      }
      timeEl.textContent = formatted.text;
      rightEl.appendChild(timeEl);
    }
  }

  if (isLive) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'ml-live-badge';

    const dotEl = document.createElement('span');
    dotEl.className = 'ml-live-dot';
    dotEl.setAttribute('aria-hidden', 'true');
    badgeEl.appendChild(dotEl);

    badgeEl.appendChild(document.createTextNode(match.liveLabel ?? 'LIVE'));
    rightEl.appendChild(badgeEl);
  }

  if (rightEl.childNodes.length > 0) {
    headerEl.appendChild(rightEl);
  }

  return headerEl.childNodes.length > 0 ? headerEl : null;
}

/**
 * 1試合分のカードDOM要素（および上下の getMatchTopHTML / getMatchBottomHTML）を生成する
 */
function createMatchCard(
  match: Match,
  matchKey: string,
  resolvedMatchNumber: number | string | undefined,
  normalizedRounds: Match[][],
  matchNumberMap: Map<string, number | string>,
  contestants: Record<string, Contestant> | undefined,
  isBronzeMatch: boolean,
  options: BracketOptions,
  tbdLabel: string,
  byeLabel: string,
): { outerEl: HTMLElement; cardEl: HTMLElement } {
  const outerEl = document.createElement('div');
  outerEl.className = 'ml-match-slot';

  // getMatchTopHTML（カード直上）
  if (typeof options.getMatchTopHTML === 'function') {
    const topContent = options.getMatchTopHTML(match);
    if (topContent !== null && topContent !== undefined) {
      const topEl = document.createElement('div');
      topEl.className = 'ml-match-top';
      appendCustomMarkup(topEl, topContent);
      outerEl.appendChild(topEl);
    }
  }

  // getMatchElement（カード要素そのものの完全差し替え）
  if (typeof options.getMatchElement === 'function') {
    const customCard = options.getMatchElement(match.roundIndex, match.order);
    if (customCard instanceof HTMLElement) {
      customCard.classList.add('ml-match');
      customCard.dataset.matchKey = matchKey;
      customCard.dataset.roundIndex = String(match.roundIndex);
      customCard.dataset.order = String(match.order);
      outerEl.appendChild(customCard);

      if (typeof options.getMatchBottomHTML === 'function') {
        const bottomContent = options.getMatchBottomHTML(match);
        if (bottomContent !== null && bottomContent !== undefined) {
          const bottomEl = document.createElement('div');
          bottomEl.className = 'ml-match-bottom';
          appendCustomMarkup(bottomEl, bottomContent);
          outerEl.appendChild(bottomEl);
        }
      }
      return { outerEl, cardEl: customCard };
    }
  }

  const card = document.createElement('div');
  card.className = 'ml-match';
  card.dataset.matchKey = matchKey;
  card.dataset.roundIndex = String(match.roundIndex);
  card.dataset.order = String(match.order);

  if (isBronzeMatch) {
    card.classList.add('ml-match--third-place');
  }
  if (match.isLive) {
    card.classList.add('ml-match--live');
  }

  if (typeof options.onMatchClick === 'function') {
    card.classList.add('ml-match--clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
  }

  // 試合ヘッダー（試合番号・会場・ラベル・開始時間・LIVEバッジ）
  const headerEl = createMatchHeader(match, resolvedMatchNumber, isBronzeMatch, options);
  if (headerEl) {
    card.appendChild(headerEl);
  }

  // 参加者スロット（2行）
  const bodyEl = document.createElement('div');
  bodyEl.className = 'ml-match-body';
  const topSide = match.sides?.[0] ?? null;
  const bottomSide = match.sides?.[1] ?? null;

  const topPlaceholder = resolveSourcePlaceholder(
    normalizedRounds,
    matchNumberMap,
    match,
    0,
    isBronzeMatch,
    options,
  );
  const bottomPlaceholder = resolveSourcePlaceholder(
    normalizedRounds,
    matchNumberMap,
    match,
    1,
    isBronzeMatch,
    options,
  );

  bodyEl.appendChild(
    createSideRow(
      topSide,
      contestants,
      match,
      0,
      isBronzeMatch,
      options,
      tbdLabel,
      byeLabel,
      topPlaceholder,
    ),
  );
  bodyEl.appendChild(
    createSideRow(
      bottomSide,
      contestants,
      match,
      1,
      isBronzeMatch,
      options,
      tbdLabel,
      byeLabel,
      bottomPlaceholder,
    ),
  );
  card.appendChild(bodyEl);

  // matchStatus（指定がある場合のみフッターとして控えめに表示）
  if (match.matchStatus) {
    const statusEl = document.createElement('div');
    statusEl.className = 'ml-match-status';
    statusEl.textContent = match.matchStatus;
    card.appendChild(statusEl);
  }

  outerEl.appendChild(card);

  // getMatchBottomHTML（カード直下）
  if (typeof options.getMatchBottomHTML === 'function') {
    const bottomContent = options.getMatchBottomHTML(match);
    if (bottomContent !== null && bottomContent !== undefined) {
      const bottomEl = document.createElement('div');
      bottomEl.className = 'ml-match-bottom';
      appendCustomMarkup(bottomEl, bottomContent);
      outerEl.appendChild(bottomEl);
    }
  }

  return { outerEl, cardEl: card };
}

/**
 * 上段ラウンドナビゲーションバーを描画・更新する
 */
export function renderNavigationBar(
  navEl: HTMLElement,
  data: BracketData,
  navState: NavigationState,
  options: BracketOptions,
): void {
  navEl.replaceChildren();

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'ml-nav-btn ml-nav-btn--prev';
  prevBtn.dataset.navAction = 'prev';
  prevBtn.disabled = !navState.canGoPrevious;
  prevBtn.setAttribute('aria-label', '前のラウンドへ');
  setButtonContent(prevBtn, options.leftNavButtonHTML, '‹');

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
  setButtonContent(nextBtn, options.rightNavButtonHTML, '›');

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
  restrictVisibleRounds: boolean,
): RenderResult {
  const tbdLabel = options.tbdLabel ?? 'TBD';
  const byeLabel = options.byeLabel ?? 'BYE';
  const showRoundHeaders = options.showRoundHeaders ?? true;
  const useClassicalLayout = Boolean(options.useClassicalLayout);

  rootEl.replaceChildren();

  const { normalizedRounds, bronzeMatch } = normalizeBracketMatches(data);

  // 全試合の通し試合番号マップを構築（match.matchNumber 優先、autoMatchNumbers: true 時は自動採番）
  const matchNumberMap = new Map<string, number | string>();
  let autoSeq = 1;
  for (const roundMatches of normalizedRounds) {
    for (const m of roundMatches) {
      const key = getMatchKey(m);
      if (m.matchNumber !== undefined) {
        matchNumberMap.set(key, m.matchNumber);
      } else if (options.autoMatchNumbers) {
        matchNumberMap.set(key, autoSeq);
      }
      autoSeq++;
    }
  }
  if (bronzeMatch) {
    const bKey = getMatchKey(bronzeMatch);
    if (bronzeMatch.matchNumber !== undefined) {
      matchNumberMap.set(bKey, bronzeMatch.matchNumber);
    } else if (options.autoMatchNumbers) {
      matchNumberMap.set(bKey, autoSeq);
    }
  }

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
      // useClassicalLayout: true の場合は縦高さを維持しつつ横幅だけ畳む
      roundEl.classList.add(
        useClassicalLayout ? 'ml-round--classical-hidden' : 'ml-round--hidden',
      );
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

    const roundMatches = normalizedRounds[roundIndex] ?? [];
    roundMatches.forEach((match) => {
      const matchKey = getMatchKey(match);
      const wrapperEl = document.createElement('div');
      wrapperEl.className = 'ml-match-wrapper';

      const { outerEl, cardEl } = createMatchCard(
        match,
        matchKey,
        matchNumberMap.get(matchKey),
        normalizedRounds,
        matchNumberMap,
        data.contestants,
        false,
        options,
        tbdLabel,
        byeLabel,
      );

      wrapperEl.appendChild(outerEl);
      matchesEl.appendChild(wrapperEl);

      matchElements.set(matchKey, cardEl);
      matchMetaMap.set(matchKey, {
        matchKey,
        match,
        roundIndex: match.roundIndex,
        order: match.order,
        isBronzeMatch: false,
      });
    });

    roundEl.appendChild(matchesEl);

    // 最終ラウンドの下に3位決定戦（isBronzeMatch）を配置する
    const isLastRound = roundIndex === data.rounds.length - 1;
    if (isLastRound && bronzeMatch) {
      const bronzeKey = getMatchKey(bronzeMatch);
      const thirdPlaceWrap = document.createElement('div');
      thirdPlaceWrap.className = 'ml-third-place';

      const thirdTitle = document.createElement('div');
      thirdTitle.className = 'ml-third-place-header';
      thirdTitle.textContent =
        typeof bronzeMatch.isBronzeMatch === 'string' && bronzeMatch.isBronzeMatch !== 'true'
          ? bronzeMatch.isBronzeMatch
          : (options.bronzeMatchTitle ?? '3位決定戦');
      thirdPlaceWrap.appendChild(thirdTitle);

      const { outerEl, cardEl } = createMatchCard(
        bronzeMatch,
        bronzeKey,
        matchNumberMap.get(bronzeKey),
        normalizedRounds,
        matchNumberMap,
        data.contestants,
        true,
        options,
        tbdLabel,
        byeLabel,
      );
      thirdPlaceWrap.appendChild(outerEl);
      roundEl.appendChild(thirdPlaceWrap);

      matchElements.set(bronzeKey, cardEl);
      matchMetaMap.set(bronzeKey, {
        matchKey: bronzeKey,
        match: bronzeMatch,
        roundIndex: bronzeMatch.roundIndex,
        order: bronzeMatch.order,
        isBronzeMatch: true,
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
    normalizedRounds,
    bronzeMatch,
    matchElements,
    matchMetaMap,
  };
}
