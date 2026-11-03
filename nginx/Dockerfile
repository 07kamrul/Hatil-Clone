# The config is copied into the image rather than bind-mounted, so deploys (Dokploy, remote Docker hosts)
# do not depend on the repo path existing on the Docker host.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
