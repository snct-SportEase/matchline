import { drawConnectors } from './connectors';
import { renderBracketDOM, type RenderResult } from './renderer';
import type { BracketData, BracketInstance, BracketOptions } from './types';

/**
 * 指定されたコンテナ要素内にトーナメント表（ブラケット）を描画する
 *
 * @param container 描画先のHTML要素
 * @param data トーナメントのラウンド・試合データ
 * @param options 描画やインタラクションのオプション
 * @returns 更新・再計算・破棄を行うための操作インスタンス
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
  let renderResult: RenderResult | null = null;
  let rafId: number | null = null;
  let isDestroyed = false;

  // 横スクロール用の外側ラッパーと、SVG座標基準となる内側ルート要素を作成
  const scrollContainerEl = document.createElement('div');
  scrollContainerEl.className = 'ml-container';

  const rootEl = document.createElement('div');
  rootEl.className = 'ml-root';
  scrollContainerEl.appendChild(rootEl);
  container.appendChild(scrollContainerEl);

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
    );
  };

  /**
   * requestAnimationFrame で接続線の再描画をスケジュールする（リサイズ時の連続呼び出しを間引く）
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
   * DOM全体を再構築して接続線を描画する
   */
  const render = (): void => {
    if (isDestroyed) {
      return;
    }
    renderResult = renderBracketDOM(rootEl, currentData, currentOptions);
    // 同期的に初回描画を行い、さらに次フレームでレイアウト確定後のズレも補正する
    redrawConnectors();
    scheduleRedraw();
  };

  /**
   * イベント発生元から該当する試合カードを探し、onMatchClick を発火させる
   */
  const triggerMatchClick = (target: EventTarget | null, event: MouseEvent | KeyboardEvent): void => {
    if (isDestroyed || !renderResult || typeof currentOptions.onMatchClick !== 'function') {
      return;
    }
    if (!(target instanceof Element)) {
      return;
    }

    const cardEl = target.closest<HTMLElement>('.ml-match');
    if (!cardEl || !rootEl.contains(cardEl)) {
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

    const round = currentData.rounds[meta.roundIndex];
    if (!round) {
      return;
    }

    currentOptions.onMatchClick(meta.match, {
      roundIndex: meta.roundIndex,
      matchIndex: meta.matchIndex,
      round,
      element: cardEl,
      event,
    });
  };

  const handleClick = (event: MouseEvent): void => {
    triggerMatchClick(event.target, event);
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      const target = event.target;
      if (target instanceof Element && target.closest('.ml-match')) {
        event.preventDefault();
        triggerMatchClick(target, event);
      }
    }
  };

  rootEl.addEventListener('click', handleClick);
  rootEl.addEventListener('keydown', handleKeyDown);

  // リサイズ時にSVG接続線を自動追従させる ResizeObserver
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      scheduleRedraw();
    });
    resizeObserver.observe(rootEl);
    resizeObserver.observe(scrollContainerEl);
  }

  // 初回描画を実行
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

      rootEl.removeEventListener('click', handleClick);
      rootEl.removeEventListener('keydown', handleKeyDown);

      scrollContainerEl.remove();
      renderResult = null;
    },
  };
}
