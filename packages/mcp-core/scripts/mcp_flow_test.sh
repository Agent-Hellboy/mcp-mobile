#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-http://127.0.0.1:3001}"
ENDPOINT="${ENDPOINT:-/mcp}"
BASE_URL="${HOST%/}${ENDPOINT}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local needle="$2"
  if ! grep -q "$needle" "$file"; then
    echo "Expected to find: $needle" >&2
    echo "---- file ----" >&2
    cat "$file" >&2
    echo "--------------" >&2
    fail "missing expected content"
  fi
}

echo "MCP flow test against $BASE_URL"

headers_init="$tmp_dir/init_headers.txt"
body_init="$tmp_dir/init_body.txt"

curl -sS -D "$headers_init" -o "$body_init" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  --data-raw '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mcp-flow-test","version":"0.1.0"}}}' \
  "$BASE_URL"

session_id="$(awk 'tolower($1)=="mcp-session-id:"{print $2}' "$headers_init" | tr -d '\r')"
if [[ -z "${session_id:-}" ]]; then
  echo "---- headers ----" >&2
  cat "$headers_init" >&2
  echo "-----------------" >&2
  fail "missing mcp-session-id header on initialize"
fi

assert_contains "$body_init" "\"protocolVersion\""

headers_list="$tmp_dir/list_headers.txt"
body_list="$tmp_dir/list_body.txt"

curl -sS -D "$headers_list" -o "$body_list" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${session_id}" \
  -H "mcp-protocol-version: 2024-11-05" \
  --data-raw '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  "$BASE_URL"

assert_contains "$body_list" "\"tools\""

headers_call="$tmp_dir/call_headers.txt"
body_call="$tmp_dir/call_body.txt"

curl -sS -D "$headers_call" -o "$body_call" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${session_id}" \
  -H "mcp-protocol-version: 2024-11-05" \
  --data-raw '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hi"}}}' \
  "$BASE_URL"

assert_contains "$body_call" "\"result\""
assert_contains "$body_call" "hi"

headers_close="$tmp_dir/close_headers.txt"
body_close="$tmp_dir/close_body.txt"

curl -sS -D "$headers_close" -o "$body_close" \
  -X DELETE \
  -H "mcp-session-id: ${session_id}" \
  -H "mcp-protocol-version: 2024-11-05" \
  "$BASE_URL"

status_line="$(head -n 1 "$headers_close" | tr -d '\r')"
case "$status_line" in
  "HTTP/1.1 200 OK"|"HTTP/2 200"|"HTTP/1.1 204 No Content"|"HTTP/1.1 404 Not Found")
    ;;
  *)
    echo "Unexpected close response: $status_line" >&2
    fail "close failed"
    ;;
esac

echo "OK: MCP flow complete (session ${session_id})"
