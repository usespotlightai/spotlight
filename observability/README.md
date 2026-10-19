# Observability

A Grafana dashboard and Prometheus alert rules for the Spotlight control plane.

| File | Contains |
| --- | --- |
| `grafana/spotlight-control-plane.json` | The dashboard. Import it and pick a Prometheus data source. |
| `prometheus/spotlight-alerts.yml` | The alert rules, for Prometheus, Mimir or Grafana alerting. |

Both read the metrics that Spotlight exports when an `OTEL_*` exporter is set.
The rules select series whose `job` ends in `spotlight-control-plane`.

The variables, the metric list and the alerts are in the docs:
[Observability](https://docs.usespotlight.ai/docs/reference/observability).
