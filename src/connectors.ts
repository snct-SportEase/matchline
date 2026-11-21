import { getContestantKey, getMatchKey } from './renderer';
import type { ConnectorType, Match } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface ConnectorSpec {
  d: string;
  isWinner: boolean;
  isHighlighted: boolean;
  fromKey: string;
  toKey: string;
}

/**
 * 始点・終点の座標からSVGパス文字列を生成する
 */
function buildPathData(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  connectorType: ConnectorType,
): string {
  const midX = x1 + (x2 - x1) / 2;

  if (connectorType === 'curved') {
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  }

  // デフォルト: 直角折れ線（orthogonal）
  return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
}

/**
 * 指定された試合の次ラウンド接続先マッチを解決する
 */
function resolveNextMatch(
  normalizedRounds: Match[][],
  roundIndex: number,
  match: Match,
): Match | null {
  if (match.nextMatchId) {
    for (const roundMatches of normalizedRounds) {
      const found = roundMatches.find((m) => getMatchKey(m) === match.nextMatchId);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const nextRound = normalizedRounds[roundIndex + 1];
  if (!nextRound || nextRound.length === 0) {
    return null;
  }

  const targetOrder = Math.floor(match.order / 2);
  return nextRound[targetOrder] ?? null;
}

/**
 * 指定された参加者キーがこの試合で勝利して次ラウンドへ進んだ（または両試合に登場する）かを判定する
 */
function isConnectorHighlightedForContestant(
  fromMatch: Match,
  toMatch: Match,
  highlightedContestantKey: string | null,
): boolean {
  if (!highlightedContestantKey) {
    return false;
  }

  const fromSides = fromMatch.sides ?? [];
  const toSides = toMatch.sides ?? [];

  const inFromAsWinner = fromSides.some(
    (side) => getContestantKey(side) === highlightedContestantKey && Boolean(side.isWinner),
  );
  if (inFromAsWinner) {
    return true;
  }

  const inFrom = fromSides.some((side) => getContestantKey(side) === highlightedContestantKey);
  const inTo = toSides.some((side) => getContestantKey(side) === highlightedContestantKey);
  return inFrom && inTo;
}

/**
 * DOM要素の実測座標をもとに、SVGレイヤーへすべての接続線（コネクタ）を描画する
 */
export function drawConnectors(
  rootEl: HTMLElement,
  svgEl: SVGSVGElement,
  normalizedRounds: Match[][],
  matchElements: Map<string, HTMLElement>,
  connectorType: ConnectorType = 'orthogonal',
  highlightedContestantKey: string | null = null,
): void {
  const rootRect = rootEl.getBoundingClientRect();
  const width = Math.max(rootEl.scrollWidth, Math.ceil(rootRect.width));
  const height = Math.max(rootEl.scrollHeight, Math.ceil(rootRect.height));

  if (width === 0 || height === 0) {
    svgEl.replaceChildren();
    return;
  }

  svgEl.setAttribute('width', String(width));
  svgEl.setAttribute('height', String(height));
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const normalSpecs: ConnectorSpec[] = [];
  const winnerSpecs: ConnectorSpec[] = [];
  const highlightedSpecs: ConnectorSpec[] = [];

  for (let roundIndex = 0; roundIndex < normalizedRounds.length - 1; roundIndex++) {
    const roundMatches = normalizedRounds[roundIndex];

    for (const match of roundMatches) {
      const nextMatch = resolveNextMatch(normalizedRounds, roundIndex, match);
      if (!nextMatch) {
        continue;
      }

      const fromKey = getMatchKey(match);
      const toKey = getMatchKey(nextMatch);
      const fromEl = matchElements.get(fromKey);
      const toEl = matchElements.get(toKey);
      if (!fromEl || !toEl) {
        continue;
      }

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      // 非表示ラウンドの要素間は接続線を描画しない
      if (fromRect.width === 0 || fromRect.height === 0 || toRect.width === 0 || toRect.height === 0) {
        continue;
      }

      const x1 = fromRect.right - rootRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - rootRect.top;
      const x2 = toRect.left - rootRect.left;
      const y2 = toRect.top + toRect.height / 2 - rootRect.top;

      const isWinner = (match.sides ?? []).some((side) => Boolean(side.isWinner));
      const isHighlighted = isConnectorHighlightedForContestant(
        match,
        nextMatch,
        highlightedContestantKey,
      );

      const spec: ConnectorSpec = {
        d: buildPathData(x1, y1, x2, y2, connectorType),
        isWinner,
        isHighlighted,
        fromKey,
        toKey,
      };

      if (isHighlighted) {
        highlightedSpecs.push(spec);
      } else if (isWinner) {
        winnerSpecs.push(spec);
      } else {
        normalSpecs.push(spec);
      }
    }
  }

  const fragment = document.createDocumentFragment();

  // 通常線 -> 勝者線 -> ハイライト線 の順に描画して重なり時の視認性を高める
  for (const spec of [...normalSpecs, ...winnerSpecs, ...highlightedSpecs]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', spec.d);

    const classes = ['ml-connector'];
    if (spec.isWinner) {
      classes.push('ml-connector--winner');
    }
    if (spec.isHighlighted) {
      classes.push('ml-connector--highlighted');
    }
    path.setAttribute('class', classes.join(' '));
    path.setAttribute('data-from', spec.fromKey);
    path.setAttribute('data-to', spec.toKey);
    fragment.appendChild(path);
  }

  svgEl.replaceChildren(fragment);
}
