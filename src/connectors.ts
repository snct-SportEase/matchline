import type { BracketData, ConnectorType, Match } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface ConnectorSpec {
  d: string;
  isWinner: boolean;
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
 * 指定された試合の次ラウンド接続先マッチIDを解決する
 */
function resolveNextMatchId(
  data: BracketData,
  roundIndex: number,
  matchIndex: number,
  match: Match,
): string | null {
  // 明示的に nextMatchId が指定されている場合はそれを優先する（変則トーナメントやBYE対応）
  if (match.nextMatchId) {
    return match.nextMatchId;
  }

  const nextRound = data.rounds[roundIndex + 1];
  if (!nextRound || nextRound.matches.length === 0) {
    return null;
  }

  // 標準的なシングルエリミネーション規則: 2試合が次ラウンドの1試合に収束する
  const targetIndex = Math.floor(matchIndex / 2);
  const targetMatch = nextRound.matches[targetIndex];
  return targetMatch ? targetMatch.id : null;
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
): void {
  const rootRect = rootEl.getBoundingClientRect();
  const width = Math.max(rootEl.scrollWidth, Math.ceil(rootRect.width));
  const height = Math.max(rootEl.scrollHeight, Math.ceil(rootRect.height));

  // コンテナが非表示などでサイズ0の場合はスキップする
  if (width === 0 || height === 0) {
    svgEl.replaceChildren();
    return;
  }

  svgEl.setAttribute('width', String(width));
  svgEl.setAttribute('height', String(height));
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const normalSpecs: ConnectorSpec[] = [];
  const winnerSpecs: ConnectorSpec[] = [];

  for (let roundIndex = 0; roundIndex < data.rounds.length - 1; roundIndex++) {
    const round = data.rounds[roundIndex];

    for (let matchIndex = 0; matchIndex < round.matches.length; matchIndex++) {
      const match = round.matches[matchIndex];
      const nextMatchId = resolveNextMatchId(data, roundIndex, matchIndex, match);
      if (!nextMatchId) {
        continue;
      }

      const fromEl = matchElements.get(match.id);
      const toEl = matchElements.get(nextMatchId);
      if (!fromEl || !toEl) {
        continue;
      }

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      // ルート要素左上を原点とした相対座標を計算
      const x1 = fromRect.right - rootRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - rootRect.top;
      const x2 = toRect.left - rootRect.left;
      const y2 = toRect.top + toRect.height / 2 - rootRect.top;

      const isWinner = match.teams.some((team) => Boolean(team?.isWinner));
      const spec: ConnectorSpec = {
        d: buildPathData(x1, y1, x2, y2, connectorType),
        isWinner,
        fromId: match.id,
        toId: nextMatchId,
      };

      if (isWinner) {
        winnerSpecs.push(spec);
      } else {
        normalSpecs.push(spec);
      }
    }
  }

  const fragment = document.createDocumentFragment();

  // 通常の接続線を先に描画し、勝者の接続線を後から描画して前面に表示する
  for (const spec of [...normalSpecs, ...winnerSpecs]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', spec.d);
    path.setAttribute(
      'class',
      spec.isWinner ? 'ml-connector ml-connector--winner' : 'ml-connector',
    );
    path.setAttribute('data-from', spec.fromId);
    path.setAttribute('data-to', spec.toId);
    fragment.appendChild(path);
  }

  svgEl.replaceChildren(fragment);
}
