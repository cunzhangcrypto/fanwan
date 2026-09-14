// 统一 JSON 响应

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export function ok(data, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: JSON_HEADERS,
  });
}

export function fail(code, message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: JSON_HEADERS,
  });
}

export const ERR = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  TURNSTILE_FAILED: "TURNSTILE_FAILED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  SERVER_ERROR: "SERVER_ERROR",
};

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
