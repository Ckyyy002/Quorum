#!/usr/bin/env bash
# Thin wrapper around `gh project` for the Quorum board.
# Usage:
#   gh-project.sh init <owner> <project-number>   discover IDs, write .claude/github-project.json
#   gh-project.sh board [Status]                   list items (optionally only one status)
#   gh-project.sh add <issue-number> [Status]      add an issue to the board (optionally set status)
#   gh-project.sh status <issue-number> <Status>   move an issue to a status column
#   gh-project.sh options                          list valid status names
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
CFG="$ROOT/.claude/github-project.json"

for bin in gh jq; do
  command -v "$bin" >/dev/null || { echo "error: '$bin' is not installed" >&2; exit 1; }
done

cfg() {
  [[ -f "$CFG" ]] || { echo "error: $CFG not found. Run: $0 init <owner> <project-number>" >&2; exit 1; }
  jq -r "$1" "$CFG"
}

items_json() {
  gh project item-list "$(cfg .projectNumber)" --owner "$(cfg .owner)" --format json --limit 300
}

item_id_for_issue() {
  local n="$1"
  items_json | jq -r --argjson n "$n" \
    '.items[] | select(.content.type == "Issue" and .content.number == $n) | .id' | head -n1
}

option_id() {
  local name="$1" id
  id=$(jq -r --arg s "$name" '.statusOptions[$s] // empty' "$CFG")
  if [[ -z "$id" ]]; then
    echo "error: unknown status '$name'. Valid: $(jq -r '.statusOptions | keys | join(", ")' "$CFG")" >&2
    exit 1
  fi
  echo "$id"
}

set_status() {
  local item="$1" name="$2"
  gh project item-edit --id "$item" --project-id "$(cfg .projectId)" \
    --field-id "$(cfg .statusFieldId)" --single-select-option-id "$(option_id "$name")" >/dev/null
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  init)
    owner="${1:?owner required}"; num="${2:?project number required}"
    repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
    pid=$(gh project view "$num" --owner "$owner" --format json | jq -r .id)
    fields=$(gh project field-list "$num" --owner "$owner" --format json)
    sfid=$(jq -r '.fields[] | select(.name == "Status") | .id' <<<"$fields")
    opts=$(jq '[.fields[] | select(.name == "Status") | .options[] | {(.name): .id}] | add' <<<"$fields")
    mkdir -p "$(dirname "$CFG")"
    jq -n --arg owner "$owner" --argjson num "$num" --arg repo "$repo" --arg pid "$pid" \
          --arg sfid "$sfid" --argjson opts "$opts" \
      '{owner: $owner, projectNumber: $num, repo: $repo, projectId: $pid, statusFieldId: $sfid, statusOptions: $opts}' \
      > "$CFG"
    echo "wrote $CFG"; cat "$CFG"
    ;;
  board)
    filter="${1:-}"
    items_json | jq -r --arg s "$filter" '
      .items[]
      | select($s == "" or .status == $s)
      | [(.status // "No status"), ("#" + ((.content.number // 0) | tostring)), .content.title,
         ((.assignees // []) | join(","))]
      | @tsv' | sort
    ;;
  add)
    n="${1:?issue number required}"; status="${2:-}"
    url=$(gh issue view "$n" --json url -q .url)
    item=$(gh project item-add "$(cfg .projectNumber)" --owner "$(cfg .owner)" --url "$url" --format json | jq -r .id)
    [[ -n "$status" ]] && set_status "$item" "$status"
    echo "added #$n${status:+ as '$status'}"
    ;;
  status)
    n="${1:?issue number required}"; status="${2:?status required}"
    item=$(item_id_for_issue "$n")
    if [[ -z "$item" ]]; then
      url=$(gh issue view "$n" --json url -q .url)
      item=$(gh project item-add "$(cfg .projectNumber)" --owner "$(cfg .owner)" --url "$url" --format json | jq -r .id)
    fi
    set_status "$item" "$status"
    echo "#$n -> $status"
    ;;
  options)
    cfg '.statusOptions | keys | .[]'
    ;;
  *)
    sed -n '2,8p' "$0"
    ;;
esac
