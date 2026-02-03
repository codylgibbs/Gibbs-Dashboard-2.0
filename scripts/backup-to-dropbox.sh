#!/bin/bash
# Backup a file to Dropbox using Dropbox CLI
# Usage: ./backup-to-dropbox.sh /path/to/file /Dropbox/target/path

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <local_file_path> <dropbox_target_path>"
  exit 1
fi

LOCAL_FILE="$1"
DROPBOX_PATH="$2"

dropbox_uploader upload "$LOCAL_FILE" "$DROPBOX_PATH"
