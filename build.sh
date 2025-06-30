export DOCKER_IMAGE=ctscheduling

# Extract version from package.json
version=$(grep '"version":' frontend/package.json | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')

# Build the Docker image
docker build --no-cache -t $DOCKER_IMAGE:${version} .

# Tag the Docker image
docker tag $DOCKER_IMAGE:${version} $DOCKER_REPO/$DOCKER_IMAGE:${version}
docker tag $DOCKER_IMAGE:${version} $DOCKER_REPO/$DOCKER_IMAGE:latest

# Push the Docker image
docker push $DOCKER_REPO/$DOCKER_IMAGE:${version}
docker push $DOCKER_REPO/$DOCKER_IMAGE:latest