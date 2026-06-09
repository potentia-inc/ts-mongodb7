.PHONY: test clean lint pretty fix dist

IMAGE=node:24-slim
USER=$(shell id -u):$(shell id -g)
WORKDIR=/app
VOLUME=$(PWD):$(WORKDIR)

test:
	docker compose build --pull
	docker compose run test || true
	docker compose down

clean:
	docker run --rm -u $(USER) -w $(WORKDIR) -v $(VOLUME) $(IMAGE) npm run clean

lint:
	docker run --rm -u $(USER) -w $(WORKDIR) -v $(VOLUME) $(IMAGE) npm run lint

pretty:
	docker run --rm -u $(USER) -w $(WORKDIR) -v $(VOLUME) $(IMAGE) npm run pretty

fix:
	docker run --rm -u $(USER) -w $(WORKDIR) -v $(VOLUME) $(IMAGE) npm run fix

dist:
	docker run --rm -u $(USER) -w $(WORKDIR) -v $(VOLUME) $(IMAGE) npm run dist
