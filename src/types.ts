/**
 * 複数セット競技（テニス・卓球・バレーボール等）の1セット分スコア
 */
export interface SetScore {
  /** メインスコア（例: 7） */
  main: number | string;
  /** タイブレーク等の補足スコア（上付き文字で表示。例: 5） */
  sub?: number | string;
  /** このセットの勝者かどうか */
  isWinner?: boolean;
}

/**
 * チームスコアの表現形式
 * - 単一スコア: number | string（例: 2, "W"）
 * - 複数セットスコア: 配列（例: [6, 4, { main: 7, sub: 5, isWinner: true }]）
 */
export type MatchScore = number | string | Array<number | string | SetScore>;

/**
 * 試合に参加するチーム（または選手）のスロット情報
 */
export interface MatchTeam {
  /** チームの一意なID（勝ち上がりパス・ハイライトの識別に優先使用される） */
  id?: string;
  /** チーム名（未定の場合は省略可能） */
  name?: string;
  /** 国旗絵文字や短いバッジテキスト（任意） */
  flag?: string;
  /** シード番号（任意） */
  seed?: number;
  /** スコア（単一スコアまたは複数セット配列。未実施時は undefined または null） */
  score?: MatchScore | null;
  /** この試合の勝者かどうか */
  isWinner?: boolean;
  /** BYE（不戦勝）スロットかどうか */
  isBye?: boolean;
  /** 現在サーブ権を持っているか等のアクティブインジケータ（任意） */
  isServing?: boolean;
}

/**
 * 試合の進行ステータス
 */
export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'bye';

/**
 * 1試合を表すデータ構造
 */
export interface Match {
  /** 試合の一意なID */
  id: string;
  /** 対戦する2チームのスロット [上側, 下側]（未定の場合は null） */
  teams: [MatchTeam | null, MatchTeam | null];
  /**
   * 次ラウンドの接続先マッチID（任意）
   * 省略した場合は標準的なシングルエリミネーション規則（次ラウンドの Math.floor(matchIndex / 2) 番目）で自動接続される
   */
  nextMatchId?: string;
  /** 試合ステータス（任意） */
  status?: MatchStatus;
  /** 試合カード上部に表示するラベル（例: "コートA · 14:00", "第1試合"） */
  label?: string;
  /** status === 'live' 時のバッジ表示テキスト（デフォルト: "LIVE"） */
  liveLabel?: string;
  /** 利用側が自由に付与できるメタデータ（任意） */
  meta?: Record<string, unknown>;
}

/**
 * updateMatches で特定試合を部分更新するための型
 */
export type MatchUpdate = Partial<Omit<Match, 'id'>> & { id: string };

/**
 * 1ラウンドを表すデータ構造
 */
export interface Round {
  /** ラウンドID（任意） */
  id?: string;
  /** ラウンド表示名（例: "準々決勝", "準決勝", "決勝"） */
  name?: string;
  /** このラウンドに含まれる試合一覧 */
  matches: Match[];
}

/**
 * トーナメント全体を表すデータ構造
 */
export interface BracketData {
  /** 左から右へ進行するラウンド配列 */
  rounds: Round[];
  /** 3位決定戦の試合データ（任意） */
  thirdPlaceMatch?: Match;
  /** 3位決定戦の見出しラベル（デフォルト: "3位決定戦"） */
  thirdPlaceTitle?: string;
}

/**
 * コネクタ（SVG接続線）の描画形状
 * - `orthogonal`: 直角折れ線（標準的なトーナメント表）
 * - `curved`: 滑らかな3次ベジェ曲線
 */
export type ConnectorType = 'orthogonal' | 'curved';

/**
 * チーム勝ち上がりパス・ハイライトのトリガー方式
 */
export type HighlightTrigger = 'click' | 'hover';

/**
 * 試合カードクリック時にコールバックへ渡されるコンテキスト情報
 */
export interface MatchClickContext {
  /** クリックされた試合が属するラウンドのインデックス（3位決定戦の場合は -1） */
  roundIndex: number;
  /** ラウンド内での試合インデックス（3位決定戦の場合は 0） */
  matchIndex: number;
  /** クリックされた試合が属するラウンドデータ（3位決定戦の場合は null） */
  round: Round | null;
  /** 3位決定戦かどうか */
  isThirdPlace: boolean;
  /** クリックされた試合カードのDOM要素 */
  element: HTMLElement;
  /** 元となったDOMイベント */
  event: MouseEvent | KeyboardEvent;
}

/**
 * チーム行クリック時にコールバックへ渡されるコンテキスト情報
 */
export interface TeamClickContext extends MatchClickContext {
  /** クリックされた試合データ */
  match: Match;
  /** スロット位置（0: 上側, 1: 下側） */
  teamIndex: 0 | 1;
  /** チームの識別キー（id ?? name） */
  teamKey: string | null;
}

/**
 * カスタムレンダラー（renderTeam）へ渡されるコンテキスト情報
 */
export interface TeamRenderContext {
  match: Match;
  roundIndex: number;
  matchIndex: number;
  teamIndex: 0 | 1;
  isThirdPlace: boolean;
}

/**
 * カスタムレンダラー（renderMatchHeader）へ渡されるコンテキスト情報
 */
export interface MatchRenderContext {
  roundIndex: number;
  matchIndex: number;
  isThirdPlace: boolean;
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
 * ブラケット描画時のオプション設定
 */
export interface BracketOptions {
  /** 試合カードクリック（またはフォーカス時のEnter/Spaceキー）時のコールバック */
  onMatchClick?: (match: Match, context: MatchClickContext) => void;
  /** チーム行クリック時のコールバック */
  onTeamClick?: (team: MatchTeam, context: TeamClickContext) => void;
  /** 接続線の形状（デフォルト: 'orthogonal'） */
  connectorType?: ConnectorType;
  /** チーム未定（null / 名前未設定）時に表示するラベル（デフォルト: 'TBD'） */
  tbdLabel?: string;
  /** BYEスロット時に表示するラベル（デフォルト: 'BYE'） */
  byeLabel?: string;
  /** ラウンド見出しを表示するかどうか（デフォルト: true） */
  showRoundHeaders?: boolean;
  /** チームの勝ち上がりパス・ハイライトを有効にするか（デフォルト: true） */
  highlightTeamHistory?: boolean;
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
  /** チーム行のカスタムレンダラー（null を返すとデフォルト描画にフォールバック） */
  renderTeam?: (team: MatchTeam | null, context: TeamRenderContext) => HTMLElement | string | null;
  /** 試合カードヘッダーのカスタムレンダラー（null を返すとデフォルト描画にフォールバック） */
  renderMatchHeader?: (match: Match, context: MatchRenderContext) => HTMLElement | string | null;
}

/**
 * createBracket が返す操作用インスタンス
 */
export interface BracketInstance {
  /** データまたはオプションを更新して再描画する */
  update: (data: BracketData, options?: Partial<BracketOptions>) => void;
  /** 指定した試合IDのデータだけを部分更新して再描画する（ライブスコア更新向け） */
  updateMatches: (updates: MatchUpdate[]) => void;
  /** 指定したチームキー（team.id または team.name）の勝ち上がりパスをハイライト／解除する */
  highlightTeam: (teamKey: string | null) => void;
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
}
