"""OpenTelemetry setup — traces, metrics, and logs."""
import logging

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import ConsoleMetricExporter, PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.instrumentation.logging import LoggingInstrumentor

from app.config import settings

logger = logging.getLogger(__name__)


def setup_telemetry() -> None:
    resource = Resource(attributes={SERVICE_NAME: settings.otel_service_name})

    # ── Tracer Provider ──────────────────────────────────────────────────────
    tracer_provider = TracerProvider(resource=resource)

    if settings.otel_exporter == "otlp":
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        span_exporter = OTLPSpanExporter(
            endpoint=f"{settings.otel_exporter_otlp_endpoint}/v1/traces"
        )
    else:
        span_exporter = ConsoleSpanExporter()

    tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
    trace.set_tracer_provider(tracer_provider)

    # ── Meter Provider ───────────────────────────────────────────────────────
    if settings.otel_exporter == "otlp":
        from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
        metric_exporter = OTLPMetricExporter(
            endpoint=f"{settings.otel_exporter_otlp_endpoint}/v1/metrics"
        )
    else:
        metric_exporter = ConsoleMetricExporter()

    metric_reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=30_000)
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)

    # ── Logging ──────────────────────────────────────────────────────────────
    LoggingInstrumentor().instrument(set_logging_format=True)

    logger.info(
        "OpenTelemetry configured",
        extra={"exporter": settings.otel_exporter, "service": settings.otel_service_name},
    )


def get_tracer(name: str = __name__) -> trace.Tracer:
    return trace.get_tracer(name)


def get_meter(name: str = __name__) -> metrics.Meter:
    return metrics.get_meter(name)
