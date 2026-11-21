import { drawConnectors } from './connectors';
import {
  getContestantKey,
  getMatchKey,
  isBronze,
  renderBracketDOM,
  renderNavigationBar,
  setButtonContent,
  type RenderResult,
} from './renderer';
import type {
  BracketData,
  BracketInstance,
  BracketOptions,
  Match,
  MatchUpdate,
  NavigationState,
} from './types';

/**
 * 既存の試合と部分更新パッチが同一試合を指しているか判定する
 */
function isSameMatch(match: Match, patch: MatchUpdate): boolean {
  if ('id' in patch && patch.id !== undefined && match.id !== undefined) {
    return match.id === patch.id;
  }
  if (patch.isBronzeMatch && isBronze(match)) {
    return true;
  }
  if (
    typeof patch.roundIndex === 'number' &&
    typeof patch.order === 'number' &&
    !isBronze(match) &&
    !patch.isBronzeMatch
  ) {
    return match.roundIndex === patch.roundIndex && match.order === patch.order;
  }
  return false;
}

/**
 * 試合オブジェクトへ部分更新をマージする
 */
function mergeMatchUpdate(match: Match, update: MatchUpdate): Match {
  return {
    ...match,
    ...update,
    sides: update.sides ?? match.sides,
    meta: update.meta ? { ...match.meta, ...update.meta } : match.meta,
  };
}

/**
 * JSスタイルオプションから CSSカスタムプロパティへのマッピングを生成する
 */
function buildStyleVarOverrides(options: BracketOptions): Record<string, string> {
  const vars: Record<string, string> = {};

  if (options.rootBgColor !== undefined) vars['--ml-bg'] = options.rootBgColor;
  if (options.mainVerticalPadding !== undefined) {
    vars['--ml-padding'] = `${options.mainVerticalPadding}px 16px`;
  }
  if (options.roundTitlesFontSize !== undefined) {
    vars['--ml-header-font-size'] = `${options.roundTitlesFontSize}px`;
  }
  if (options.roundTitlesFontColor !== undefined) {
    vars['--ml-header-color'] = options.roundTitlesFontColor;
  }
  if (options.matchFontSize !== undefined) {
    vars['--ml-font-size'] = `${options.matchFontSize}px`;
  }
  if (options.matchTextColor !== undefined) {
    vars['--ml-text-color'] = options.matchTextColor;
  }
  if (options.matchMinVerticalGap !== undefined) {
    vars['--ml-match-gap'] = `${options.matchMinVerticalGap}px`;
  }
  if (options.matchMaxWidth !== undefined) {
    vars['--ml-card-width'] = `${options.matchMaxWidth}px`;
  }
  if (options.roundGap !== undefined) {
    vars['--ml-round-gap'] = `${options.roundGap}px`;
  }
  if (options.distanceBetweenScorePairs !== undefined) {
    vars['--ml-score-gap'] = `${options.distanceBetweenScorePairs}px`;
  }
  if (options.connectionLinesWidth !== undefined) {
    vars['--ml-line-width'] = `${options.connectionLinesWidth}px`;
  }
  if (options.connectionLinesColor !== undefined) {
    vars['--ml-line-color'] = options.connectionLinesColor;
  }
  if (options.highlightedConnectionLinesColor !== undefined) {
    vars['--ml-line-highlight-color'] = options.highlightedConnectionLinesColor;
  }
  if (options.highlightedPlayerTitleColor !== undefined) {
    vars['--ml-highlight-color'] = options.highlightedPlayerTitleColor;
  }
  if (options.liveMatchBorderColor !== undefined) {
    vars['--ml-live-color'] = options.liveMatchBorderColor;
  }
  if (options.disableOpacity) {
    vars['--ml-dim-opacity'] = '1';
  }

  return vars;
}

type HighlightState =
  | { type: 'none' }
  | { type: 'contestant'; key: string }
  | { type: 'venue'; venue: string }
  | { type: 'live' };

/**
 * 試合の venue が指定されたコートIDまたはコート名に一致するか判定する
 */
