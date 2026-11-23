#!/bin/bash
set -euo pipefail

stage_dir=""
backup_dir=""
target_dir=""
finish() {
  local result=$?
  if [ -n "$backup_dir" ] && [ -d "$backup_dir" ] && [ ! -e "$target_dir" ]; then
    mv "$backup_dir" "$target_dir" || echo "Restore the previous installation from $backup_dir"
  fi
  if [ -n "$stage_dir" ] && [ -d "$stage_dir" ]; then
    rm -rf "$stage_dir"
  fi
  if [ "$result" -ne 0 ]; then echo "Installation failed."; fi
  if [ -t 0 ]; then read -r -p "Press Enter to close..." answer || true; fi
  exit "$result"
}
trap finish EXIT

fail() {
  echo "$1" >&2
  exit 1
}

bundle_id=com.bonodigital.timelinehelper
source_dir="$(cd "$(dirname "$0")" && pwd -P)"
extensions_dir="$HOME/Library/Application Support/Adobe/CEP/extensions"
for item in CSXS/manifest.xml dist/index.html dist/app.js dist/CSInterface.js jsfl/DuplicateLayerToGuideAndBitmap.jsfl jsx/AutoImageTrace.jsx jsx/AutoImageTraceHandler.jsx; do
  [ -f "$source_dir/$item" ] || fail "Missing $item. Keep the entire Timeline Helper folder together."
done
bundle_matches() {
  [ -f "$1/CSXS/manifest.xml" ] &&
    grep -Fq "ExtensionBundleId=\"$bundle_id\"" "$1/CSXS/manifest.xml"
}
bundle_matches "$source_dir" || fail "Invalid Timeline Helper manifest."
if pgrep -x 'Adobe Animate|Animate|Adobe Illustrator' >/dev/null; then
  fail "Quit Adobe Animate and Illustrator before installing."
fi

mkdir -p "$extensions_dir"
extensions_dir="$(cd "$extensions_dir" && pwd -P)"
target_dir="$extensions_dir/$bundle_id"
[ ! -L "$target_dir" ] || fail "The installation folder is a symbolic link."
if [ "$source_dir" != "$target_dir" ]; then
  case "$source_dir/" in "$target_dir/"*) fail "Move the source folder outside the installation folder.";; esac
  if [ -e "$target_dir" ]; then
    bundle_matches "$target_dir" || fail "The destination belongs to another project."
    [ ! -e "$target_dir/.git" ] && [ ! -L "$target_dir/.git" ] ||
      fail "The destination is a Git checkout. Run its own installer."
  fi
  stage_dir="$(mktemp -d "$extensions_dir/.timelinehelper-install.XXXXXX")"
  for item in CSXS dist jsfl jsx Install-macOS.command Install-Windows.cmd Install-Windows.ps1; do
    [ -z "$(find "$source_dir/$item" -type l -print -quit)" ] ||
      fail "The installer source contains a symbolic link in $item."
    cp -R "$source_dir/$item" "$stage_dir/"
  done
fi

for cep_version in 8 9 10 11 12; do
  defaults write "com.adobe.CSXS.$cep_version" PlayerDebugMode -string 1
done

if [ -n "$stage_dir" ]; then
  if [ -e "$target_dir" ]; then
    backup_root="$(mktemp -d "$extensions_dir/../timelinehelper-backup.XXXXXX")"
    backup_dir="$backup_root/$bundle_id"
    mv "$target_dir" "$backup_dir"
  fi
  mv "$stage_dir" "$target_dir"
  stage_dir=""
fi
echo "Timeline Helper is ready at $target_dir"
if [ -n "$backup_dir" ]; then echo "Previous installation saved at $backup_dir"; fi
echo "Start Animate or Illustrator and open Window > Extensions > Timeline Helper."
