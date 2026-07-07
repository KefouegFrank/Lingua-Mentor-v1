FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install poetry && poetry install --no-root
COPY . .
CMD ["poetry", "run", "arq", "app.worker_settings.WorkerSettings"]
