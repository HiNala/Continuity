import os
from collections import defaultdict


INCLUDE_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
    ".scss",
    ".html",
    ".json",
    ".yml",
    ".yaml",
    ".sh",
    ".sql",
    ".mjs",
    ".cjs",
}

IGNORE_DIRS = {
    ".git",
    ".next",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    "dist",
    "build",
    "coverage",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}

IGNORE_FILES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
}


def should_skip_dir(dir_name: str) -> bool:
    return dir_name in IGNORE_DIRS


def count_lines(file_path: str) -> int:
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as handle:
            return sum(1 for _ in handle)
    except OSError:
        return 0


def main() -> None:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    total_lines = 0
    totals_by_ext = defaultdict(int)
    files_counted = 0

    for current_root, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]

        for filename in filenames:
            if filename in IGNORE_FILES:
                continue

            _, ext = os.path.splitext(filename)
            if ext not in INCLUDE_EXTENSIONS:
                continue

            file_path = os.path.join(current_root, filename)
            line_count = count_lines(file_path)
            totals_by_ext[ext] += line_count
            total_lines += line_count
            files_counted += 1

    print("Approximate LOC (source files only)")
    print(f"Total lines: {total_lines}")
    print(f"Files counted: {files_counted}")
    print("By extension:")
    for ext in sorted(totals_by_ext.keys()):
        print(f"  {ext}: {totals_by_ext[ext]}")


if __name__ == "__main__":
    main()
