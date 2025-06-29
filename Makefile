LABEL_SELECTOR = deploy/ctscheduling
NAMESPACE = ctscheduling
DEPLOYMENT_NAME = production
REPLACEMENTS_FILE = deployments/production/.replacements


# Build target: Increments version and runs build script
build:
	@echo "Incrementing version in frontend/package.json..."
	cd frontend && npm version patch
	cd ..
	@echo "Running build script..."
	./build.sh

update-replacement:
	$(eval NEW_VERSION := $(shell cd frontend && node -p "require('./package.json').version"))
	@echo "Updating CTSCHEDULING_IMAGE version in $(REPLACEMENTS_FILE) to $(NEW_VERSION)"
	sed -i.bak -E 's|(CTSCHEDULING_IMAGE=//ctscheduling/ctscheduling:)[^[:space:]]+|\1$(NEW_VERSION)|' $(REPLACEMENTS_FILE)

# Diff target: Updates image tag and shows deployment diff
diff:
	@echo "Updating tag in deployments/base/.replacements..."
	$(eval NEW_VERSION := $(shell cd frontend && node -p "require('./package.json').version"))
	sed -i.bak -E 's|(/ctscheduling/ctscheduling:)[^[:space:]]+|\1$(NEW_VERSION)|' $(REPLACEMENTS_FILE)	
	@echo "Showing Kubernetes deployment diff..."
	kubectl diff -k deployments/$(DEPLOYMENT_NAME)

# Deploy target: Applies production configuration
deploy:
	@echo "Applying production deployment..."
	kubectl apply -k deployments/$(DEPLOYMENT_NAME)

rollback:
	@echo "Rolling back deployment $(DEPLOYMENT_NAME) in namespace $(NAMESPACE)..."
	kubectl rollout undo deployment/$(DEPLOYMENT_NAME) -n $(NAMESPACE)
	@echo "Rollback complete. Current rollout status:"
	kubectl rollout status deployment/$(DEPLOYMENT_NAME) -n $(NAMESPACE)

clean:
	rm -f deployments/production/.replacements.bak

.PHONY: build diff deploy rollback clean

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