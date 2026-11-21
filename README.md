# matchline

依存ゼロ・Vanilla TypeScript製のトーナメント表（ブラケット）描画ライブラリです。
[bracketry](https://bracketry.app/) の使い勝手を参考に、React や Vue などのフレームワークに依存せず Pure DOM API と SVG API のみで動作するよう設計されています。

## 主な特徴

- **ランタイム依存ゼロ**: 軽量でどのフロントエンド環境でも利用可能
- **ハイブリッド描画**:
  - 試合カードは HTML DOM（Flexbox）で構築し、テキスト省略・CSSカスタマイズ・イベント処理が容易
  - 接続線（コネクタ）は背面 `<svg>` に `<path>` で描画し、`ResizeObserver` によりリサイズ時も自動追従
- **勝ち上がりパス・ハイライト**: チームをクリックまたはホバーすると、そのチームの全ラウンドの戦績とSVG接続線を強調表示
- **ラウンドナビゲーション＆モバイル対応**: 左右ボタン・ラウンドピルで移動可能。`visibleRoundsCount` 指定時は表示ラウンドを絞ってコンパクトに表示
- **競技に合わせた表現**: 単一スコア・複数セットスコア（タイブレーク上付き表記含む）、`LIVE` バッジ、サーブ権ドット、3位決定戦に対応
- **拡張性**: `renderTeam` / `renderMatchHeader` によるカスタムレンダリングと、`updateMatches()` による特定試合の部分更新APIを提供
- **テーマカスタマイズ**: CSSカスタムプロパティ（`--ml-*`）で簡単に見た目を変更可能

## インストール

```bash
npm install matchline
```

## 基本的な使い方

```ts
import { createBracket, type BracketData } from 'matchline';
import 'matchline/style.css';

const data: BracketData = {
  rounds: [
    {
      name: '準決勝',
      matches: [
        {
          id: 'm1',
          venue: '第1コート',
          startTime: '2026-11-21T13:00:00+09:00', // "13:00" や Date も指定可能
          status: 'completed',
          teams: [
            { id: 't1', seed: 1, name: 'チームA', score: [6, { main: 7, sub: 5, isWinner: true }], isWinner: true },
            { id: 't2', seed: 4, name: 'チームB', score: [4, { main: 6, sub: 3 }] },
          ],
        },
        {
          id: 'm2',
          status: 'completed',
          teams: [
            { id: 't3', seed: 2, name: 'チームC', score: [3, 4] },
            { id: 't4', seed: 3, name: 'チームD', score: [6, 6], isWinner: true },
          ],
        },
      ],
    },
    {
      name: '決勝',
      matches: [
        {
          id: 'm3',
          venue: 'センターコート',
          startTime: '17:00',
          status: 'live',
          teams: [
            { id: 't1', seed: 1, name: 'チームA', score: [6, 4], isServing: true },
            { id: 't4', seed: 3, name: 'チームD', score: [4, 4] },
          ],
        },
      ],
    },
  ],
  thirdPlaceTitle: '3位決定戦',
  thirdPlaceMatch: {
    id: 'm-3rd',
    status: 'scheduled',
    teams: [
      { id: 't2', seed: 4, name: 'チームB', score: null },
      { id: 't3', seed: 2, name: 'チームC', score: null },
    ],
  },
};

const container = document.getElementById('bracket')!;
const bracket = createBracket(container, data, {
  connectorType: 'orthogonal', // 'orthogonal' | 'curved'
  highlightTeamHistory: true,
  highlightTrigger: 'click', // 'click' | 'hover'
  showNavigation: true,
  onMatchClick: (match, ctx) => {
    console.log('試合クリック:', match.id, ctx.round?.name);
  },
});

// 特定試合のみを部分更新（ライブスコア更新など）
bracket.updateMatches([
  {
    id: 'm3',
    status: 'completed',
    teams: [
      { id: 't1', seed: 1, name: 'チームA', score: [6, 6], isWinner: true },
      { id: 't4', seed: 3, name: 'チームD', score: [4, 4] },
    ],
  },
]);

// プログラムからの操作
bracket.highlightTeam('t1');
bracket.focusTeam('t1'); // 該当試合へスクロール＆ハイライト
bracket.moveToNextRound();
bracket.destroy();
```

## 大規模トーナメントの自動生成（`generateBracketData`）

16 / 32 / 64 チームや、2のべき乗でないチーム数（BYE自動配置）から標準シード順の `BracketData` を自動生成できます。

```ts
import { createBracket, generateBracketData } from 'matchline';

const teams = Array.from({ length: 32 }, (_, i) => ({
  id: `team-${i + 1}`,
  name: `チーム${i + 1}`,
}));

const data = generateBracketData(teams, {
  includeThirdPlace: true,
  venues: ['第1コート', '第2コート', '第3コート', '第4コート'],
});

const bracket = createBracket(document.getElementById('bracket')!, data, {
  visibleRoundsCount: 3, // 3ラウンドずつ表示してナビゲーションで切り替え
});
```

## CSSカスタムプロパティによるテーマ変更

`.ml-container` に対して CSSカスタムプロパティを上書きすることでデザインをカスタマイズできます。

```css
.ml-container {
  --ml-card-bg: #1e293b;
  --ml-card-border: #334155;
  --ml-text-color: #f1f5f9;
  --ml-line-color: #334155;
  --ml-line-highlight-color: #38bdf8;
  --ml-highlight-color: #38bdf8;
}
```

## 開発コマンド

```bash
# 依存パッケージのインストール
npm install

# ライブラリのビルド（ESM / CJS / 型定義 / CSS）
npm run build

# 型チェック
npm run typecheck

# デモページの起動（Vite）
npm run dev
```
