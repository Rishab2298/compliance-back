#!/bin/bash

# Setup S3 CORS Configuration for LogiLink
# This script configures CORS on the S3 bucket to allow direct uploads from the browser

echo "Setting up CORS for S3 bucket: decipher-logilink"
echo "Region: ca-central-1"
echo ""

# Apply CORS configuration
aws s3api put-bucket-cors \
  --bucket decipher-logilink \
  --cors-configuration file://cors-config.json \
  --region ca-central-1

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ CORS configuration applied successfully!"
  echo ""
  echo "Verifying CORS configuration..."
  aws s3api get-bucket-cors \
    --bucket decipher-logilink \
    --region ca-central-1
  echo ""
  echo "✅ Setup complete! Try uploading files again."
else
  echo ""
  echo "❌ Failed to apply CORS configuration."
  echo "Please check your AWS credentials and permissions."
fi
