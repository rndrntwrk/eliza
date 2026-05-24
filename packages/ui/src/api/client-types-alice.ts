export interface Arcade555CatalogGame {
  id: string;
  name?: string;
  title?: string;
  label?: string;
  category?: string;
  viewerUrl?: string | null;
  [key: string]: unknown;
}

export interface Arcade555GamesCatalogResponse {
  games: Arcade555CatalogGame[];
  [key: string]: unknown;
}

export interface Arcade555GameActionResponse {
  ok?: boolean;
  started?: boolean;
  stopped?: boolean;
  switched?: boolean;
  gameId?: string;
  message?: string;
  [key: string]: unknown;
}

export interface Arcade555GameStateResponse {
  ok: boolean;
  sessionId: string;
  activeGameId: string | null;
  activeGameLabel: string | null;
  mode: string | null;
  phase: string;
  live: boolean;
  destination: { id: string; name: string } | null;
  [key: string]: unknown;
}

export type AliceOperatorActionName =
  | "STREAM555_AUTH_WALLET_LOGIN"
  | "STREAM555_AUTH_WALLET_PROVISION_LINKED"
  | "STREAM555_GO_LIVE"
  | "STREAM555_GO_LIVE_SEGMENTS"
  | "STREAM555_STREAM_STATUS"
  | "STREAM555_SCREEN_SHARE"
  | "STREAM555_RADIO_CONTROL"
  | "STREAM555_DESTINATIONS_APPLY"
  | "STREAM555_SEGMENT_OVERRIDE"
  | "STREAM555_END_LIVE"
  | "STREAM555_AD_CREATE"
  | "STREAM555_AD_TRIGGER"
  | "STREAM555_AD_DISMISS"
  | "STREAM555_EARNINGS_ESTIMATE"
  | "STREAM555_PIP_ENABLE"
  | "STREAM555_GUEST_INVITE"
  | "FIVE55_GAMES_CATALOG"
  | "FIVE55_GAMES_PLAY"
  | "FIVE55_GAMES_SWITCH"
  | "FIVE55_GAMES_STOP"
  | "FIVE55_GAMES_GO_LIVE_PLAY";

export interface AliceOperatorActionStep {
  id?: string;
  action: AliceOperatorActionName;
  params?: Record<string, unknown>;
}

export interface AliceOperatorActionResult {
  id: string;
  action: AliceOperatorActionName;
  success: boolean;
  message: string;
  status?: number;
  code?: string;
  data?: unknown;
}

export interface AliceOperatorPlanResponse {
  ok: true;
  allSucceeded: boolean;
  results: AliceOperatorActionResult[];
}

export type EmoteCategory =
  | "greeting"
  | "emotion"
  | "dance"
  | "combat"
  | "idle"
  | "movement"
  | "gesture"
  | "other";

export interface EmoteInfo {
  id: string;
  name: string;
  description: string;
  path: string;
  duration: number;
  loop: boolean;
  category: EmoteCategory;
}

export type HyperscapeScriptedRole =
  | "combat"
  | "woodcutting"
  | "fishing"
  | "mining"
  | "balanced";

export type HyperscapeEmbeddedAgentControlAction =
  | "start"
  | "stop"
  | "pause"
  | "resume";

export type HyperscapeJsonValue =
  | string
  | number
  | boolean
  | null
  | HyperscapeJsonValue[]
  | { [key: string]: HyperscapeJsonValue };

export type HyperscapePosition =
  | [number, number, number]
  | {
      x: number;
      y: number;
      z: number;
    };

export interface HyperscapeEmbeddedAgent {
  agentId: string;
  characterId: string;
  accountId: string;
  name: string;
  scriptedRole: HyperscapeScriptedRole | null;
  state: string;
  entityId: string | null;
  position: HyperscapePosition | null;
  health: number | null;
  maxHealth: number | null;
  startedAt: number | null;
  lastActivity: number | null;
  error: string | null;
}

export interface HyperscapeEmbeddedAgentsResponse {
  success: boolean;
  agents: HyperscapeEmbeddedAgent[];
  count: number;
  error?: string;
}

export interface HyperscapeActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface HyperscapeEmbeddedAgentMutationResponse
  extends HyperscapeActionResponse {
  agent?: HyperscapeEmbeddedAgent | null;
}

export interface HyperscapeAvailableGoal {
  id: string;
  type: string;
  description: string;
  priority: number;
}

export interface HyperscapeGoalState {
  type?: string;
  description?: string;
  progress?: number;
  target?: number;
  progressPercent?: number;
  elapsedMs?: number;
  startedAt?: number;
  locked?: boolean;
  lockedBy?: string;
}

export interface HyperscapeAgentGoalResponse {
  success: boolean;
  goal: HyperscapeGoalState | null;
  availableGoals?: HyperscapeAvailableGoal[];
  goalsPaused?: boolean;
  message?: string;
  error?: string;
}

export interface HyperscapeQuickCommand {
  id: string;
  label: string;
  command: string;
  icon: string;
  available: boolean;
  reason?: string;
}

export interface HyperscapeNearbyLocation {
  id: string;
  name: string;
  type: string;
  distance: number;
}

export interface HyperscapeInventoryItem {
  id: string;
  name: string;
  slot: number;
  quantity: number;
  canEquip: boolean;
  canUse: boolean;
  canDrop: boolean;
}

export interface HyperscapeQuickActionsResponse {
  success: boolean;
  nearbyLocations: HyperscapeNearbyLocation[];
  availableGoals: HyperscapeAvailableGoal[];
  quickCommands: HyperscapeQuickCommand[];
  inventory: HyperscapeInventoryItem[];
  playerPosition: [number, number, number] | null;
  message?: string;
  error?: string;
}
