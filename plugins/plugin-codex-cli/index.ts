/**
 * Plugin entry for the ChatGPT Codex model provider: registers the TEXT_*,
 * RESPONSE_HANDLER, and ACTION_PLANNER model handlers that route generation
 * through a user's ChatGPT subscription via the codex CLI OAuth cache. Every
 * handler delegates to a single per-runtime CodexBackend (held in a WeakMap so
 * calls on one runtime serialize through the backend's FIFO queue).
 *
 * Auto-enables only when an auth profile selects provider "codex-cli"; there is
 * no env-key trigger. Tool- or message-bearing calls return native tool calls
 * rather than a plain string, and streaming calls attach toolCalls so the
 * planner still sees tool-only responses.
 */
import type { GenerateTextParams, IAgentRuntime, Plugin, TextStreamResult } from "@elizaos/core";
import { logger, ModelType } from "@elizaos/core";
import {
  CodexBackend,
  type CodexGenerateParams,
  type CodexGenerateResult,
} from "./src/codex-backend";

const TEXT_NANO_MODEL_TYPE = (ModelType.TEXT_NANO ?? "TEXT_NANO") as string;
const TEXT_MEDIUM_MODEL_TYPE = (ModelType.TEXT_MEDIUM ?? "TEXT_MEDIUM") as string;
const TEXT_MEGA_MODEL_TYPE = (ModelType.TEXT_MEGA ?? "TEXT_MEGA") as string;
const RESPONSE_HANDLER_MODEL_TYPE = (ModelType.RESPONSE_HANDLER ?? "RESPONSE_HANDLER") as string;
const ACTION_PLANNER_MODEL_TYPE = (ModelType.ACTION_PLANNER ?? "ACTION_PLANNER") as string;
const CODEX_MODEL_SETTING = "CODEX_MODEL";
const CODEX_REASONING_EFFORT_SETTING = "CODEX_REASONING_EFFORT";
const CODEX_FAST_MODEL_SETTING = "ELIZA_CODEX_MODEL_FAST";
const CODEX_POWERFUL_MODEL_SETTING = "ELIZA_CODEX_MODEL_POWERFUL";

const CODEX_MODEL_SETTING_BY_TYPE: Readonly<Record<string, string>> = {
  [TEXT_NANO_MODEL_TYPE]: CODEX_FAST_MODEL_SETTING,
  [ModelType.TEXT_SMALL]: CODEX_FAST_MODEL_SETTING,
  [TEXT_MEDIUM_MODEL_TYPE]: CODEX_FAST_MODEL_SETTING,
  [ModelType.TEXT_LARGE]: CODEX_POWERFUL_MODEL_SETTING,
  [TEXT_MEGA_MODEL_TYPE]: CODEX_POWERFUL_MODEL_SETTING,
  [RESPONSE_HANDLER_MODEL_TYPE]: CODEX_FAST_MODEL_SETTING,
  [ACTION_PLANNER_MODEL_TYPE]: CODEX_POWERFUL_MODEL_SETTING,
};

const DEFAULT_CODEX_MODEL_BY_TYPE: Readonly<Record<string, string>> = {
  [TEXT_NANO_MODEL_TYPE]: "gpt-5.6-luna",
  [ModelType.TEXT_SMALL]: "gpt-5.6-luna",
  [TEXT_MEDIUM_MODEL_TYPE]: "gpt-5.6-luna",
  [ModelType.TEXT_LARGE]: "gpt-5.6-sol",
  [TEXT_MEGA_MODEL_TYPE]: "gpt-5.6-sol",
  [RESPONSE_HANDLER_MODEL_TYPE]: "gpt-5.6-luna",
  [ACTION_PLANNER_MODEL_TYPE]: "gpt-5.6-sol",
};

