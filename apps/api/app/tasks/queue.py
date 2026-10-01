from concurrent.futures import ThreadPoolExecutor

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "scholarai",
    broker=settings.redis_url or "memory://",
    backend=settings.redis_url or "cache+memory://",
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_time_limit=300,
    task_soft_time_limit=270,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    broker_connection_retry_on_startup=True,
)
executor = ThreadPoolExecutor(max_workers=2)


def enqueue(kind, resource_id):
    if settings.task_mode == "celery":
        run_job.delay(kind, resource_id)
    elif settings.task_mode == "eager":
        run_job(kind, resource_id)
    else:
        executor.submit(run_job, kind, resource_id)


@celery_app.task(name="scholarai.run_job")
def run_job(kind, resource_id):
    from app.tasks.pipeline import process

    process(kind, resource_id)
