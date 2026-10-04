#!/usr/bin/env bash
# Second Brain — host-side system-health snapshot collector.
#
# This program is deliberately separate from the API. It talks to the host's
# Docker CLI only to calculate aggregate counts and writes an allowlisted JSON
# snapshot for a read-only API mount. It never emits container IDs, names,
# images, labels, environment variables, logs, command lines, or credentials.
#
# Usage:
#   SYSTEM_HEALTH_SNAPSHOT_PATH=/var/lib/second-brain/system-health/snapshot.json \
#     scripts/collect-system-health-snapshot.sh
#
# SYSTEM_HEALTH_DISK_PATH is optional and selects the filesystem represented by
# the disk numbers. It defaults to the snapshot directory.
set -euo pipefail
umask 0077

snapshot_path="${SYSTEM_HEALTH_SNAPSHOT_PATH:-}"
disk_path="${SYSTEM_HEALTH_DISK_PATH:-}"

fail() {
  printf '%s\n' "system-health snapshot: $1" >&2
  exit 2
}

require_uint() {
  case "$1" in
    ''|*[!0-9]*) fail "collector received a non-numeric host metric" ;;
  esac
}

require_decimal() {
  case "$1" in
    ''|*[!0-9.]*|.*|*..*|*.*.*) fail "collector received an invalid load metric" ;;
  esac
}

if [ -z "$snapshot_path" ]; then
  fail "SYSTEM_HEALTH_SNAPSHOT_PATH must be set"
fi

case "$snapshot_path" in
  /*) ;;
  *) fail "SYSTEM_HEALTH_SNAPSHOT_PATH must be an absolute path" ;;
esac

snapshot_dir=$(dirname -- "$snapshot_path")
snapshot_name=$(basename -- "$snapshot_path")

if [ ! -d "$snapshot_dir" ]; then
  fail "snapshot directory does not exist"
fi

if [ -z "$snapshot_name" ] || [ "$snapshot_name" = "." ] || [ "$snapshot_name" = "/" ]; then
  fail "snapshot path must name a file"
fi

if [ -z "$disk_path" ]; then
  disk_path="$snapshot_dir"
fi

case "$disk_path" in
  /*) ;;
  *) fail "SYSTEM_HEALTH_DISK_PATH must be an absolute path" ;;
esac

if [ ! -e "$disk_path" ]; then
  fail "SYSTEM_HEALTH_DISK_PATH does not exist"
fi

command -v docker >/dev/null 2>&1 || fail "Docker CLI is unavailable"

observed_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
uptime_seconds=$(awk '{printf "%.0f\n", $1}' /proc/uptime)
cpu_cores=$(getconf _NPROCESSORS_ONLN)
read -r load1 load5 load15 _ < /proc/loadavg
memory_total_kib=$(awk '/^MemTotal:/ {print $2; exit}' /proc/meminfo)
memory_available_kib=$(awk '/^MemAvailable:/ {print $2; exit}' /proc/meminfo)
disk_metrics=$(df -Pk -- "$disk_path" | awk 'NR > 1 {print $2, $4; exit}')
read -r disk_total_kib disk_available_kib <<EOF
$disk_metrics
EOF

require_uint "$uptime_seconds"
require_uint "$cpu_cores"
require_decimal "$load1"
require_decimal "$load5"
require_decimal "$load15"
require_uint "$memory_total_kib"
require_uint "$memory_available_kib"
require_uint "$disk_total_kib"
require_uint "$disk_available_kib"

memory_total_bytes=$((memory_total_kib * 1024))
memory_available_bytes=$((memory_available_kib * 1024))
disk_total_bytes=$((disk_total_kib * 1024))
disk_available_bytes=$((disk_available_kib * 1024))

# Requesting only Status means the Docker daemon never returns details to the
# output path. The status strings are consumed immediately to compute counts.
container_statuses=$(docker ps -a --format '{{.Status}}') || fail "Docker status query failed"
container_total=$(printf '%s\n' "$container_statuses" | awk 'NF { count += 1 } END { print count + 0 }')
container_running=$(printf '%s\n' "$container_statuses" | awk '/^Up / { count += 1 } END { print count + 0 }')
container_unhealthy=$(printf '%s\n' "$container_statuses" | awk '/\(unhealthy\)/ { count += 1 } END { print count + 0 }')
container_restarting=$(printf '%s\n' "$container_statuses" | awk '/^Restarting / { count += 1 } END { print count + 0 }')

require_uint "$container_total"
require_uint "$container_running"
require_uint "$container_unhealthy"
require_uint "$container_restarting"

tmp_path=$(mktemp "$snapshot_dir/.${snapshot_name}.tmp.XXXXXX") || fail "unable to create a temporary snapshot"
cleanup() {
  rm -f -- "$tmp_path"
}
trap cleanup EXIT HUP INT TERM

# Keep this schema numeric-only beyond the fixed timestamp. Adding a field that
# identifies a host, image, container, path, or process is intentionally out of
# scope for this collector and requires a separate privacy/security review.
printf '%s\n' '{' \
  '  "schemaVersion": 1,' \
  "  \"observedAt\": \"${observed_at}\", " \
  '  "host": {' \
  "    \"uptimeSeconds\": ${uptime_seconds}," \
  "    \"cpuCores\": ${cpu_cores}," \
  "    \"load1\": ${load1}," \
  "    \"load5\": ${load5}," \
  "    \"load15\": ${load15}," \
  "    \"memoryTotalBytes\": ${memory_total_bytes}," \
  "    \"memoryAvailableBytes\": ${memory_available_bytes}," \
  "    \"diskTotalBytes\": ${disk_total_bytes}," \
  "    \"diskAvailableBytes\": ${disk_available_bytes}" \
  '  },' \
  '  "containers": {' \
  "    \"total\": ${container_total}," \
  "    \"running\": ${container_running}," \
  "    \"unhealthy\": ${container_unhealthy}," \
  "    \"restarting\": ${container_restarting}" \
  '  }' \
  '}' > "$tmp_path"

# A restrictive mode is applied before the atomic rename. The API should receive
# this file via a read-only bind mount; it must not receive Docker socket access.
chmod 0640 "$tmp_path"
mv -f -- "$tmp_path" "$snapshot_path"
trap - EXIT HUP INT TERM
