SHELL     := /bin/bash
UVICORN   := uvicorn
PORT      ?= 8000
CONTAINER := nifty-backend

.PHONY: run terminal console

## Start the development server locally with hot-reload
run:
	PYTHONPATH=. $(UVICORN) app.main:app --reload --host 0.0.0.0 --port $(PORT)

## Open an interactive bash shell inside the running backend container
terminal:
	docker exec -it $(CONTAINER) bash

## Open a Python REPL inside the running backend container (DB connected, everything imported)
console:
	docker exec -it $(CONTAINER) python scripts/console.py
