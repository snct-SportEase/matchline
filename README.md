# matchline

依存ゼロ・Vanilla TypeScript製のトーナメント表（ブラケット）描画ライブラリです。
React や Vue などのフレームワークに依存せず、Pure DOM API と SVG API のみで動作します。

## 特徴

- **ランタイム依存ゼロ**: 軽量でどのフロントエンド環境でも利用可能
- **ハイブリッド描画**:
  - 試合カードは HTML DOM（Flexbox）で構築し、テキスト省略・CSSカスタマイズ・イベント処理が容易
  - 接続線（コネクタ）は背面 `<svg>` に `<path>` で描画し、`ResizeObserver` によりリサイズ時も自動追従
- **テーマカスタマイズ**: CSSカスタムプロパティ（`--ml-*`）で簡単に見た目を変更可能
- **TypeScript完全対応**: 型定義ファイル（`.d.ts`）を同梱

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
          teams: [
            { name: 'チームA', score: 2, isWinner: true },
            { name: 'チームB', score: 1 },
          ],
        },
        {
          id: 'm2',
          teams: [
            { name: 'チームC', score: 0 },
            { name: 'チームD', score: 3, isWinner: true },
          ],
        },
      ],
    },
    {
      name: '決勝',
      matches: [
        {
          id: 'm3',
          teams: [
            { name: 'チームA', score: null },
            { name: 'チームD', score: null },
          ],
        },
      ],
    },
  ],
};

const container = document.getElementById('bracket')!;
const bracket = createBracket(container, data, {
  connectorType: 'orthogonal', // 'orthogonal' | 'curved'
  onMatchClick: (match, context) => {
    console.log('クリックされた試合:', match.id, context.round.name);
  },
});

// データの更新
// bracket.update(newData);

// 破棄（DOM・イベント・ResizeObserverのクリーンアップ）
// bracket.destroy();
```

## CSSカスタムプロパティによるテーマ変更

`.ml-container` に対して CSSカスタムプロパティを上書きすることでデザインをカスタマイズできます。

```css
.ml-container {
  --ml-card-bg: #1e293b;
  --ml-card-border: #334155;
  --ml-text-color: #f1f5f9;
  --ml-line-color: #475569;
  --ml-line-active-color: #38bdf8;
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
