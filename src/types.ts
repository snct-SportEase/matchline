/**
 * 会場・コート情報（matchline 拡張）
 * - 文字列（例: "第1コート"）または色・ID付きオブジェクトを指定可能
 */
export type MatchVenue =
  | string
  | {
      /** 会場・コートの一意なID（任意） */
      id?: string;
      /** 表示名（例: "第1コート", "Aコート"） */
      name: string;
      /** 識別用のアクセントカラー（例: "#2563eb"） */
      color?: string;
    };

/**
 * 参加者内の個人選手情報（Bracketry 互換）
 */
export interface Player {
  /** 選手名またはチーム名 */
  title: string;
  /** 国籍・地域・国旗絵文字など（任意） */
  nationality?: string;
}

/**
 * 参加者（チーム／個人／ダブルスペア）情報（Bracketry 互換）
 */
export interface Contestant {
  /** シード番号や予選ステータス（例: "1", "WC", "Q"） */
  entryStatus?: string;
  /** 所属選手一覧（シングルスやチーム戦は1要素、ダブルスは2要素） */
  players: Player[];
}

/**
 * 1セット・1ゲーム分のスコア（Bracketry 互換）
 */
export interface Score {
  /** メインスコア（例: 6, 7） */
  mainScore: number | string;
  /** タイブレーク等の補足スコア（上付き文字で表示。例: 5） */
  subscore?: number | string;
  /** このセットの勝者かどうか */
  isWinner?: boolean;
}

/**
 * 試合の片側スロット情報（Bracketry 互換 + matchline 拡張）
 */
export interface Side {
  /** contestants 辞書を参照する参加者ID */
  contestantId?: string;
  /** contestants を使わず直接表示するタイトル（任意） */
  title?: string;
  /** セット・イニングごとのスコア配列 */
  scores?: Score[];
  /** 進行中ゲームの現在ポイント（例: "30", "AD"） */
  currentScore?: number | string;
  /** 現在サーブ権を持っているか */
  isServing?: boolean;
  /** この試合の勝者かどうか */
  isWinner?: boolean;
  /** BYE（不戦勝）スロットかどうか（matchline 拡張） */
  isBye?: boolean;
}

/**
 * 1試合を表すデータ構造（Bracketry 互換 + matchline 拡張）
 */
export interface Match {
  /** 属するラウンドのインデックス（0始まり） */
  roundIndex: number;
  /** ラウンド内での縦方向の並び順（0始まり） */
  order: number;
  /** 対戦する2スロット（通常は最大2要素） */
  sides?: Side[];
  /** 試合ステータス表示テキスト（例: "Scheduled", "Walkover", "試合終了"） */
  matchStatus?: string;
  /** 試合が進行中（LIVE）かどうか */
  isLive?: boolean;
  /** 3位決定戦かどうか（Bracketry 互換: boolean または文字列） */
  isBronzeMatch?: boolean | string;

  // --- 以下 matchline 拡張フィールド（すべて任意） ---
  /** 明示的なマッチID（省略時は roundIndex / order から自動生成） */
  id?: string;
  /** 通し試合番号（例: 12 → "#12"、または "M-12"） */
  matchNumber?: number | string;
  /** 次ラウンドの接続先マッチID（変則トーナメント用・省略時は自動計算） */
  nextMatchId?: string;
  /** 試合開始日時（"14:00" 等の文字列、ISO 8601 文字列、または Date オブジェクト） */
  startTime?: string | Date;
  /** 会場・コート情報（例: "第1コート", { name: "Aコート", color: "#2563eb" }） */
  venue?: MatchVenue;
  /** 試合カード上部に表示する補助ラベル（例: "第1試合", "決勝戦"） */
  label?: string;
  /** isLive === true 時のバッジ表示テキスト（デフォルト: "LIVE"） */
  liveLabel?: string;
  /** 利用側が自由に付与できるメタデータ（任意） */
  meta?: Record<string, unknown>;
}

/**
 * applyMatchesUpdates / updateMatches で特定試合を部分更新するための型
 * roundIndex + order または id のいずれかで対象試合を特定する
 */
export type MatchUpdate = Partial<Match> &
  ({ roundIndex: number; order: number } | { id: string } | { isBronzeMatch: true | string });

