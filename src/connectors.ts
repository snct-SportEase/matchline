import { getTeamKey } from './renderer';
import type { BracketData, ConnectorType, Match } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface ConnectorSpec {
  d: string;
  isWinner: boolean;
  isHighlighted: boolean;
  fromId: string;
  toId: string;
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
  data: BracketData,
  roundIndex: number,
  matchIndex: number,
  match: Match,
): Match | null {
  if (match.nextMatchId) {
    for (const round of data.rounds) {
      const found = round.matches.find((m) => m.id === match.nextMatchId);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const nextRound = data.rounds[roundIndex + 1];
  if (!nextRound || nextRound.matches.length === 0) {
    return null;
  }

  const targetIndex = Math.floor(matchIndex / 2);
  return nextRound.matches[targetIndex] ?? null;
}

/**
 * 指定されたチームキーがこの試合で勝利して次ラウンドへ進んだ（または両試合に登場する）かを判定する
 */
function isConnectorHighlightedForTeam(
  fromMatch: Match,
  toMatch: Match,
  highlightedTeamKey: string | null,
): boolean {
  if (!highlightedTeamKey) {
    return false;
  }

  const inFromAsWinner = fromMatch.teams.some(
    (team) => getTeamKey(team) === highlightedTeamKey && Boolean(team?.isWinner),
  );
  if (inFromAsWinner) {
    return true;
  }

  // 勝者フラグが未設定でも、前後両方の試合に同じチームがいれば勝ち上がりパスとみなす
  const inFrom = fromMatch.teams.some((team) => getTeamKey(team) === highlightedTeamKey);
  const inTo = toMatch.teams.some((team) => getTeamKey(team) === highlightedTeamKey);
  return inFrom && inTo;
}

/**
 * DOM要素の実測座標をもとに、SVGレイヤーへすべての接続線（コネクタ）を描画する
 */
export function drawConnectors(
  rootEl: HTMLElement,
  svgEl: SVGSVGElement,
  data: BracketData,
  matchElements: Map<string, HTMLElement>,
  connectorType: ConnectorType = 'orthogonal',
  highlightedTeamKey: string | null = null,
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

  for (let roundIndex = 0; roundIndex < data.rounds.length - 1; roundIndex++) {
    const round = data.rounds[roundIndex];

    for (let matchIndex = 0; matchIndex < round.matches.length; matchIndex++) {
      const match = round.matches[matchIndex];
      const nextMatch = resolveNextMatch(data, roundIndex, matchIndex, match);
      if (!nextMatch) {
        continue;
      }

      const fromEl = matchElements.get(match.id);
      const toEl = matchElements.get(nextMatch.id);
      if (!fromEl || !toEl) {
        continue;
      }

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      // ラウンドナビゲーション等で非表示（サイズ0）の要素間は接続線を描画しない
      if (fromRect.width === 0 || fromRect.height === 0 || toRect.width === 0 || toRect.height === 0) {
        continue;
      }

      const x1 = fromRect.right - rootRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - rootRect.top;
      const x2 = toRect.left - rootRect.left;
      const y2 = toRect.top + toRect.height / 2 - rootRect.top;

      const isWinner = match.teams.some((team) => Boolean(team?.isWinner));
      const isHighlighted = isConnectorHighlightedForTeam(match, nextMatch, highlightedTeamKey);

      const spec: ConnectorSpec = {
        d: buildPathData(x1, y1, x2, y2, connectorType),
        isWinner,
        isHighlighted,
        fromId: match.id,
        toId: nextMatch.id,
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
    path.setAttribute('data-from', spec.fromId);
    path.setAttribute('data-to', spec.toId);
    fragment.appendChild(path);
  }

  svgEl.replaceChildren(fragment);
}
