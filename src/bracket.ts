import { drawConnectors } from './connectors';
import {
  getTeamKey,
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
 * 試合オブジェクトへ部分更新を適用する
 */
function mergeMatchUpdate(match: Match, update: MatchUpdate): Match {
  return {
    ...match,
    ...update,
    id: match.id,
    teams: update.teams ?? match.teams,
    meta: update.meta ? { ...match.meta, ...update.meta } : match.meta,
  };
}

/**
 * 指定されたコンテナ要素内にトーナメント表（ブラケット）を描画する
 *
 * @param container 描画先のHTML要素
 * @param data トーナメントのラウンド・試合データ
 * @param options 描画やインタラクションのオプション
 * @returns 更新・ハイライト・ナビゲーション・破棄を行うための操作インスタンス
 */
export function createBracket(
  container: HTMLElement,
  data: BracketData,
  options: BracketOptions = {},
): BracketInstance {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('matchline: container には有効な HTMLElement を指定してください。');
  }

  let currentData: BracketData = data;
  let currentOptions: BracketOptions = { ...options };
  let baseRoundIndex = Math.max(0, options.initialBaseRoundIndex ?? 0);
  let highlightedTeamKey: string | null = null;
  let renderResult: RenderResult | null = null;
  let rafId: number | null = null;
  let isDestroyed = false;

  // 全体ラッパー > ナビゲーションバー + 横スクロール領域 > SVG基準ルート
  const containerEl = document.createElement('div');
  containerEl.className = 'ml-container';

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

    // visibleRoundsCount 未指定時は横スクロール移動用として全ラウンド間を移動可能にする
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
   * 現在の highlightedTeamKey をDOM要素へ反映する
   */
  const applyHighlightToDOM = (): void => {
    if (isDestroyed || !renderResult) {
      return;
    }

    rootEl.classList.toggle('ml-has-highlight', highlightedTeamKey !== null);

    const teamEls = rootEl.querySelectorAll<HTMLElement>('.ml-team');
    for (const teamEl of teamEls) {
      const isMatch = highlightedTeamKey !== null && teamEl.dataset.teamKey === highlightedTeamKey;
      teamEl.classList.toggle('ml-team--highlighted', isMatch);
    }

    for (const [matchId, cardEl] of renderResult.matchElements.entries()) {
      const meta = renderResult.matchMetaMap.get(matchId);
      const hasTeam =
        highlightedTeamKey !== null &&
        Boolean(meta?.match.teams.some((team) => getTeamKey(team) === highlightedTeamKey));
      cardEl.classList.toggle('ml-match--highlighted', hasTeam);
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
      currentData,
      renderResult.matchElements,
      currentOptions.connectorType ?? 'orthogonal',
      highlightedTeamKey,
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
   * チームハイライト状態を切り替える
   */
  const setHighlight = (teamKey: string | null): void => {
    if (isDestroyed || highlightedTeamKey === teamKey) {
      return;
    }
    highlightedTeamKey = teamKey;
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

    const teamEl = target.closest<HTMLElement>('.ml-team');
    const cardEl = target.closest<HTMLElement>('.ml-match');

    // カード外をクリックした場合はハイライトを解除する
    if (!cardEl || !rootEl.contains(cardEl)) {
      if (
        currentOptions.highlightTeamHistory !== false &&
        (currentOptions.highlightTrigger ?? 'click') === 'click'
      ) {
        setHighlight(null);
      }
      return;
    }

    const matchId = cardEl.dataset.matchId;
    if (!matchId) {
      return;
    }

    const meta = renderResult.matchMetaMap.get(matchId);
    if (!meta) {
      return;
    }

    const round = meta.isThirdPlace ? null : (currentData.rounds[meta.roundIndex] ?? null);
    const matchContext = {
      roundIndex: meta.roundIndex,
      matchIndex: meta.matchIndex,
      round,
      isThirdPlace: meta.isThirdPlace,
      element: cardEl,
      event,
    };

    // チーム行に対するハイライトおよびコールバック処理
    if (teamEl && cardEl.contains(teamEl)) {
      const teamIndex = Number(teamEl.dataset.teamIndex) as 0 | 1;
      const team = meta.match.teams[teamIndex] ?? null;
      const teamKey = getTeamKey(team);

      if (
        currentOptions.highlightTeamHistory !== false &&
        (currentOptions.highlightTrigger ?? 'click') === 'click'
      ) {
        setHighlight(teamKey && highlightedTeamKey === teamKey ? null : teamKey);
      }

      if (team && typeof currentOptions.onTeamClick === 'function') {
        currentOptions.onTeamClick(team, {
          ...matchContext,
          match: meta.match,
          teamIndex,
          teamKey,
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
      currentOptions.highlightTeamHistory === false ||
      currentOptions.highlightTrigger !== 'hover'
    ) {
      return;
    }
    if (!(event.target instanceof Element)) {
      return;
    }
    const teamEl = event.target.closest<HTMLElement>('.ml-team');
    if (teamEl && rootEl.contains(teamEl)) {
      setHighlight(teamEl.dataset.teamKey ?? null);
    }
  };

  const handlePointerLeave = (): void => {
    if (
      isDestroyed ||
      currentOptions.highlightTeamHistory === false ||
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

  return {
    update(newData: BracketData, newOptions?: Partial<BracketOptions>): void {
      if (isDestroyed) {
        return;
      }
      currentData = newData;
      if (newOptions) {
        currentOptions = { ...currentOptions, ...newOptions };
      }
      render();
    },

    updateMatches(updates: MatchUpdate[]): void {
      if (isDestroyed || updates.length === 0) {
        return;
      }

      const updateMap = new Map<string, MatchUpdate>();
      for (const item of updates) {
        updateMap.set(item.id, item);
      }

      const nextRounds = currentData.rounds.map((round) => ({
        ...round,
        matches: round.matches.map((match) => {
          const patch = updateMap.get(match.id);
          return patch ? mergeMatchUpdate(match, patch) : match;
        }),
      }));

      let nextThirdPlace = currentData.thirdPlaceMatch;
      if (nextThirdPlace) {
        const patch = updateMap.get(nextThirdPlace.id);
        if (patch) {
          nextThirdPlace = mergeMatchUpdate(nextThirdPlace, patch);
        }
      }

      currentData = {
        ...currentData,
        rounds: nextRounds,
        thirdPlaceMatch: nextThirdPlace,
      };
      render();
    },

    highlightTeam(teamKey: string | null): void {
      setHighlight(teamKey);
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

    destroy(): void {
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
    },
  };
}
