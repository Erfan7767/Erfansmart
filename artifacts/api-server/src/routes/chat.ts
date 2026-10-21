import {
  Router,
  type IRouter,
  type Response as ExpressResponse,
} from "express";
import {
  CreateChatCompletionBody,
  CreateChatCompletionResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const LLM7_CHAT_URL = "https://api.llm7.io/v1/chat/completions";
const MODEL = "gpt-oss:20b";
const MAX_REQUESTS_PER_MINUTE = 20;
const RATE_WINDOW_MS = 60_000;
const requestTimestamps: number[] = [];

const SYSTEM_PROMPT = [
  "You are Erfan, a helpful conversational AI assistant.",
  "Reply in the same language as the user, including Arabic when they write in Arabic.",
  "Be clear, accurate, and concise. Do not claim to have live information or to have completed actions you cannot perform.",
  "You have no access to calendars, email, files, external tools, or the agent profiles shown in the interface.",
].join(" ");

function allowRequest(now: number): boolean {
  while (requestTimestamps.length > 0 && requestTimestamps[0] <= now - RATE_WINDOW_MS) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) return false;
  requestTimestamps.push(now);
  return true;
}

function sendError(
  res: ExpressResponse,
  status: number,
  code: string,
  message: string,
) {
  res.status(status).json({ error: { code, message } });
}

router.post("/chat/completions", async (req, res) => {
  const parsed = CreateChatCompletionBody.safeParse(req.body);
  if (!parsed.success || parsed.data.messages.some((message) => !message.content.trim())) {
    sendError(res, 400, "invalid_messages", "Please provide a non-empty chat message.");
    return;
  }

  if (parsed.data.messages.at(-1)?.role !== "user") {
    sendError(res, 400, "invalid_turn", "The latest chat message must be from the user.");
    return;
  }

  const now = Date.now();
  if (!allowRequest(now)) {
    const retryAfter = Math.max(1, Math.ceil((requestTimestamps[0] + RATE_WINDOW_MS - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    sendError(res, 429, "rate_limit", "The shared free chat limit was reached. Please try again shortly.");
    return;
  }

  let upstream: Response;
  try {
    upstream = await fetch(LLM7_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...parsed.data.messages,
        ],
        max_completion_tokens: 1024,
        temperature: 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    logger.warn({ timedOut }, "LLM7 chat request failed");
    sendError(
      res,
      503,
      "provider_unavailable",
      timedOut
        ? "The AI service took too long to respond. Please try again."
        : "The AI service is unavailable right now. Please try again shortly.",
    );
    return;
  }

  if (!upstream.ok) {
    logger.warn({ upstreamStatus: upstream.status }, "LLM7 rejected a chat request");
    if (upstream.status === 429) {
      sendError(res, 429, "provider_rate_limit", "The free AI service is busy. Please try again shortly.");
      return;
    }
    sendError(
      res,
      503,
      "provider_unavailable",
      "The AI service is unavailable right now. Please try again shortly.",
    );
    return;
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    logger.warn("LLM7 returned invalid JSON");
    sendError(res, 502, "invalid_provider_response", "The AI service returned an invalid response.");
    return;
  }

  const reply = (payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
  })?.choices?.[0]?.message?.content;

  if (typeof reply !== "string" || !reply.trim()) {
    logger.warn("LLM7 response did not contain a chat reply");
    sendError(res, 502, "missing_provider_reply", "The AI service did not return a usable reply.");
    return;
  }

  const result = CreateChatCompletionResponse.safeParse({
    reply: reply.trim(),
    model: MODEL,
  });
  if (!result.success) {
    logger.warn("LLM7 response did not match the chat response contract");
    sendError(res, 502, "invalid_provider_reply", "The AI service returned an invalid reply.");
    return;
  }

  res.status(200).json(result.data);
});

export default router;
