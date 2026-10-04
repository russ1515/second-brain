# Infrastructure health snapshot collector

`scripts/collect-system-health-snapshot.sh` is an operator-side collector for
the Sprint 6 Infrastructure/System Health view. It is intentionally **not** an
API feature and never mounts the Docker socket into the API container.

The collector writes one atomically replaced JSON file containing only:

- collection time;
- host uptime, CPU-core count, load averages, memory totals/availability, and
  disk totals/availability;
- aggregate Docker container counts: total, running, unhealthy, restarting.

It never writes environment variables, credentials, logs, host names,
container IDs/names/images/labels, command lines, or provider payloads. A
collector failure does not overwrite the prior snapshot. The API must treat a
missing, invalid, or stale snapshot as `UNKNOWN` / `NOT_INSTRUMENTED`, never as
healthy.

## Host preparation

Run these commands from the staging host, never from the API container. The
directory is deliberately outside the repository and must remain untracked:

```bash
sudo install -d -o root -g root -m 0750 /var/lib/second-brain/system-health
sudo install -m 0750 scripts/collect-system-health-snapshot.sh \
  /usr/local/sbin/second-brain-system-health-snapshot
```

The scheduled service below runs as the host's reviewed operations identity
(root by default). Docker's local control socket is privilege-sensitive, so do
not add the API identity to the `docker` group, give it `docker` access, or
mount `/var/run/docker.sock` into it.

Run one collection before exposing its read-only bind mount:

```bash
sudo SYSTEM_HEALTH_SNAPSHOT_PATH=/var/lib/second-brain/system-health/snapshot.json \
  SYSTEM_HEALTH_DISK_PATH=/var/lib/second-brain \
  /usr/local/sbin/second-brain-system-health-snapshot
```

The result is mode `0640` and is atomically renamed only after all numeric
metrics and Docker aggregate counts are collected. Keep the file host-private;
mount the single file read-only into the API only when the API's System Health
configuration is enabled. Do not expose it through the public User beta.

## Scheduled collection

Use the reviewed templates in `scripts/systemd/` with the system scheduler
already approved for the staging host. They use a 60-second cadence and the
host operations identity by default; never use the API service identity.

```ini
sudo install -m 0644 scripts/systemd/second-brain-system-health-snapshot.service \
  /etc/systemd/system/second-brain-system-health-snapshot.service
sudo install -m 0644 scripts/systemd/second-brain-system-health-snapshot.timer \
  /etc/systemd/system/second-brain-system-health-snapshot.timer
```

```ini
# `scripts/systemd/` is source-controlled; the installed units stay host-owned.
```

After an operations review, install and activate the timer with:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now second-brain-system-health-snapshot.timer
sudo systemctl start second-brain-system-health-snapshot.service
sudo systemctl status second-brain-system-health-snapshot.timer --no-pager
```

The API-side parser must enforce schema version 1, allowlist the numeric fields,
and reject snapshots older than its explicitly configured freshness interval.
Threshold-based alerts for disk, latency, and error rate remain
`BUSINESS_DECISION_REQUIRED` until an approved policy exists; the collector does
not infer or trigger alerts, incidents, restarts, deployments, or repairs.

## Data fidelity rules

- SMTP `HEALTHY` is a fresh startup verification only. Once that observation is
  older than five minutes, the API returns `UNKNOWN`; the collector does not
  send a message just to refresh health.
- Provider ledger rendering samples at most 500 recent attempts per request. If
  the range contains more records, the screen reports `INSUFFICIENT_DATA` and
  labels the visible counts as lower bounds instead of period totals.
- The collector does not produce a "validation evidence" count. The UI must not
  manufacture a zero for a metric it does not collect.

## Read-only API mount

Use `scripts/compose.infrastructure-health.yml` only as a Compose override for
the private staging API. Store these non-secret operational paths in the
existing owner-only P1 configuration directory, not in Git:

```bash
SYSTEM_HEALTH_SNAPSHOT_HOST_PATH=/var/lib/second-brain/system-health/snapshot.json
SYSTEM_HEALTH_SNAPSHOT_MAX_AGE_SECONDS=300
```

The same private P1 environment must already contain its audited
`OTP_HMAC_SECRET`. The override forwards that required runtime secret to the
API without recording, generating, or displaying its value. A missing value is
a fail-closed deployment configuration error, not a health state.

Then merge the override with the existing private Compose file during the API
recreate. The override mounts exactly one file at
`/run/second-brain/system-health/snapshot.json` read-only. It does **not** mount
the Docker socket, a directory, logs, environment files, or any host-control
interface. If the mount is absent, unreadable, invalid, or stale, the Admin UI
must show `NOT_INSTRUMENTED` or `UNKNOWN` rather than a healthy resource state.
