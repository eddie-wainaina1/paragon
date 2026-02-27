"""OpenTelemetry setup — traces, metrics, and logs."""
import logging
import sys
from typing import Sequence

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider, ReadableSpan
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import (
    MetricExporter,
    MetricExportResult,
    MetricsData,
    PeriodicExportingMetricReader,
)

from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.instrumentation.logging import LoggingInstrumentor

from app.config import settings

logger = logging.getLogger(__name__)


class OneLineSpanExporter(SpanExporter):
    """Prints each span as a single log line: METHOD path → status (duration)."""

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        for span in spans:
            attrs = span.attributes or {}
            method = attrs.get("http.method", "")
            route = attrs.get("http.route") or attrs.get("http.target", span.name)
            status = attrs.get("http.status_code", "")
            duration_ms = (span.end_time - span.start_time) / 1_000_000 if span.end_time and span.start_time else 0
            parts = [p for p in [method, route] if p]
            label = " ".join(str(p) for p in parts) or span.name
            print(f"[trace] {label} → {status} ({duration_ms:.1f}ms)", file=sys.stderr, flush=True)
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        pass


class OneLineMetricExporter(MetricExporter):
    """Prints each metric data point as a single log line: name value unit."""

    def export(self, data: MetricsData, **_kwargs) -> MetricExportResult:
        for resource_metric in data.resource_metrics:
            for scope_metric in resource_metric.scope_metrics:
                for metric in scope_metric.metrics:
                    for dp in getattr(metric.data, "data_points", []):
                        value = getattr(dp, "value", None)
                        if value is None:
                            s = getattr(dp, "sum", 0)
                            c = getattr(dp, "count", 0)
                            value = f"sum={s} count={c}"
                        unit = f" {metric.unit}" if metric.unit else ""
                        print(f"[metric] {metric.name} {value}{unit}", file=sys.stderr, flush=True)
        return MetricExportResult.SUCCESS

    def shutdown(self) -> None:
        pass

    def force_flush(self) -> bool:
        return True


def setup_telemetry() -> None:
    resource = Resource(attributes={SERVICE_NAME: settings.otel_service_name})
    exporter = settings.otel_exporter  # "otlp" | "console" | "none"

    # ── Tracer Provider ──────────────────────────────────────────────────────
    tracer_provider = TracerProvider(resource=resource)

    if exporter == "otlp":
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        span_exporter = OTLPSpanExporter(
            endpoint=f"{settings.otel_exporter_otlp_endpoint}/v1/traces"
        )
        tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
    elif exporter == "console":
        tracer_provider.add_span_processor(BatchSpanProcessor(OneLineSpanExporter()))

    trace.set_tracer_provider(tracer_provider)

    # ── Meter Provider ───────────────────────────────────────────────────────
    metric_readers = []

    if exporter == "otlp":
        from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
        metric_exporter = OTLPMetricExporter(
            endpoint=f"{settings.otel_exporter_otlp_endpoint}/v1/metrics"
        )
        metric_readers.append(PeriodicExportingMetricReader(metric_exporter, export_interval_millis=30_000))
    elif exporter == "console":
        metric_readers.append(PeriodicExportingMetricReader(OneLineMetricExporter(), export_interval_millis=30_000))

    meter_provider = MeterProvider(resource=resource, metric_readers=metric_readers)
    metrics.set_meter_provider(meter_provider)

    # ── Logging ──────────────────────────────────────────────────────────────
    # Only inject trace context into log records when actually exporting
    if exporter != "none":
        LoggingInstrumentor().instrument(set_logging_format=True)

    logger.info(
        "OpenTelemetry configured",
        extra={"exporter": exporter, "service": settings.otel_service_name},
    )


def get_tracer(name: str = __name__) -> trace.Tracer:
    return trace.get_tracer(name)


def get_meter(name: str = __name__) -> metrics.Meter:
    return metrics.get_meter(name)
