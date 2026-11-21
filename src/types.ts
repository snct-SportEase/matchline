/**
 * 試合に参加するチーム（または選手）のスロット情報
 */
export interface MatchTeam {
  /** チームの一意なID（任意） */
  id?: string;
  /** チーム名（未定の場合は省略可能） */
  name?: string;
  /** シード番号（任意） */
  seed?: number;
  /** スコア（未実施時は undefined または null） */
  score?: number | string | null;
  /** この試合の勝者かどうか */
  isWinner?: boolean;
  /** BYE（不戦勝）スロットかどうか */
  isBye?: boolean;
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
  /** 利用側が自由に付与できるメタデータ（任意） */
  meta?: Record<string, unknown>;
}

/**
 * 1ラウンドを表すデータ構造
 */
export interface Round {
  /** ラウンドID（任意） */
  id?: string;
  /** ラウンド表示名（例: "1回戦", "準決勝", "決勝"） */
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
}

/**
 * コネクタ（SVG接続線）の描画形状
 * - `orthogonal`: 直角折れ線（標準的なトーナメント表）
 * - `curved`: 滑らかな3次ベジェ曲線
 */
export type ConnectorType = 'orthogonal' | 'curved';

/**
 * 試合カードクリック時にコールバックへ渡されるコンテキスト情報
 */
export interface MatchClickContext {
  /** クリックされた試合が属するラウンドのインデックス（0始まり） */
  roundIndex: number;
  /** ラウンド内での試合インデックス（0始まり） */
  matchIndex: number;
  /** クリックされた試合が属するラウンドデータ */
  round: Round;
  /** クリックされた試合カードのDOM要素 */
  element: HTMLElement;
  /** 元となったDOMイベント */
  event: MouseEvent | KeyboardEvent;
}

/**
 * ブラケット描画時のオプション設定
 */
export interface BracketOptions {
  /** 試合カードクリック（またはフォーカス時のEnter/Spaceキー）時のコールバック */
  onMatchClick?: (match: Match, context: MatchClickContext) => void;
  /** 接続線の形状（デフォルト: 'orthogonal'） */
  connectorType?: ConnectorType;
  /** チーム未定（null / 名前未設定）時に表示するラベル（デフォルト: 'TBD'） */
  tbdLabel?: string;
  /** BYEスロット時に表示するラベル（デフォルト: 'BYE'） */
  byeLabel?: string;
  /** ラウンド見出しを表示するかどうか（デフォルト: true） */
  showRoundHeaders?: boolean;
}

/**
 * createBracket が返す操作用インスタンス
 */
export interface BracketInstance {
  /** データまたはオプションを更新して再描画する */
  update: (data: BracketData, options?: Partial<BracketOptions>) => void;
  /** SVG接続線の座標を再計算して再描画する */
  redrawConnectors: () => void;
  /** DOM要素・イベントリスナー・ResizeObserverを破棄してクリーンアップする */
  destroy: () => void;
}
