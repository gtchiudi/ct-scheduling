LABEL_SELECTOR = deploy/ctscheduling
NAMESPACE = ctscheduling
DEPLOYMENT_NAME = ctscheduling
REPLACEMENTS_FILE = deployments/production/.replacements


# Build target: Increments version and runs build script
build:
	@echo "Incrementing version in frontend/package.json..."
	cd frontend && npm version patch
	cd ..
	@echo "Running build script..."
	./build.sh

# Diff target: Updates image tag and shows deployment diff
diff:
	@echo "Updating tag in deployments/base/.replacements..."
	$(eval NEW_VERSION := $(shell cd frontend && node -p "require('./package.json').version"))
	sed -i.bak -E 's|(/ctscheduling/ctscheduling:)[^[:space:]]+|\1$(NEW_VERSION)|' $(REPLACEMENTS_FILE)	
	@echo "Showing Kubernetes deployment diff..."
	kubectl diff -k deployments/production || true

# Deploy target: Applies production configuration
deploy:
	@echo "Applying production deployment..."
	kubectl apply -k deployments/production

rollback:
	@if [ -n "$(REVISION)" ]; then \
		echo "Rolling back deployment $(DEPLOYMENT_NAME) in namespace $(NAMESPACE) to revision $(REVISION)..."; \
		kubectl rollout undo deployment/$(DEPLOYMENT_NAME) -n $(NAMESPACE) --to-revision=$(REVISION); \
	else \
		echo "Rolling back deployment $(DEPLOYMENT_NAME) in namespace $(NAMESPACE) to previous revision..."; \
		kubectl rollout undo deployment/$(DEPLOYMENT_NAME) -n $(NAMESPACE); \
	fi
	@echo "Rollback complete. Current rollout status:"
	kubectl rollout status deployment/$(DEPLOYMENT_NAME) -n $(NAMESPACE)

rollback-history:
	@echo "Getting rollback history for deployment $(DEPLOYMENT_NAME) in namespace $(NAMESPACE)..."
	kubectl rollout history deployment/$(DEPLOYMENT_NAME) -n $(NAMESPACE)


clean:
	rm -f deployments/production/.replacements.bak

doc-prune:
	docker system prune -af

# ─── Test targets ─────────────────────────────────────────────────────────────

# Backend unit tests (fast, in-memory SQLite, no network)
test:
	@echo "Running backend unit tests..."
	python -m pytest \
		--cov=members \
		--cov-report=term-missing \
		--cov-report=html:backend/htmlcov \
		-q
	@echo "Coverage report: backend/htmlcov/index.html"

# Frontend component/unit tests (Vitest + React Testing Library)
test-frontend:
	@echo "Running frontend tests..."
	cd frontend && npm run test
	@echo "Frontend tests complete."

# E2E tests against a running app instance
# Override target: make test-e2e E2E_BASE_URL=https://staging.example.com
test-e2e:
	@echo "Running E2E tests against $${E2E_BASE_URL:-http://localhost:8000}..."
	python -m pytest e2e/tests/ -v --tb=short -x

# Run backend + frontend unit tests, then build+deploy
# E2E tests are excluded from the deploy gate — run them post-deploy against staging
deploy-tested: test test-frontend
	@echo "All unit tests passed. Proceeding with deployment..."
	$(MAKE) build
	$(MAKE) diff
	$(MAKE) deploy

.PHONY: build diff deploy rollback clean migrate test test-frontend test-e2e deploy-tested

# Get most recent pod name (sorted by creation timestamp)
GET_POD = kubectl -n ctscheduling get pods --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1:].metadata.name}'

# Follow logs of most recent pod
logs:
	kubectl -n ctscheduling logs -f $(LABEL_SELECTOR)

# Start interactive shell in most recent pod
shell:
	@pod=$$($(GET_POD)) && \
	kubectl -n ctscheduling exec -it $$pod -- /bin/sh

# Start Django shell in most recent pod
django-shell:
	@pod=$$($(GET_POD)) && \
	kubectl -n ctscheduling exec -it $$pod -- python manage.py shell

# Run Django migrations in most recent pod
migrate:
	@pod=$$($(GET_POD)) && \
	kubectl -n ctscheduling exec -it $$pod -- python manage.py migrate --noinput