const CODEX_REASONING_EFFORTS = new Set([
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

const CODEX_SUPPORTED_MODELS = [
  "gpt-5",
  "gpt-5-codex",
  "gpt-5.4",
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.6-luna",
  "gpt-5.6-sol",
] as const;

type RuntimeWithSettings = IAgentRuntime & {
  getSetting?: (key: string) => string | number | boolean | undefined | null;
};

type TextResultWithNativeTools = {
  text: string;
  toolCalls: CodexGenerateResult["toolCalls"];
  finishReason?: string;
  usage?: CodexGenerateResult["usage"];
};

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}

function getSetting(runtime: IAgentRuntime, key: string): string | undefined {
  const value = (runtime as RuntimeWithSettings).getSetting?.(key);
  return value === undefined || value === null ? readEnv(key) : String(value);
}

function getCodexModel(runtime: IAgentRuntime, modelType: string): string {
  const tierSetting = CODEX_MODEL_SETTING_BY_TYPE[modelType];
  return (
    (tierSetting ? getSetting(runtime, tierSetting) : undefined) ??
    getSetting(runtime, CODEX_MODEL_SETTING) ??
    DEFAULT_CODEX_MODEL_BY_TYPE[modelType] ??
    "gpt-5.6-luna"
  );
}

function getRequestedCodexModel(
  runtime: IAgentRuntime,
  params: GenerateTextParams,
  modelType: string
): string {
  const requestedModel = (params as GenerateTextParams & { model?: unknown }).model;
  return typeof requestedModel === "string" && requestedModel.trim().length > 0
    ? requestedModel.trim()
    : getCodexModel(runtime, modelType);
}

function getCodexReasoningEffort(runtime: IAgentRuntime): CodexGenerateParams["reasoningEffort"] {
  const value = getSetting(runtime, CODEX_REASONING_EFFORT_SETTING)?.trim().toLowerCase();
  return value && CODEX_REASONING_EFFORTS.has(value)
    ? (value as NonNullable<CodexGenerateParams["reasoningEffort"]>)
    : undefined;
}

const backendByRuntime = new WeakMap<IAgentRuntime, CodexBackend>();

function createBackend(runtime: IAgentRuntime): CodexBackend {
  const existing = backendByRuntime.get(runtime);
  if (existing) return existing;

  const jitterRaw = getSetting(runtime, "CODEX_JITTER_MS_MAX");
  const jitterMaxMs = jitterRaw === undefined ? undefined : Number.parseInt(jitterRaw, 10);
  const backend = new CodexBackend({
    authPath: getSetting(runtime, "CODEX_AUTH_PATH"),
    baseUrl: getSetting(runtime, "CODEX_BASE_URL"),
    model: getCodexModel(runtime, ModelType.TEXT_SMALL),
    originator: getSetting(runtime, "CODEX_ORIGINATOR"),
    jitterMaxMs: Number.isFinite(jitterMaxMs) ? jitterMaxMs : undefined,
  });
  backendByRuntime.set(runtime, backend);
  return backend;
}

function toTextReturn(
  params: GenerateTextParams,
  result: CodexGenerateResult
): string | TextResultWithNativeTools {
  if (params.tools?.length || params.messages?.length || result.toolCalls.length > 0) {
    return {
      text: result.text,
      toolCalls: result.toolCalls,
      finishReason: result.finishReason,
      usage: result.usage,
    };
  }
  return result.text;
}

function buildCodexGenerateParams(
  runtime: IAgentRuntime,
  params: GenerateTextParams,
  modelType: string = ModelType.TEXT_SMALL
): CodexGenerateParams {
  // Honor `responseSchema` natively. OpenAI-compatible Codex models accept
  // `response_format: { type: "json_schema", schema }` for guaranteed JSON
  // output; if the caller already passed a custom `responseFormat`, leave it
  // alone.
  const paramsWithSchema = params as GenerateTextParams & {
    responseSchema?: unknown;
    system?: string;
  };
  const responseFormat =
    params.responseFormat ??
    (paramsWithSchema.responseSchema
      ? {
          type: "json_schema" as const,
          schema: paramsWithSchema.responseSchema as Record<string, unknown>,
        }
      : undefined);
  return {
    prompt: params.prompt ?? "",
    system: paramsWithSchema.system,
    messages: params.messages,
    tools: params.tools,
    toolChoice: params.toolChoice,
    model: getRequestedCodexModel(runtime, params, modelType),
    reasoningEffort: getCodexReasoningEffort(runtime),
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    responseFormat,
  };
}

function streamTextWithCodex(
  runtime: IAgentRuntime,
  params: GenerateTextParams,
  modelType: string
): TextStreamResult {
  const queue: string[] = [];
  let notify: (() => void) | undefined;
  let done = false;

  const wake = () => {
    notify?.();
    notify = undefined;
  };

  const resultPromise = createBackend(runtime)
    .generate({
      ...buildCodexGenerateParams(runtime, params, modelType),
      onTextDelta: (delta) => {
        queue.push(delta);
        wake();
      },
    })
    .finally(() => {
      done = true;
      wake();
    });

  async function* textStream(): AsyncIterable<string> {
    while (!done || queue.length > 0) {
      const next = queue.shift();
      if (next !== undefined) {
        yield next;
        continue;
      }
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
    }
  }

  // The planner streams (the Discord message handler sets onStreamChunk), so
  // ACTION_PLANNER/RESPONSE_HANDLER go through THIS path. The runtime collapses
  // the stream and only preserves native tool calls when `toolCalls` is present
  // on the returned object (it duck-types `"toolCalls" in streamRaw`). Without
  // it, a tool-only response (empty text + native toolCalls) collapses to a bare
  // empty string and the planner never sees the tool call — it replans until the
  // required-tool cap and gives up. Mirror plugin-openai: attach `toolCalls`
  // whenever the call is native, and stamp the model name for trajectory pricing.
  const shouldReturnNativeTools = Boolean(
    params.messages?.length || params.tools?.length || params.toolChoice
  );
  return {
    textStream: textStream(),
    text: resultPromise.then((result) => result.text),
    ...(shouldReturnNativeTools
      ? { toolCalls: resultPromise.then((result) => result.toolCalls) }
      : {}),
    usage: resultPromise.then((result) =>
      result.usage
        ? {
            promptTokens: result.usage.inputTokens,
            completionTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined
    ),
    finishReason: resultPromise.then((result) => result.finishReason),
    providerMetadata: { modelName: getRequestedCodexModel(runtime, params, modelType) },
  };
}

async function generateTextWithCodex(
  runtime: IAgentRuntime,
  params: GenerateTextParams,
  modelType: string
): Promise<string | TextResultWithNativeTools | TextStreamResult> {
  const model = getRequestedCodexModel(runtime, params, modelType);
  logger.debug(`[codex-cli] Using ${modelType} model: ${model}`);
  if (params.stream) return streamTextWithCodex(runtime, params, modelType);
  const result = await createBackend(runtime).generate(
    buildCodexGenerateParams(runtime, params, modelType)
  );
  return toTextReturn(params, result);
}

const codexModels = {
  [ModelType.TEXT_SMALL]: (runtime: IAgentRuntime, params: GenerateTextParams) =>
    generateTextWithCodex(runtime, params, ModelType.TEXT_SMALL),
  [TEXT_NANO_MODEL_TYPE]: (runtime: IAgentRuntime, params: GenerateTextParams) =>
    generateTextWithCodex(runtime, params, TEXT_NANO_MODEL_TYPE),
  [TEXT_MEDIUM_MODEL_TYPE]: (runtime: IAgentRuntime, params: GenerateTextParams) =>
    generateTextWithCodex(runtime, params, TEXT_MEDIUM_MODEL_TYPE),
  [ModelType.TEXT_LARGE]: (runtime: IAgentRuntime, params: GenerateTextParams) =>
    generateTextWithCodex(runtime, params, ModelType.TEXT_LARGE),
  [TEXT_MEGA_MODEL_TYPE]: (runtime: IAgentRuntime, params: GenerateTextParams) =>
    generateTextWithCodex(runtime, params, TEXT_MEGA_MODEL_TYPE),
  [RESPONSE_HANDLER_MODEL_TYPE]: (runtime: IAgentRuntime, params: GenerateTextParams) =>
    generateTextWithCodex(runtime, params, RESPONSE_HANDLER_MODEL_TYPE),
  [ACTION_PLANNER_MODEL_TYPE]: (runtime: IAgentRuntime, params: GenerateTextParams) =>
    generateTextWithCodex(runtime, params, ACTION_PLANNER_MODEL_TYPE),
} as Plugin["models"];

const codexModelMetadata = Object.fromEntries(
  Object.keys(codexModels ?? {}).map((modelType) => [
    modelType,
    { displayModelSetting: CODEX_MODEL_SETTING_BY_TYPE[modelType] ?? CODEX_MODEL_SETTING },
  ])
) satisfies NonNullable<Plugin["modelMetadata"]>;

/** @internal - exported for shape tests only. */
export const __INTERNAL_buildCodexGenerateParams = buildCodexGenerateParams;

export const codexCliPlugin: Plugin = {
  name: "codex-cli",
  description: "ChatGPT Codex model provider using the codex CLI OAuth token cache",
  autoEnable: {
    // No env-key auto-enable; activated when an auth profile selects codex-cli
    // as its provider (e.g. via subscription onboarding).
    shouldEnable: (_env, config) => {
      const auth = (config as { auth?: { profiles?: Record<string, unknown> } }).auth;
      const profiles = auth?.profiles;
      if (!profiles || typeof profiles !== "object") return false;
      return Object.values(profiles).some((profile) => {
        if (!profile || typeof profile !== "object") return false;
        return (profile as { provider?: unknown }).provider === "codex-cli";
      });
    },
  },
  config: {
    CODEX_AUTH_PATH: readEnv("CODEX_AUTH_PATH") ?? null,
    CODEX_BASE_URL: readEnv("CODEX_BASE_URL") ?? null,
    [CODEX_MODEL_SETTING]: readEnv(CODEX_MODEL_SETTING) ?? null,
    [CODEX_FAST_MODEL_SETTING]: readEnv(CODEX_FAST_MODEL_SETTING) ?? null,
    [CODEX_POWERFUL_MODEL_SETTING]: readEnv(CODEX_POWERFUL_MODEL_SETTING) ?? null,
    [CODEX_REASONING_EFFORT_SETTING]: readEnv(CODEX_REASONING_EFFORT_SETTING) ?? null,
    CODEX_JITTER_MS_MAX: readEnv("CODEX_JITTER_MS_MAX") ?? null,
    CODEX_ORIGINATOR: readEnv("CODEX_ORIGINATOR") ?? null,
  },
  async init(): Promise<void> {
    logger.info(`[codex-cli] initialized. Supported models: ${CODEX_SUPPORTED_MODELS.join(", ")}`);
  },
  models: codexModels,
  modelMetadata: codexModelMetadata,
};

export * from "./src/codex-auth";
export * from "./src/sse-parser";
export * from "./src/tool-format-openai";
export { CODEX_SUPPORTED_MODELS, CodexBackend };

export default codexCliPlugin;
