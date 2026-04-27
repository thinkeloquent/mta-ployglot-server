# doctor-checks.sh — diagnostic + fix functions sourced by doctor.sh.
#
# Each `check__<area>__<name>` function emits exactly one TSV record:
#   <name>\t<severity>\t<ok:0|1>\t<message>\t<fix_hint>
# Severity tiers: error (blocks ci), warn (visible, doesn't block), info
# (visible only with --verbose).
#
# An auto-fixer for a check is named `fix__<area>__<name>` (dotted check
# name with each `.` replaced by `__`).
#
# `$ROOT_DIR` is exported by doctor.sh.

# ---------- helpers ----------

# Portable relative-path helper (BSD realpath lacks --relative-to).
_relpath() {
  python3 - "$1" "$2" <<'PY'
import os, sys
print(os.path.relpath(sys.argv[1], sys.argv[2]))
PY
}

# ---------- checks ----------

check__git__core_symlinks() {
  # Platform-aware: git's default for core.symlinks is `true` on POSIX,
  # `false` on Windows. Treating "unset" as an error universally would
  # false-positive on every healthy macOS / Linux clone.
  local val
  val="$(git config --global --get core.symlinks 2>/dev/null || true)"
  : "${val:=unset}"
  if [[ "$val" == "true" ]]; then
    printf 'git.core_symlinks\tinfo\t1\tcore.symlinks=true\tnone'
  elif [[ "$val" == "false" ]]; then
    printf 'git.core_symlinks\terror\t0\tcore.symlinks=false (explicit)\tgit config --global core.symlinks true'
  else
    # unset → defaults differ by platform.
    case "$(uname -s)" in
      MINGW*|MSYS*|CYGWIN*)
        printf 'git.core_symlinks\terror\t0\tcore.symlinks=unset (Windows default = false)\tgit config --global core.symlinks true'
        ;;
      *)
        printf 'git.core_symlinks\tinfo\t1\tcore.symlinks=unset (POSIX default = true)\tnone'
        ;;
    esac
  fi
}

check__os__symlink_priv() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      # Two viable Windows paths: Developer Mode (registry key) or admin token.
      if [[ -n "$(net session 2>/dev/null)" ]] \
         || reg query 'HKCU\Software\Microsoft\Windows\CurrentVersion\AppModelUnlock' /v AllowDevelopmentWithoutDevLicense 2>/dev/null | grep -q 0x1; then
        printf 'os.symlink_priv\tinfo\t1\tWindows symlink privilege OK\tnone'
      else
        printf 'os.symlink_priv\terror\t0\tWindows lacks symlink privilege\tEnable Developer Mode or grant SeCreateSymbolicLinkPrivilege'
      fi
      ;;
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        printf 'os.symlink_priv\tinfo\t1\tWSL: symlinks ok inside the Linux fs\tnone'
      else
        printf 'os.symlink_priv\tinfo\t1\tLinux; n/a\tnone'
      fi
      ;;
    *)
      printf 'os.symlink_priv\tinfo\t1\t%s; n/a\tnone' "$(uname -s)"
      ;;
  esac
}

check__symlinks__absolute() {
  local found=0 link target
  if [[ -d "$ROOT_DIR/ployglots" ]]; then
    while IFS= read -r link; do
      [[ -z "$link" ]] && continue
      target="$(readlink "$link" 2>/dev/null || true)"
      [[ "$target" = /* ]] && found=$((found + 1))
    done < <(find "$ROOT_DIR/ployglots" -maxdepth 3 -type l 2>/dev/null)
  fi
  if [[ "$found" -eq 0 ]]; then
    printf 'symlinks.absolute\tinfo\t1\tno absolute symlinks under ployglots/\tnone'
  else
    printf 'symlinks.absolute\twarn\t0\t%d absolute symlink(s) under ployglots/\trun: make doctor-fix CONFIRM=1' "$found"
  fi
}

check__symlinks__orphans() {
  local orphans=0 link
  if [[ -d "$ROOT_DIR/ployglots" ]]; then
    while IFS= read -r link; do
      [[ -z "$link" ]] && continue
      if [[ ! -e "$link" ]]; then
        orphans=$((orphans + 1))
      fi
    done < <(find "$ROOT_DIR/ployglots" -maxdepth 3 -type l 2>/dev/null)
  fi
  if [[ "$orphans" -eq 0 ]]; then
    printf 'symlinks.orphans\tinfo\t1\tno orphan symlinks\tnone'
  else
    printf 'symlinks.orphans\terror\t0\t%d orphan symlink(s)\tre-run scripts/workspace/bootstrap.sh' "$orphans"
  fi
}

check__shell__empty_main() {
  # Sum tracked-content size at HEAD. `git ls-tree --long` puts size in
  # column 4: <mode> <type> <object> <size>\t<path>.
  local cap="${EMPTY_MAIN_CAP_MB:-10}"
  local size_mb
  size_mb="$(git -C "$ROOT_DIR" ls-tree -r --long HEAD 2>/dev/null \
    | awk '$4 ~ /^[0-9]+$/ {sum+=$4} END{printf "%.0f", (sum?sum:0)/1024/1024}')"
  : "${size_mb:=0}"
  if [[ "$size_mb" -le "$cap" ]]; then
    printf 'shell.empty_main\tinfo\t1\tmain tree is %sMB (cap %s)\tnone' "$size_mb" "$cap"
  else
    printf 'shell.empty_main\terror\t0\tmain tree is %sMB > %sMB cap\treview growth; main is meant to be an orchestration shell' "$size_mb" "$cap"
  fi
}

# ---------- fixers ----------

fix__symlinks__absolute() {
  local link target rel
  while IFS= read -r link; do
    [[ -z "$link" ]] && continue
    target="$(readlink "$link" 2>/dev/null || true)"
    [[ "$target" = /* ]] || continue
    rel="$(_relpath "$target" "$(dirname "$link")")"
    rm "$link"
    ln -s "$rel" "$link"
    echo "  rewrote $link → $rel"
  done < <(find "$ROOT_DIR/ployglots" -maxdepth 3 -type l 2>/dev/null)
}
