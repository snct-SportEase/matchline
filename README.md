# matchline

依存ゼロ・Vanilla TypeScript製のトーナメント表（ブラケット）描画ライブラリです。
[bracketry](https://bracketry.app/) のデータ構造（`rounds` / `matches` / `contestants` / `sides` / `scores`）と高い互換性を持ち、既存の `bracketry` からの移行もスムーズに行えます。

## 主な特徴

- **ランタイム依存ゼロ**: Pure TypeScript / DOM API / SVG API のみで動作
- **Bracketry 互換データ構造＆API**:
  - `{ rounds, matches, contestants }` 形式をそのまま受け入れ可能（未登録の将来ラウンド枠も自動補完）
  - `createBracket(data, container, options)` / `createBracket(container, data, options)` の両方の引数順に対応
  - `replaceData` / `applyMatchesUpdates` / `applyNewOptions` / `highlightContestantHistory` / `uninstall` などの互換メソッドを標準搭載
- **ハイブリッド描画**:
  - 試合カードは HTML DOM（Flexbox）で構築し、テキスト省略・CSSカスタマイズ・イベント処理が容易
  - 接続線（コネクタ）は背面 `<svg>` に `<path>` で描画し、`ResizeObserver` によりリサイズ時も自動追従
- **大会運営向けの拡張機能**:
  - 試合開始日時（`startTime`）、会場・コート（`venue`、色識別子対応）、補助ラベル（`label`）
  - 複数セットスコア・タイブレーク（`subscore`）・現在ポイント（`currentScore`）・サーブ権（`isServing`）・`isLive`・3位決定戦（`isBronzeMatch`）
  - 16 / 32 / 64チーム以上の大規模トーナメント自動生成（`generateBracketData`）＆BYE自動配置

## インストール

```bash
npm install matchline
```

## 基本的な使い方（Bracketry 互換形式）

```ts
import { createBracket, type BracketData } from 'matchline';
import 'matchline/style.css';

const data: BracketData = {
  rounds: [{ name: '準決勝' }, { name: '決勝' }],
  contestants: {
    c1: { entryStatus: '1', players: [{ title: '東京サンダーズ', nationality: '🇯🇵' }] },
    c2: { entryStatus: '4', players: [{ title: '大阪スターズ', nationality: '🇯🇵' }] },
    c3: { entryStatus: '2', players: [{ title: '福岡ウェーブス', nationality: '🇯🇵' }] },
    c4: { entryStatus: '3', players: [{ title: '横浜ベイサイド', nationality: '🇯🇵' }] },
  },
  matches: [
    {
      roundIndex: 0,
      order: 0,
      venue: '第1コート',
      startTime: '2026-11-21T13:00:00+09:00',
      sides: [
        {
          contestantId: 'c1',
          isWinner: true,
          scores: [
            { mainScore: 6, isWinner: true },
            { mainScore: 7, subscore: 5, isWinner: true },
          ],
        },
        {
          contestantId: 'c2',
          scores: [{ mainScore: 4 }, { mainScore: 6, subscore: 3 }],
        },
      ],
    },
    {
      roundIndex: 0,
      order: 1,
      venue: '第2コート',
      startTime: '13:00',
      sides: [
        { contestantId: 'c3', scores: [{ mainScore: 3 }, { mainScore: 4 }] },
        {
          contestantId: 'c4',
          isWinner: true,
          scores: [
            { mainScore: 6, isWinner: true },
            { mainScore: 6, isWinner: true },
          ],
        },
      ],
    },
    {
      roundIndex: 1,
      order: 0,
      venue: { id: 'center', name: 'センターコート', color: '#ef4444' },
      startTime: '17:00',
      isLive: true,
      sides: [
        { contestantId: 'c1', scores: [{ mainScore: 6, isWinner: true }, { mainScore: 4 }], currentScore: '30', isServing: true },
        { contestantId: 'c4', scores: [{ mainScore: 4 }, { mainScore: 4 }], currentScore: '15' },
      ],
    },
  ],
};

const container = document.getElementById('bracket')!;
const bracket = createBracket(data, container, {
  theme: 'light', // 'light' | 'dark' | 'emerald' または { '--ml-line-color': '#...' }
  connectorType: 'orthogonal', // 'orthogonal' | 'curved'
  highlightContestantHistory: true,
  highlightTrigger: 'click', // 'click' | 'hover'
  showNavigation: true,
});

// 特定試合のみを部分更新（Bracketry 互換）
bracket.applyMatchesUpdates([
  {
    roundIndex: 1,
    order: 0,
    venue: '第3コート',
    startTime: '17:30',
  },
]);

// プログラムからの操作
bracket.highlightContestantHistory('c1');
bracket.focusContestant('c1');
bracket.moveToNextRound();
bracket.uninstall(); // または bracket.destroy()
```

## 大規模トーナメントの自動生成（`generateBracketData`）

```ts
import { createBracket, generateBracketData } from 'matchline';

const entries = Array.from({ length: 32 }, (_, i) => ({
  id: `team-${i + 1}`,
  title: `チーム${i + 1}`,
}));

const data = generateBracketData(entries, {
  includeBronzeMatch: true,
  venues: ['第1コート', '第2コート', '第3コート', '第4コート'],
});

const bracket = createBracket(data, document.getElementById('bracket')!, {
  visibleRoundsCount: 3,
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
npm install      # 依存パッケージのインストール
npm run build    # ライブラリのビルド（ESM / CJS / 型定義 / CSS）
npm run typecheck # 型チェック
npm run dev      # デモページの起動（Vite）
```