/**
 * 1ラウンドを表すデータ構造（Bracketry 互換）
 */
export interface Round {
  /** ラウンドID（任意） */
  id?: string;
  /** ラウンド表示名（例: "1回戦", "準々決勝", "準決勝", "決勝"） */
  name?: string;
}

/**
 * トーナメント全体を表すデータ構造（Bracketry 完全互換）
 */
export interface BracketData {
  /** 左から右へ進行するラウンド配列 */
  rounds: Round[];
  /** 全ラウンドの試合一覧（未登録の将来ラウンド枠は自動補完される） */
  matches?: Match[];
  /** 参加者辞書（key = contestantId） */
  contestants?: Record<string, Contestant>;
}

/**
 * コネクタ（SVG接続線）の描画形状
 * - `orthogonal`: 直角折れ線（標準的なトーナメント表）
 * - `curved`: 滑らかな3次ベジェ曲線
 */
export type ConnectorType = 'orthogonal' | 'curved';

/**
 * 参加者の勝ち上がりパス・ハイライトのトリガー方式
 */
export type HighlightTrigger = 'click' | 'hover';

/**
 * ビルトインテーマ名
 */
export type BuiltinTheme = 'light' | 'dark' | 'emerald';

/**
 * テーマ指定（ビルトインテーマ名、または CSSカスタムプロパティの上書きマップ）
 */
export type BracketTheme = BuiltinTheme | Record<string, string>;

/**
 * 縦スクロール操作モード（Bracketry 互換）
 */
export type VerticalScrollMode = 'native' | 'buttons' | 'mixed';

/**
 * ナビゲーションボタンの配置位置
 */
export type NavButtonsPosition = 'top' | 'gutters' | 'overTitles' | 'overMatches' | 'hidden';

/**
 * 縦スクロールボタンの配置位置
 */
export type ScrollButtonsPosition = 'gutters' | 'overMatches' | 'hidden';

/**
 * カスタムHTMLフックの戻り値型
 */
export type CustomMarkupResult = string | HTMLElement | null | undefined;

/**
 * 試合カードクリック時にコールバックへ渡されるコンテキスト情報
 */
export interface MatchClickContext {
  /** クリックされた試合が属するラウンドのインデックス */
  roundIndex: number;
  /** ラウンド内での並び順 */
  order: number;
  /** クリックされた試合が属するラウンドデータ */
  round: Round | null;
  /** 3位決定戦かどうか */
  isBronzeMatch: boolean;
  /** クリックされた試合カードのDOM要素 */
  element: HTMLElement;
  /** 元となったDOMイベント */
  event: MouseEvent | KeyboardEvent;
}

/**
 * 参加者スロット（Side）クリック時にコールバックへ渡されるコンテキスト情報
 */
export interface SideClickContext extends MatchClickContext {
  /** クリックされた試合データ */
  match: Match;
  /** スロット位置（0: 上側, 1: 下側） */
  sideIndex: 0 | 1;
  /** 解決された参加者情報（contestants 辞書に存在する場合） */
  contestant: Contestant | null;
  /** 参加者の識別キー（contestantId ?? title） */
  contestantKey: string | null;
}

/**
 * カスタムレンダラー（renderSide / getEntryStatusHTML）へ渡されるコンテキスト情報
 */
export interface SideRenderContext {
  match: Match;
  contestant: Contestant | null;
  roundIndex: number;
  order: number;
  sideIndex: 0 | 1;
  isBronzeMatch: boolean;
}

/**
 * 選手単位カスタムフック（getNationalityHTML / getPlayerTitleHTML）のコンテキスト
 */
export interface PlayerRenderContext extends SideRenderContext {
  playerIndex: number;
  contestantId?: string;
}

/**
 * カスタムレンダラー（renderMatchHeader）へ渡されるコンテキスト情報
 */
export interface MatchRenderContext {
  roundIndex: number;
  order: number;
  isBronzeMatch: boolean;
}

/**
 * ラウンドナビゲーションの現在状態
 */
