import { drawConnectors } from './connectors';
import {
  getContestantKey,
  getMatchKey,
  isBronze,
  renderBracketDOM,
  renderNavigationBar,
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
  let highlightedContestantKey: string | null = null;
  let appliedCustomThemeKeys: string[] = [];
  let renderResult: RenderResult | null = null;
  let rafId: number | null = null;
  let isDestroyed = false;

  // 全体ラッパー > ナビゲーションバー + スクロールビューポート > SVG基準ルート
  const containerEl = document.createElement('div');
  containerEl.className = 'ml-container';

  /**
   * options.theme をコンテナ要素へ反映する
   */
  const applyTheme = (): void => {
    for (const key of appliedCustomThemeKeys) {
      containerEl.style.removeProperty(key);
    }
    appliedCustomThemeKeys = [];

    const theme = currentOptions.theme ?? 'light';
    if (typeof theme === 'string') {
      containerEl.dataset.theme = theme;
    } else {
      containerEl.dataset.theme = 'custom';
      for (const [key, value] of Object.entries(theme)) {
        containerEl.style.setProperty(key, value);
        appliedCustomThemeKeys.push(key);
      }
    }
  };

  const navEl = document.createElement('nav');
  navEl.className = 'ml-nav';
  navEl.setAttribute('aria-label', 'ラウンドナビゲーション');

  const viewportEl = document.createElement('div');
  viewportEl.className = 'ml-viewport';

  const rootEl = document.createElement('div');
  rootEl.className = 'ml-root';

  viewportEl.appendChild(rootEl);
  containerEl.appendChild(navEl);
  containerEl.appendChild(viewportEl);
  container.appendChild(containerEl);

  /**
   * 現在のラウンド数・オプションから正規化されたナビゲーション状態を算出する
   */
  const computeNavigationState = (): NavigationState => {
    const totalRounds = currentData.rounds.length;
    const rawVisible = currentOptions.visibleRoundsCount;
    const visibleRoundsCount =
      typeof rawVisible === 'number' && rawVisible > 0
        ? Math.min(rawVisible, Math.max(1, totalRounds))
        : Math.max(1, totalRounds);

    const maxBaseIndex = Math.max(0, totalRounds - visibleRoundsCount);
    const clampedBase = Math.min(Math.max(0, baseRoundIndex), maxBaseIndex);
    baseRoundIndex = clampedBase;

    const restrictMode = typeof rawVisible === 'number' && rawVisible > 0;
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
   * 現在の highlightedContestantKey をDOM要素へ反映する
   */
  const applyHighlightToDOM = (): void => {
    if (isDestroyed || !renderResult) {
      return;
    }

    rootEl.classList.toggle('ml-has-highlight', highlightedContestantKey !== null);

    const sideEls = rootEl.querySelectorAll<HTMLElement>('.ml-team');
    for (const sideEl of sideEls) {
      const isMatch =
        highlightedContestantKey !== null &&
        sideEl.dataset.contestantKey === highlightedContestantKey;
      sideEl.classList.toggle('ml-team--highlighted', isMatch);
    }

    for (const [matchKey, cardEl] of renderResult.matchElements.entries()) {
      const meta = renderResult.matchMetaMap.get(matchKey);
      const hasContestant =
        highlightedContestantKey !== null &&
        Boolean(
          (meta?.match.sides ?? []).some(
            (side) => getContestantKey(side) === highlightedContestantKey,
          ),
        );
      cardEl.classList.toggle('ml-match--highlighted', hasContestant);
    }
  };

  /**
   * 現在のDOMレイアウトに基づいてSVG接続線を描画する
   */
  const redrawConnectors = (): void => {
    if (isDestroyed || !renderResult) {
      return;
    }
    drawConnectors(
      rootEl,
      renderResult.svgElement,
      renderResult.normalizedRounds,
      renderResult.matchElements,
      currentOptions.connectorType ?? 'orthogonal',
      highlightedContestantKey,
    );
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
    if (!renderResult) {
      return;
    }
    const restrictMode =
      typeof currentOptions.visibleRoundsCount === 'number' &&
      currentOptions.visibleRoundsCount > 0;
    if (restrictMode) {
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
   * DOM全体を再構築してナビゲーション・ハイライト・接続線を描画する
   */
  const render = (): void => {
    if (isDestroyed) {
      return;
    }

    applyTheme();

    const navState = computeNavigationState();
    const showNav = currentOptions.showNavigation !== false && currentData.rounds.length > 1;
    navEl.hidden = !showNav;
    if (showNav) {
      renderNavigationBar(navEl, currentData, navState);
    } else {
      navEl.replaceChildren();
    }

    renderResult = renderBracketDOM(rootEl, currentData, currentOptions, navState);
    applyHighlightToDOM();
    redrawConnectors();
    scheduleRedraw();
  };

  /**
   * 参加者のハイライト状態を切り替える
   */
  const setHighlight = (contestantKey: string | null): void => {
    if (isDestroyed || highlightedContestantKey === contestantKey) {
      return;
    }
    highlightedContestantKey = contestantKey;
    applyHighlightToDOM();
    redrawConnectors();
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
      if (
        currentOptions.highlightContestantHistory !== false &&
        (currentOptions.highlightTrigger ?? 'click') === 'click'
      ) {
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

      if (
        currentOptions.highlightContestantHistory !== false &&
        (currentOptions.highlightTrigger ?? 'click') === 'click'
      ) {
        setHighlight(
          contestantKey && highlightedContestantKey === contestantKey ? null : contestantKey,
        );
      }

      if (side && typeof currentOptions.onSideClick === 'function') {
        currentOptions.onSideClick(side, {
          ...matchContext,
          match: meta.match,
          sideIndex,
          contestant,
          contestantKey,
        });
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
    if (
      isDestroyed ||
      currentOptions.highlightContestantHistory === false ||
      currentOptions.highlightTrigger !== 'hover'
    ) {
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
    if (
      isDestroyed ||
      currentOptions.highlightContestantHistory === false ||
      currentOptions.highlightTrigger !== 'hover'
    ) {
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
    const restrictMode =
      typeof currentOptions.visibleRoundsCount === 'number' &&
      currentOptions.visibleRoundsCount > 0;
    const maxIndex = restrictMode
      ? Math.max(0, currentData.rounds.length - currentOptions.visibleRoundsCount!)
      : Math.max(0, currentData.rounds.length - 1);

    const clamped = Math.min(Math.max(0, nextIndex), maxIndex);
    baseRoundIndex = clamped;

    if (restrictMode) {
      render();
    } else {
      const navState = computeNavigationState();
      if (!navEl.hidden) {
        renderNavigationBar(navEl, currentData, navState);
      }
      scrollToRoundIfNeeded(clamped);
    }
  };

  const handleNavClick = (event: MouseEvent): void => {
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

  rootEl.addEventListener('click', handleRootClick);
  rootEl.addEventListener('keydown', handleRootKeyDown);
  rootEl.addEventListener('pointerover', handlePointerOver);
  rootEl.addEventListener('pointerleave', handlePointerLeave);
  navEl.addEventListener('click', handleNavClick);

  // リサイズ時にSVG接続線を自動追従させる ResizeObserver
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
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
    navEl.removeEventListener('click', handleNavClick);

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
      render();
    },
    updateMatches: updateMatchesImpl,
    applyMatchesUpdates: updateMatchesImpl,

    highlightContestantHistory(contestantId: string | null): void {
      setHighlight(contestantId);
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

      const restrictMode =
        typeof currentOptions.visibleRoundsCount === 'number' &&
        currentOptions.visibleRoundsCount > 0;
      if (restrictMode && targetRoundIndex >= 0) {
        const visibleEnd = baseRoundIndex + currentOptions.visibleRoundsCount! - 1;
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
      const restrictMode =
        typeof currentOptions.visibleRoundsCount === 'number' &&
        currentOptions.visibleRoundsCount > 0;
      const target = restrictMode
        ? Math.max(0, currentData.rounds.length - currentOptions.visibleRoundsCount!)
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
