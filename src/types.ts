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
 * カスタムレンダラー（renderSide）へ渡されるコンテキスト情報
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
 * ビルトインテーマ名
 */
export type BuiltinTheme = 'light' | 'dark' | 'emerald';

/**
 * テーマ指定（ビルトインテーマ名、または CSSカスタムプロパティの上書きマップ）
 */
export type BracketTheme = BuiltinTheme | Record<string, string>;

/**
 * ブラケット描画時のオプション設定
 */
export interface BracketOptions {
  /** テーマ設定（デフォルト: 'light'）。CSS変数オブジェクト（例: { '--ml-line-color': '#...' }）も指定可能 */
  theme?: BracketTheme;
  /** 試合カードクリック（またはフォーカス時のEnter/Spaceキー）時のコールバック */
  onMatchClick?: (match: Match, context: MatchClickContext) => void;
  /** 参加者スロットクリック時のコールバック */
  onSideClick?: (side: Side, context: SideClickContext) => void;
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
  /** 参加者の勝ち上がりパス・ハイライトを有効にするか（デフォルト: true） */
  highlightContestantHistory?: boolean;
  /** 勝ち上がりパス・ハイライトの発火トリガー（デフォルト: 'click'） */
  highlightTrigger?: HighlightTrigger;
  /** ラウンドナビゲーションバーを表示するか（デフォルト: true） */
  showNavigation?: boolean;
  /**
   * 同時に表示するラウンド数の上限（任意）
   * 指定すると baseRoundIndex から指定数だけ表示し、左右ナビゲーションでスライド移動できる
   */
  visibleRoundsCount?: number;
  /** 初期表示の開始ラウンドインデックス（デフォルト: 0） */
  initialBaseRoundIndex?: number;
  /** 参加者スロットのカスタムレンダラー（null を返すとデフォルト描画にフォールバック） */
  renderSide?: (side: Side | null, context: SideRenderContext) => HTMLElement | string | null;
  /** 試合カードヘッダーのカスタムレンダラー（null を返すとデフォルト描画にフォールバック） */
  renderMatchHeader?: (match: Match, context: MatchRenderContext) => HTMLElement | string | null;
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
  /** 指定した試合データだけを部分更新して再描画する */
  updateMatches: (updates: MatchUpdate[]) => void;
  /** Bracketry 互換: updateMatches のエイリアス */
  applyMatchesUpdates: (updates: MatchUpdate[]) => void;
  /** 指定した参加者ID（またはタイトル）の勝ち上がりパスをハイライト／解除する */
  highlightContestantHistory: (contestantId: string | null) => void;
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
  /** SVG接続線の座標を再計算して再描画する */
  redrawConnectors: () => void;
  /** DOM要素・イベントリスナー・ResizeObserverを破棄してクリーンアップする */
  destroy: () => void;
  /** Bracketry 互換: destroy のエイリアス */
  uninstall: () => void;
}