export interface NavigationState {
  /** 現在先頭に表示されているラウンドのインデックス（0始まり） */
  baseRoundIndex: number;
  /** 全ラウンド数 */
  totalRounds: number;
  /** 同時に表示するラウンド数 */
  visibleRoundsCount: number;
  /** 前のラウンドへ移動可能か */
  canGoPrevious: boolean;
  /** 次のラウンドへ移動可能か */
  canGoNext: boolean;
}

/**
 * ブラケット描画時のオプション設定（Bracketry 互換 + matchline 拡張）
 */
export interface BracketOptions {
  // --- テーマ・基本表示 ---
  /** テーマ設定（デフォルト: 'light'）。CSS変数オブジェクトも指定可能 */
  theme?: BracketTheme;
  /** 接続線の形状（デフォルト: 'orthogonal'） */
  connectorType?: ConnectorType;
  /** 参加者未定時に表示するラベル（デフォルト: 'TBD'） */
  tbdLabel?: string;
  /** BYEスロット時に表示するラベル（デフォルト: 'BYE'） */
  byeLabel?: string;
  /** 3位決定戦の見出しラベル（デフォルト: '3位決定戦'） */
  bronzeMatchTitle?: string;
  /** ラウンド見出しを表示するかどうか（デフォルト: true） */
  showRoundHeaders?: boolean;
  /** 試合開始時間（match.startTime）を表示するかどうか（デフォルト: true） */
  showStartTime?: boolean;
  /** 試合開始時間（match.startTime）の表示文字列をカスタム整形する関数 */
  formatStartTime?: (startTime: string | Date, match: Match) => string;
  /** 会場・コート（match.venue）を表示するかどうか（デフォルト: true） */
  showVenue?: boolean;
  /** 会場・コート（match.venue）の表示文字列をカスタム整形する関数 */
  formatVenue?: (venue: MatchVenue, match: Match) => string;
  /** 通し試合番号（match.matchNumber）を表示するかどうか（デフォルト: true） */
  showMatchNumber?: boolean;
  /** matchNumber 未指定の試合にも1回戦から通し番号を自動採番するか（デフォルト: false） */
  autoMatchNumbers?: boolean;
  /** 試合番号の表示文字列をカスタム整形する関数（デフォルト: 数値なら "#1"） */
  formatMatchNumber?: (matchNumber: number | string, match: Match) => string;
  /** 2回戦以降の未定枠に「#1の勝者」「#5の敗者」等の進出元ラベルを表示するか（デフォルト: true） */
  showSourcePlaceholder?: boolean;
  /** 勝者進出元プレースホルダーのカスタム整形関数 */
  formatWinnerPlaceholder?: (sourceMatchNumber: number | string, sourceMatch: Match) => string;
  /** 敗者進出元プレースホルダー（3位決定戦等）のカスタム整形関数 */
  formatLoserPlaceholder?: (sourceMatchNumber: number | string, sourceMatch: Match) => string;

  // --- インタラクション・コールバック ---
  /** 試合カードクリック（またはフォーカス時のEnter/Spaceキー）時のコールバック */
  onMatchClick?: (match: Match, context: MatchClickContext) => void;
  /** 参加者スロットクリック時のコールバック */
  onSideClick?: (side: Side, context: SideClickContext) => void;
  /** Bracketry 互換: 参加者スロットクリック時のコールバック */
  onMatchSideClick?: (match: Match, sideIndex: 0 | 1, context: SideClickContext) => void;
  /** 参加者の勝ち上がりパス・ハイライトを有効にするか（デフォルト: true） */
  highlightContestantHistory?: boolean;
  /** Bracketry 互換: true を指定すると勝ち上がりパス・ハイライトを無効化 */
  disableHighlight?: boolean;
  /** 勝ち上がりパス・ハイライトの発火トリガー（デフォルト: 'click'） */
  highlightTrigger?: HighlightTrigger;

