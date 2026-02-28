#!/bin/bash
# Quick reference for firmware and keymap commands
set -e

ROOT="$(git rev-parse --show-toplevel)"

case "${1:-help}" in
  help|--help|-h)
    echo "Usage: commands.sh <command>"
    echo ""
    echo "Commands:"
    echo "  help          Show this help"
    echo "  status        Show CI build status"
    echo "  flash         Flash firmware to a keyboard"
    echo "  draw          Draw keymap SVGs"
    echo "  list          List available keyboards"
    echo ""
    echo "Examples:"
    echo "  commands.sh status"
    echo "  commands.sh flash totem left"
    echo "  commands.sh flash eyelash left -r    # with settings reset"
    echo "  commands.sh draw totem"
    echo "  commands.sh draw                     # draw all"
    ;;
  status|s)
    amber run "$ROOT/scripts/fw.ab" s
    ;;
  flash|f)
    shift
    amber run "$ROOT/scripts/fw.ab" f "$@"
    ;;
  list|l)
    amber run "$ROOT/scripts/fw.ab" l
    ;;
  draw|d)
    shift
    "$ROOT/scripts/draw-keymaps.sh" "$@"
    ;;
  *)
    echo "Unknown command: $1"
    echo "Run 'commands.sh help' for usage"
    exit 1
    ;;
esac