function matchesVenue(match: Match, targetVenue: string): boolean {
  if (!match.venue) return false;
  if (typeof match.venue === 'string') {
    return match.venue === targetVenue;
  }
  return match.venue.id === targetVenue || match.venue.name === targetVenue;
}

/**
 * 指定されたコンテナ要素内にトーナメント表（ブラケット）を描画する
 *
 * `createBracket(container, data, options)` と Bracketry 互換の
 * `createBracket(data, container, options)` の両方の引数順をサポートする
 */
export function createBracket(
  container: HTMLElement,
  data: BracketData,
  options?: BracketOptions,
): BracketInstance;
export function createBracket(
  data: BracketData,
  container: HTMLElement,
  options?: BracketOptions,
): BracketInstance;
export function createBracket(
  first: HTMLElement | BracketData,
  second: BracketData | HTMLElement,
  options: BracketOptions = {},
): BracketInstance {
  let container: HTMLElement;
  let initialData: BracketData;

  if (first instanceof HTMLElement) {
    container = first;
    initialData = second as BracketData;
  } else if (second instanceof HTMLElement) {
    container = second;
    initialData = first;
  } else {
    throw new TypeError('matchline: 描画先の HTMLElement を指定してください。');
  }

  let currentData: BracketData = initialData;
  let currentOptions: BracketOptions = { ...options };
  let baseRoundIndex = Math.max(0, options.initialBaseRoundIndex ?? 0);
  let autoVisibleRoundsCount: number | null = null;
  let highlightState: HighlightState = { type: 'none' };
  let appliedCustomStyleKeys: string[] = [];
  let renderResult: RenderResult | null = null;
  let rafId: number | null = null;
  let isDestroyed = false;

  // 全体ラッパー > 上段ナビバー + ボディ領域（左右ナビボタン / ビューポート / 上下スクロールボタン）
  const containerEl = document.createElement('div');
  containerEl.className = 'ml-container';

  const navEl = document.createElement('nav');
  navEl.className = 'ml-nav';
  navEl.setAttribute('aria-label', 'ラウンドナビゲーション');

  const bodyWrapEl = document.createElement('div');
  bodyWrapEl.className = 'ml-body-wrap';

  // フローティング／ガター用 左右ナビボタン
  const sidePrevBtn = document.createElement('button');
  sidePrevBtn.type = 'button';
  sidePrevBtn.className = 'ml-side-nav-btn ml-side-nav-btn--prev';
  sidePrevBtn.dataset.navAction = 'prev';
  sidePrevBtn.setAttribute('aria-label', '前のラウンドへ');

  const sideNextBtn = document.createElement('button');
  sideNextBtn.type = 'button';
  sideNextBtn.className = 'ml-side-nav-btn ml-side-nav-btn--next';
  sideNextBtn.dataset.navAction = 'next';
  sideNextBtn.setAttribute('aria-label', '次のラウンドへ');

  // 縦スクロールボタン（verticalScrollMode: 'buttons' | 'mixed' 用）
  const scrollUpBtn = document.createElement('button');
  scrollUpBtn.type = 'button';
  scrollUpBtn.className = 'ml-scroll-btn ml-scroll-btn--up';
  scrollUpBtn.dataset.scrollAction = 'up';
  scrollUpBtn.setAttribute('aria-label', '上へスクロール');

  const scrollDownBtn = document.createElement('button');
  scrollDownBtn.type = 'button';
  scrollDownBtn.className = 'ml-scroll-btn ml-scroll-btn--down';
  scrollDownBtn.dataset.scrollAction = 'down';
  scrollDownBtn.setAttribute('aria-label', '下へスクロール');

  const viewportEl = document.createElement('div');
  viewportEl.className = 'ml-viewport';

  const rootEl = document.createElement('div');
  rootEl.className = 'ml-root';

  viewportEl.appendChild(rootEl);
  bodyWrapEl.appendChild(sidePrevBtn);
  bodyWrapEl.appendChild(viewportEl);
  bodyWrapEl.appendChild(sideNextBtn);
  bodyWrapEl.appendChild(scrollUpBtn);
  bodyWrapEl.appendChild(scrollDownBtn);

  containerEl.appendChild(navEl);
  containerEl.appendChild(bodyWrapEl);
  container.appendChild(containerEl);

  /**
   * ハイライト機能が有効かどうか
   */
  const isHighlightEnabled = (): boolean =>
    currentOptions.disableHighlight !== true &&
    currentOptions.highlightContestantHistory !== false;

  /**
   * 画面幅から 'auto' 時の表示可能ラウンド数を計算する
   */
  const computeAutoVisibleRounds = (): number => {
    const totalRounds = Math.max(1, currentData.rounds.length);
    const availableWidth = viewportEl.clientWidth || containerEl.clientWidth;
    if (availableWidth <= 0) {
      return totalRounds;
    }
    const cardWidth = currentOptions.matchMaxWidth ?? 244;
    const gap = currentOptions.roundGap ?? 48;
    const horizontalPadding = 32;
    const count = Math.floor((availableWidth - horizontalPadding + gap) / (cardWidth + gap));
    return Math.min(totalRounds, Math.max(1, count));
  };

  /**
   * テーマおよび JS スタイルオプション・スクロールモードをコンテナへ適用する
   */
  const applyThemeAndStyles = (): void => {
    for (const key of appliedCustomStyleKeys) {
      containerEl.style.removeProperty(key);
    }
    appliedCustomStyleKeys = [];

    const theme = currentOptions.theme ?? 'light';
    if (typeof theme === 'string') {
      containerEl.dataset.theme = theme;
    } else {
      containerEl.dataset.theme = 'custom';
      for (const [key, value] of Object.entries(theme)) {
        containerEl.style.setProperty(key, value);
        appliedCustomStyleKeys.push(key);
      }
    }

    // JSスタイルオプション（Bracketry 互換）を CSSカスタムプロパティへ適用
    const styleVars = buildStyleVarOverrides(currentOptions);
    for (const [key, value] of Object.entries(styleVars)) {
      containerEl.style.setProperty(key, value);
      appliedCustomStyleKeys.push(key);
    }

    // 縦スクロールモード反映
    const scrollMode = currentOptions.verticalScrollMode ?? 'native';
    containerEl.dataset.scrollMode = scrollMode;

    // ナビ・スクロールボタン配置モード反映
    const navPos =
      currentOptions.showNavigation === false
        ? 'hidden'
        : (currentOptions.navButtonsPosition ?? 'top');
    containerEl.dataset.navPosition = navPos;

    const scrollPos =
      currentOptions.scrollButtonsPosition ??
      (scrollMode === 'native' ? 'hidden' : 'overMatches');
    containerEl.dataset.scrollPosition = scrollPos;
  };

  /**
   * 表示ラウンド数を制限するモードかどうか
   */
  const isRestrictVisibleRoundsMode = (): boolean =>
    currentOptions.visibleRoundsCount === 'auto' ||
    (typeof currentOptions.visibleRoundsCount === 'number' &&
      currentOptions.visibleRoundsCount > 0);

  /**
   * 現在のラウンド数・オプションから正規化されたナビゲーション状態を算出する
   */
  const computeNavigationState = (): NavigationState => {
    const totalRounds = currentData.rounds.length;
    let visibleRoundsCount = Math.max(1, totalRounds);

    if (currentOptions.visibleRoundsCount === 'auto') {
      const computed = autoVisibleRoundsCount ?? computeAutoVisibleRounds();
      autoVisibleRoundsCount = computed;
      visibleRoundsCount = Math.min(computed, Math.max(1, totalRounds));
    } else if (
      typeof currentOptions.visibleRoundsCount === 'number' &&
      currentOptions.visibleRoundsCount > 0
    ) {
      visibleRoundsCount = Math.min(currentOptions.visibleRoundsCount, Math.max(1, totalRounds));
    }

    const maxBaseIndex = Math.max(0, totalRounds - visibleRoundsCount);
    const clampedBase = Math.min(Math.max(0, baseRoundIndex), maxBaseIndex);
    baseRoundIndex = clampedBase;

    const restrictMode = isRestrictVisibleRoundsMode();
    const effectiveMax = restrictMode ? maxBaseIndex : Math.max(0, totalRounds - 1);

    return {
      baseRoundIndex: clampedBase,
      totalRounds,
      visibleRoundsCount,
      canGoPrevious: clampedBase > 0,
      canGoNext: clampedBase < effectiveMax,
    };
  };

  /**
   * 縦スクロールボタンの活性・非活性状態を更新する
   */
  const updateScrollButtonsState = (): void => {
    const scrollMode = currentOptions.verticalScrollMode ?? 'native';
    const scrollPos =
      currentOptions.scrollButtonsPosition ??
      (scrollMode === 'native' ? 'hidden' : 'overMatches');
    const showScrollBtns = scrollMode !== 'native' && scrollPos !== 'hidden';

    scrollUpBtn.hidden = !showScrollBtns;
    scrollDownBtn.hidden = !showScrollBtns;

    if (!showScrollBtns) {
      return;
    }

    setButtonContent(scrollUpBtn, currentOptions.scrollUpButtonHTML, '▲');
    setButtonContent(scrollDownBtn, currentOptions.scrollDownButtonHTML, '▼');

    const maxScrollTop = Math.max(0, viewportEl.scrollHeight - viewportEl.clientHeight);
    scrollUpBtn.disabled = viewportEl.scrollTop <= 1;
    scrollDownBtn.disabled = maxScrollTop <= 1 || viewportEl.scrollTop >= maxScrollTop - 1;
  };

  /**
   * 現在の highlightState をDOM要素へ反映する
   */
  const applyHighlightToDOM = (): void => {
    if (isDestroyed || !renderResult) {
      return;
    }

    const activeState: HighlightState =
      highlightState.type === 'contestant' && !isHighlightEnabled()
        ? { type: 'none' }
        : highlightState;

    const isContestantMode = activeState.type === 'contestant';
    const isMatchFilterMode = activeState.type === 'venue' || activeState.type === 'live';

    rootEl.classList.toggle('ml-has-highlight', isContestantMode);
    rootEl.classList.toggle('ml-has-match-highlight', isMatchFilterMode);

    const sideEls = rootEl.querySelectorAll<HTMLElement>('.ml-team');
    for (const sideEl of sideEls) {
      const isMatch =
        isContestantMode && sideEl.dataset.contestantKey === activeState.key;
      sideEl.classList.toggle('ml-team--highlighted', isMatch);
    }

    for (const [matchKey, cardEl] of renderResult.matchElements.entries()) {
      const meta = renderResult.matchMetaMap.get(matchKey);
      let isHighlighted = false;

      if (meta) {
        if (activeState.type === 'contestant') {
          isHighlighted = (meta.match.sides ?? []).some(
            (side) => getContestantKey(side) === activeState.key,
          );
        } else if (activeState.type === 'venue') {
          isHighlighted = matchesVenue(meta.match, activeState.venue);
        } else if (activeState.type === 'live') {
          isHighlighted = Boolean(meta.match.isLive);
        }
      }

      cardEl.classList.toggle('ml-match--highlighted', isHighlighted);
    }
  };

  /**
   * 現在のDOMレイアウトに基づいてSVG接続線を描画する
   */
  const redrawConnectors = (): void => {
    if (isDestroyed || !renderResult) {
      return;
    }
    const contestantKey =
      highlightState.type === 'contestant' && isHighlightEnabled()
        ? highlightState.key
        : null;
    drawConnectors(
      rootEl,
      renderResult.svgElement,
      renderResult.normalizedRounds,
      renderResult.matchElements,
      currentOptions.connectorType ?? 'orthogonal',
      contestantKey,
    );
    updateScrollButtonsState();
  };

  /**
   * requestAnimationFrame で接続線の再描画をスケジュールする
   */
  const scheduleRedraw = (): void => {
    if (isDestroyed) {
      return;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      rafId = null;
      redrawConnectors();
    });
  };

  /**
   * 全ラウンド表示モード時、指定ラウンドへ滑らかに横スクロールする
   */
  const scrollToRoundIfNeeded = (roundIndex: number): void => {
    if (!renderResult || isRestrictVisibleRoundsMode()) {
      return;
    }

    const targetRoundEl = renderResult.roundElements.get(roundIndex);
    if (!targetRoundEl) {
      return;
    }
    const targetLeft = Math.max(0, targetRoundEl.offsetLeft - 16);
    if (typeof viewportEl.scrollTo === 'function') {
      viewportEl.scrollTo({ left: targetLeft, behavior: 'smooth' });
    } else {
      viewportEl.scrollLeft = targetLeft;
    }
  };

  /**
   * ナビゲーションUI（上段バーまたは左右ボタン）を更新する
   */
  const updateNavigationUI = (navState: NavigationState): void => {
    const navPos =
      currentOptions.showNavigation === false
        ? 'hidden'
        : (currentOptions.navButtonsPosition ?? 'top');
    const hasMultipleRounds = currentData.rounds.length > 1;

    const showTopNav = navPos === 'top' && hasMultipleRounds;
    navEl.hidden = !showTopNav;
    if (showTopNav) {
      renderNavigationBar(navEl, currentData, navState, currentOptions);
    } else {
      navEl.replaceChildren();
    }

    const showSideNav =
      (navPos === 'gutters' || navPos === 'overTitles' || navPos === 'overMatches') &&
      hasMultipleRounds;
    sidePrevBtn.hidden = !showSideNav;
    sideNextBtn.hidden = !showSideNav;

    if (showSideNav) {
      setButtonContent(sidePrevBtn, currentOptions.leftNavButtonHTML, '‹');
      setButtonContent(sideNextBtn, currentOptions.rightNavButtonHTML, '›');
      sidePrevBtn.disabled = !navState.canGoPrevious;
      sideNextBtn.disabled = !navState.canGoNext;
    }
  };

  /**
   * DOM全体を再構築してテーマ・ナビゲーション・ハイライト・接続線を描画する
   */
  const render = (): void => {
    if (isDestroyed) {
      return;
    }

    applyThemeAndStyles();

    const navState = computeNavigationState();
    updateNavigationUI(navState);

    renderResult = renderBracketDOM(
      rootEl,
      currentData,
      currentOptions,
      navState,
      isRestrictVisibleRoundsMode(),
    );
    applyHighlightToDOM();
    redrawConnectors();
    scheduleRedraw();
  };

  /**
   * ハイライト状態を切り替える
   */
  const setHighlightState = (next: HighlightState): void => {
    if (isDestroyed) {
      return;
    }
    highlightState = next;
    applyHighlightToDOM();
    redrawConnectors();
  };

  /**
   * 参加者のハイライト状態を切り替える
   */
  const setHighlight = (contestantKey: string | null): void => {
    if (
      contestantKey === null &&
      highlightState.type === 'none'
    ) {
      return;
    }
    if (
      contestantKey !== null &&
      highlightState.type === 'contestant' &&
      highlightState.key === contestantKey
    ) {
      return;
    }
    setHighlightState(
      contestantKey ? { type: 'contestant', key: contestantKey } : { type: 'none' },
    );
  };

  /**
   * クリックまたはキーボード操作を処理する
   */
  const handleInteraction = (
    target: EventTarget | null,
    event: MouseEvent | KeyboardEvent,
  ): void => {
    if (isDestroyed || !renderResult || !(target instanceof Element)) {
      return;
    }

    const sideEl = target.closest<HTMLElement>('.ml-team');
    const cardEl = target.closest<HTMLElement>('.ml-match');

    // カード外をクリックした場合はハイライトを解除する
    if (!cardEl || !rootEl.contains(cardEl)) {
      if (isHighlightEnabled() && (currentOptions.highlightTrigger ?? 'click') === 'click') {
        setHighlight(null);
      }
      return;
    }

    const matchKey = cardEl.dataset.matchKey;
    if (!matchKey) {
      return;
    }

    const meta = renderResult.matchMetaMap.get(matchKey);
    if (!meta) {
      return;
    }

    const round = meta.isBronzeMatch ? null : (currentData.rounds[meta.roundIndex] ?? null);
    const matchContext = {
      roundIndex: meta.roundIndex,
      order: meta.order,
      round,
      isBronzeMatch: meta.isBronzeMatch,
      element: cardEl,
      event,
    };

    // 参加者スロットに対するハイライトおよびコールバック処理
    if (sideEl && cardEl.contains(sideEl)) {
      const sideIndex = Number(sideEl.dataset.sideIndex) as 0 | 1;
      const side = meta.match.sides?.[sideIndex] ?? null;
      const contestantKey = getContestantKey(side);
      const contestant =
        side?.contestantId && currentData.contestants
          ? (currentData.contestants[side.contestantId] ?? null)
          : null;

      if (isHighlightEnabled() && (currentOptions.highlightTrigger ?? 'click') === 'click') {
        const isAlreadySelected =
          contestantKey !== null &&
          highlightState.type === 'contestant' &&
          highlightState.key === contestantKey;
        setHighlight(isAlreadySelected ? null : contestantKey);
      }

      const sideClickCtx = {
        ...matchContext,
        match: meta.match,
        sideIndex,
        contestant,
        contestantKey,
      };

      if (side && typeof currentOptions.onSideClick === 'function') {
        currentOptions.onSideClick(side, sideClickCtx);
      }
      if (typeof currentOptions.onMatchSideClick === 'function') {
        currentOptions.onMatchSideClick(meta.match, sideIndex, sideClickCtx);
      }
    }

    // 試合カードクリックコールバック
    if (typeof currentOptions.onMatchClick === 'function') {
      currentOptions.onMatchClick(meta.match, matchContext);
    }
  };

  const handleRootClick = (event: MouseEvent): void => {
    handleInteraction(event.target, event);
  };

  const handleRootKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      const target = event.target;
      if (target instanceof Element && target.closest('.ml-match')) {
        event.preventDefault();
        handleInteraction(target, event);
      }
    }
  };

  const handlePointerOver = (event: PointerEvent): void => {
    if (isDestroyed || !isHighlightEnabled() || currentOptions.highlightTrigger !== 'hover') {
      return;
    }
    if (!(event.target instanceof Element)) {
      return;
    }
    const sideEl = event.target.closest<HTMLElement>('.ml-team');
    if (sideEl && rootEl.contains(sideEl)) {
      setHighlight(sideEl.dataset.contestantKey ?? null);
    }
  };

  const handlePointerLeave = (): void => {
    if (isDestroyed || !isHighlightEnabled() || currentOptions.highlightTrigger !== 'hover') {
      return;
    }
    setHighlight(null);
  };

  /**
   * ラウンド移動を実行する共通ヘルパー
   */
  const goToRound = (nextIndex: number): void => {
    if (isDestroyed || currentData.rounds.length === 0) {
      return;
    }

    const restrictMode = isRestrictVisibleRoundsMode();
    const currentNav = computeNavigationState();
    const maxIndex = restrictMode
      ? Math.max(0, currentData.rounds.length - currentNav.visibleRoundsCount)
      : Math.max(0, currentData.rounds.length - 1);

    const clamped = Math.min(Math.max(0, nextIndex), maxIndex);
    baseRoundIndex = clamped;

    if (currentOptions.resetScrollOnNavigation) {
      viewportEl.scrollTop = 0;
    }

    if (restrictMode) {
      render();
    } else {
      const navState = computeNavigationState();
      updateNavigationUI(navState);
      scrollToRoundIfNeeded(clamped);
    }
  };

  const handleNavActionClick = (event: MouseEvent): void => {
    if (isDestroyed || !(event.target instanceof Element)) {
      return;
    }
    const btn = event.target.closest<HTMLButtonElement>('button');
    if (!btn || btn.disabled) {
      return;
    }

    const action = btn.dataset.navAction;
    if (action === 'prev') {
      goToRound(baseRoundIndex - 1);
      return;
    }
    if (action === 'next') {
      goToRound(baseRoundIndex + 1);
      return;
    }

    const roundIdxAttr = btn.dataset.navRoundIndex;
    if (roundIdxAttr !== undefined) {
      const parsed = Number(roundIdxAttr);
      if (!Number.isNaN(parsed)) {
        goToRound(parsed);
      }
    }
  };

  const handleScrollBtnClick = (direction: 'up' | 'down'): void => {
    if (isDestroyed) return;
    const step = Math.max(160, Math.round(viewportEl.clientHeight * 0.65));
    const delta = direction === 'up' ? -step : step;
    if (typeof viewportEl.scrollBy === 'function') {
      viewportEl.scrollBy({ top: delta, behavior: 'smooth' });
    } else {
      viewportEl.scrollTop += delta;
    }
  };

  const handleScrollUpClick = (): void => handleScrollBtnClick('up');
  const handleScrollDownClick = (): void => handleScrollBtnClick('down');
  const handleViewportScroll = (): void => updateScrollButtonsState();

  rootEl.addEventListener('click', handleRootClick);
  rootEl.addEventListener('keydown', handleRootKeyDown);
  rootEl.addEventListener('pointerover', handlePointerOver);
  rootEl.addEventListener('pointerleave', handlePointerLeave);
  navEl.addEventListener('click', handleNavActionClick);
  sidePrevBtn.addEventListener('click', handleNavActionClick);
  sideNextBtn.addEventListener('click', handleNavActionClick);
  scrollUpBtn.addEventListener('click', handleScrollUpClick);
  scrollDownBtn.addEventListener('click', handleScrollDownClick);
  viewportEl.addEventListener('scroll', handleViewportScroll, { passive: true });

  // リサイズ時にSVG接続線と 'auto' 表示ラウンド数を自動追従させる ResizeObserver
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (isDestroyed) return;
      if (currentOptions.visibleRoundsCount === 'auto') {
        const nextCount = computeAutoVisibleRounds();
        if (nextCount !== autoVisibleRoundsCount) {
          autoVisibleRoundsCount = nextCount;
          render();
          return;
        }
      }
      scheduleRedraw();
    });
    resizeObserver.observe(rootEl);
    resizeObserver.observe(viewportEl);
  }

  // 初回描画
  render();

  const updateImpl = (newData: BracketData, newOptions?: Partial<BracketOptions>): void => {
    if (isDestroyed) {
      return;
    }
    currentData = newData;
    if (newOptions) {
      currentOptions = { ...currentOptions, ...newOptions };
      if (newOptions.visibleRoundsCount !== 'auto') {
        autoVisibleRoundsCount = null;
      }
    }
    render();
  };

  const updateMatchesImpl = (updates: MatchUpdate[]): void => {
    if (isDestroyed || updates.length === 0) {
      return;
    }

    const existingMatches = [...(currentData.matches ?? [])];

    for (const patch of updates) {
      const index = existingMatches.findIndex((m) => isSameMatch(m, patch));
      if (index >= 0) {
        existingMatches[index] = mergeMatchUpdate(existingMatches[index], patch);
      } else if (typeof patch.roundIndex === 'number' && typeof patch.order === 'number') {
        existingMatches.push({
          roundIndex: patch.roundIndex,
          order: patch.order,
          ...patch,
        });
      }
    }

    currentData = {
      ...currentData,
      matches: existingMatches,
    };
    render();
  };

  const destroyImpl = (): void => {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    rootEl.removeEventListener('click', handleRootClick);
    rootEl.removeEventListener('keydown', handleRootKeyDown);
    rootEl.removeEventListener('pointerover', handlePointerOver);
    rootEl.removeEventListener('pointerleave', handlePointerLeave);
    navEl.removeEventListener('click', handleNavActionClick);
    sidePrevBtn.removeEventListener('click', handleNavActionClick);
    sideNextBtn.removeEventListener('click', handleNavActionClick);
    scrollUpBtn.removeEventListener('click', handleScrollUpClick);
    scrollDownBtn.removeEventListener('click', handleScrollDownClick);
    viewportEl.removeEventListener('scroll', handleViewportScroll);

    containerEl.remove();
    renderResult = null;
  };

  return {
    update: updateImpl,
    replaceData(newData: BracketData): void {
      updateImpl(newData);
    },
    applyNewOptions(newOptions: Partial<BracketOptions>): void {
      if (isDestroyed) {
        return;
      }
      currentOptions = { ...currentOptions, ...newOptions };
      if (newOptions.visibleRoundsCount !== 'auto') {
        autoVisibleRoundsCount = null;
      }
      render();
    },
    getAllData(): BracketData {
      return currentData;
    },
    getUserOptions(): BracketOptions {
      return { ...currentOptions };
    },
    updateMatches: updateMatchesImpl,
    applyMatchesUpdates: updateMatchesImpl,

    highlightContestantHistory(contestantId: string | null): void {
      setHighlight(contestantId);
    },

    highlightVenue(venue: string | null): void {
      setHighlightState(venue ? { type: 'venue', venue } : { type: 'none' });
    },

    highlightLiveMatches(active = true): void {
      setHighlightState(active ? { type: 'live' } : { type: 'none' });
    },

    clearHighlight(): void {
      setHighlightState({ type: 'none' });
    },

    focusContestant(contestantId: string): boolean {
      if (isDestroyed || !contestantId || !renderResult) {
        return false;
      }

      let targetRoundIndex = -1;
      let targetMatchKey: string | null = null;

      for (let r = 0; r < renderResult.normalizedRounds.length; r++) {
        for (const match of renderResult.normalizedRounds[r]) {
          if ((match.sides ?? []).some((s) => getContestantKey(s) === contestantId)) {
            targetRoundIndex = r;
            targetMatchKey = getMatchKey(match);
            break;
          }
        }
        if (targetMatchKey) break;
      }

      if (!targetMatchKey && renderResult.bronzeMatch) {
        if (
          (renderResult.bronzeMatch.sides ?? []).some((s) => getContestantKey(s) === contestantId)
        ) {
          targetRoundIndex = currentData.rounds.length - 1;
          targetMatchKey = getMatchKey(renderResult.bronzeMatch);
        }
      }

      if (!targetMatchKey) {
        return false;
      }

      const restrictMode = isRestrictVisibleRoundsMode();
      if (restrictMode && targetRoundIndex >= 0) {
        const navState = computeNavigationState();
        const visibleEnd = baseRoundIndex + navState.visibleRoundsCount - 1;
        if (targetRoundIndex < baseRoundIndex || targetRoundIndex > visibleEnd) {
          goToRound(targetRoundIndex);
        }
      }

      setHighlight(contestantId);

      const cardEl = renderResult?.matchElements.get(targetMatchKey);
      if (cardEl && typeof cardEl.scrollIntoView === 'function') {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      return true;
    },

    moveToPreviousRound(): void {
      goToRound(baseRoundIndex - 1);
    },

    moveToNextRound(): void {
      goToRound(baseRoundIndex + 1);
    },

    moveToLastRound(): void {
      const restrictMode = isRestrictVisibleRoundsMode();
      const navState = computeNavigationState();
      const target = restrictMode
        ? Math.max(0, currentData.rounds.length - navState.visibleRoundsCount)
        : Math.max(0, currentData.rounds.length - 1);
      goToRound(target);
    },

    setBaseRoundIndex(index: number): void {
      goToRound(index);
    },

    getNavigationState(): NavigationState {
      return computeNavigationState();
    },

    redrawConnectors(): void {
      redrawConnectors();
    },

    destroy: destroyImpl,
    uninstall: destroyImpl,
  };
}