  // --- ナビゲーション・スクロール・レイアウト制御 ---
  /** ラウンドナビゲーションバーを表示するか（デフォルト: true） */
  showNavigation?: boolean;
  /** ナビゲーションボタンの配置位置（デフォルト: 'top'） */
  navButtonsPosition?: NavButtonsPosition;
  /** 縦スクロール操作モード（デフォルト: 'native'） */
  verticalScrollMode?: VerticalScrollMode;
  /** 縦スクロールボタンの配置位置（verticalScrollMode が 'buttons' / 'mixed' 時に有効） */
  scrollButtonsPosition?: ScrollButtonsPosition;
  /** ラウンド移動時に縦スクロール位置を先頭へ戻すか（デフォルト: false） */
  resetScrollOnNavigation?: boolean;
  /**
   * 同時に表示するラウンド数（任意）
   * - 数値: 指定数だけ表示し左右ナビでスライド移動
   * - 'auto': ビューポート幅に応じて表示ラウンド数を自動レスポンシブ調整
   */
  visibleRoundsCount?: number | 'auto';
  /** 初期表示の開始ラウンドインデックス（デフォルト: 0） */
  initialBaseRoundIndex?: number;
  /**
   * Bracketry 互換: true の場合、ラウンド移動時も1回戦基準の縦高さを維持する
   * （デフォルト: false = 表示ラウンドに合わせて縦高さを詰める）
   */
  useClassicalLayout?: boolean;
  /** 前へナビゲーションボタンのカスタムHTML */
  leftNavButtonHTML?: string;
  /** 次へナビゲーションボタンのカスタムHTML */
  rightNavButtonHTML?: string;
  /** 上スクロールボタンのカスタムHTML */
  scrollUpButtonHTML?: string;
  /** 下スクロールボタンのカスタムHTML */
  scrollDownButtonHTML?: string;

  // --- スマホ・大規模閲覧向けズーム＆ドラッグパン ---
  /** ズーム操作（ピンチズーム・Ctrl+ホイール・ズームボタン）を有効にするか（デフォルト: false） */
  enableZoom?: boolean;
  /** マウスドラッグによるパン移動を有効にするか（タッチ端末はネイティブ慣性スクロールを使用。デフォルト: false） */
  enablePan?: boolean;
  /** 初期ズーム倍率（デフォルト: 1） */
  initialZoom?: number;
  /** 最小ズーム倍率（デフォルト: 0.4） */
  minZoom?: number;
  /** 最大ズーム倍率（デフォルト: 1.8） */
  maxZoom?: number;
  /** zoomIn / zoomOut の1ステップあたりの倍率増減（デフォルト: 0.15） */
  zoomStep?: number;
  /** 右下にズーム操作コントロール（− / 100% / ＋）を表示するか（デフォルト: enableZoom と同じ） */
  showZoomControls?: boolean;

  // --- パーツ単位のカスタムHTML差し替えフック（Bracketry 互換） ---
  /** 国籍・国旗表示のカスタムHTMLフック */
  getNationalityHTML?: (player: Player, context: PlayerRenderContext) => CustomMarkupResult;
  /** シード番号・エントリーステータスのカスタムHTMLフック */
  getEntryStatusHTML?: (entryStatus: string, context: SideRenderContext) => CustomMarkupResult;
  /** 選手名・チーム名表示のカスタムHTMLフック */
  getPlayerTitleHTML?: (player: Player, context: PlayerRenderContext) => CustomMarkupResult;
  /** 試合カード上部に差し込むカスタムHTMLフック */
  getMatchTopHTML?: (match: Match) => CustomMarkupResult;
  /** 試合カード下部に差し込むカスタムHTMLフック */
  getMatchBottomHTML?: (match: Match) => CustomMarkupResult;
  /** スコア部分のカスタムHTMLフック */
  getScoresHTML?: (side: Side, match: Match) => CustomMarkupResult;
  /** 試合カード要素そのものを自前DOMへ完全差し替えするフック */
  getMatchElement?: (roundIndex: number, matchOrder: number) => HTMLElement | null | undefined;
  /** 参加者スロット行のカスタムレンダラー */
  renderSide?: (side: Side | null, context: SideRenderContext) => CustomMarkupResult;
  /** 試合カードヘッダーのカスタムレンダラー */
  renderMatchHeader?: (match: Match, context: MatchRenderContext) => CustomMarkupResult;

