#!/usr/bin/env bash
# =============================================================================
#  Publish the invitation to a Google Cloud Storage static website.
#
#  Run this from your own machine, where you are already logged in to gcloud.
#  It is idempotent — safe to run again every time you change the party details.
#
#  Usage:
#     ./deploy/gcs-deploy.sh my-bucket-name            # first run and every run
#     ./deploy/gcs-deploy.sh my-bucket-name us-east1   # pick a region
#
#  Afterwards the invitation is at:
#     https://storage.googleapis.com/<bucket>/index.html
# =============================================================================
set -euo pipefail

BUCKET="${1:-}"
LOCATION="${2:-US}"

if [[ -z "$BUCKET" ]]; then
  echo "Usage: $0 <bucket-name> [location]" >&2
  echo "The bucket name has to be globally unique — 'xyla-birthday-2026' style." >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is not installed. Get it from https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Building the single-file version first"
node tools/build.js

echo "==> Making sure the bucket exists"
if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" \
    --location="${LOCATION}" \
    --uniform-bucket-level-access
else
  echo "    (already there)"
fi

echo "==> Serving index.html as the site root"
gcloud storage buckets update "gs://${BUCKET}" \
  --web-main-page-suffix=index.html \
  --web-error-page=index.html

echo "==> Making it publicly readable"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member=allUsers \
  --role=roles/storage.objectViewer >/dev/null

echo "==> Uploading"
# Long cache for the vendored library, which never changes.
gcloud storage rsync -r ./vendor "gs://${BUCKET}/vendor" \
  --cache-control="public, max-age=31536000, immutable"

# Short cache for everything else, so edits to the party details show up fast.
for dir in js css; do
  gcloud storage rsync -r "./${dir}" "gs://${BUCKET}/${dir}" \
    --cache-control="public, max-age=300"
done

gcloud storage cp ./index.html ./config.js "gs://${BUCKET}/" \
  --cache-control="public, max-age=60"

gcloud storage cp ./dist/xyla-invite.html "gs://${BUCKET}/" \
  --cache-control="public, max-age=60"

echo
echo "Done."
echo "   Invitation:  https://storage.googleapis.com/${BUCKET}/index.html"
echo "   Single file: https://storage.googleapis.com/${BUCKET}/xyla-invite.html"
echo
echo "Note: a GCS website on your own custom domain is HTTP-only unless you put"
echo "an HTTPS load balancer or Cloudflare in front of it. The storage.googleapis.com"
echo "link above is already HTTPS, so for texting a link to family it is the"
echo "simpler choice."