  // --- JSオプション経由のスタイル指定（Bracketry 互換、内部で --ml-* へ自動適用） ---
  /** ルート背景色 */
  rootBgColor?: string;
  /** 上下パディング（px） */
  mainVerticalPadding?: number;
  /** ラウンド見出しのフォントサイズ（px） */
  roundTitlesFontSize?: number;
  /** ラウンド見出しの文字色 */
  roundTitlesFontColor?: string;
  /** 試合カードのフォントサイズ（px） */
  matchFontSize?: number;
  /** 試合カードの文字色 */
  matchTextColor?: string;
  /** 試合カード間の最小縦余白（px） */
  matchMinVerticalGap?: number;
  /** 試合カードの幅（px） */
  matchMaxWidth?: number;
  /** ラウンド列間の横余白（px） */
  roundGap?: number;
  /** スコアセル間の間隔（px） */
  distanceBetweenScorePairs?: number;
  /** SVG接続線の太さ（px） */
  connectionLinesWidth?: number;
  /** SVG接続線の通常色 */
  connectionLinesColor?: string;
  /** ハイライト時のSVG接続線色 */
  highlightedConnectionLinesColor?: string;
  /** ハイライト時の参加者文字・アクセント色 */
  highlightedPlayerTitleColor?: string;
  /** LIVE試合の枠線・バッジ色 */
  liveMatchBorderColor?: string;
  /** ハイライト時に非対象要素を薄くしない（true で不透明度1を維持） */
  disableOpacity?: boolean;
}

/**
 * createBracket が返す操作用インスタンス（Bracketry 互換メソッドを含む）
 */
export interface BracketInstance {
  /** データまたはオプションを更新して再描画する */
  update: (data: BracketData, options?: Partial<BracketOptions>) => void;
  /** Bracketry 互換: トーナメントデータを丸ごと差し替える */
  replaceData: (data: BracketData) => void;
  /** Bracketry 互換: オプションを更新して再描画する */
  applyNewOptions: (options: Partial<BracketOptions>) => void;
  /** Bracketry 互換: 現在保持しているトーナメントデータを取得する */
  getAllData: () => BracketData;
  /** Bracketry 互換: 現在適用されているオプションを取得する */
  getUserOptions: () => BracketOptions;
  /** 指定した試合データだけを部分更新して再描画する */
  updateMatches: (updates: MatchUpdate[]) => void;
  /** Bracketry 互換: updateMatches のエイリアス */
  applyMatchesUpdates: (updates: MatchUpdate[]) => void;
  /** 指定した参加者ID（またはタイトル）の勝ち上がりパスをハイライト／解除する */
  highlightContestantHistory: (contestantId: string | null) => void;
  /** 指定したコートIDまたはコート名に該当する試合だけを強調表示する（null で解除） */
  highlightVenue: (venue: string | null) => void;
  /** 進行中（isLive: true）の試合だけを強調表示する（false で解除） */
  highlightLiveMatches: (active?: boolean) => void;
  /** 参加者パス・コート・LIVEのすべてのハイライト状態を解除する */
  clearHighlight: () => void;
  /** 指定した参加者をハイライトし、該当する試合カードへスクロールする */
  focusContestant: (contestantId: string) => boolean;
  /** 前のラウンドへ移動する */
  moveToPreviousRound: () => void;
  /** 次のラウンドへ移動する */
  moveToNextRound: () => void;
  /** 最終ラウンドが見える位置へ移動する */
  moveToLastRound: () => void;
  /** 表示基準となる開始ラウンドインデックスを設定する */
  setBaseRoundIndex: (index: number) => void;
  /** 現在のナビゲーション状態を取得する */
  getNavigationState: () => NavigationState;
  /** ズーム倍率を設定する（minZoom〜maxZoom の範囲に自動クランプ） */
  setZoom: (scale: number) => void;
  /** ズームイン（zoomStep 分拡大）する */
  zoomIn: () => void;
  /** ズームアウト（zoomStep 分縮小）する */
  zoomOut: () => void;
  /** ズーム倍率を 1.0 にリセットする */
  resetZoom: () => void;
  /** 現在のズーム倍率を取得する */
  getZoom: () => number;
  /** SVG接続線の座標を再計算して再描画する */
  redrawConnectors: () => void;
  /** DOM要素・イベントリスナー・ResizeObserverを破棄してクリーンアップする */
  destroy: () => void;
  /** Bracketry 互換: destroy のエイリアス */
  uninstall: () => void;
}
