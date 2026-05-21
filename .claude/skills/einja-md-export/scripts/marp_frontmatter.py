#!/usr/bin/env python3
"""
marp_frontmatter.py

Injects Marp YAML front matter into a Markdown file.
If the file already has front matter, Marp-specific fields are merged in
(existing values are NOT overwritten).

Usage:
    python3 marp_frontmatter.py --input <input.md> --output <output.md> [--theme default|gaia|uncover]
"""

import argparse
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Minimal YAML front-matter parser / serialiser
# Supports only the flat "key: value" and "key: [item1, item2]" patterns
# that are needed for Marp front matter.
# ---------------------------------------------------------------------------

def _parse_frontmatter(text: str) -> tuple[dict, str]:
    """Return (fields_dict, body_text).

    If *text* starts with a YAML front-matter block (delimited by `---`),
    parse it and return the remaining body.  Otherwise return ({}, text).

    Only flat ``key: value`` lines are parsed; unrecognised lines are stored
    verbatim under the special key ``_raw_lines`` so they can be round-tripped.
    """
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return {}, text

    # Find the closing delimiter
    rest = text[4:]  # skip opening "---\n"
    end_idx = rest.find("\n---\n")
    end_idx_crlf = rest.find("\r\n---\r\n")

    if end_idx == -1 and end_idx_crlf == -1:
        # Malformed front matter – treat as no front matter
        return {}, text

    if end_idx != -1 and (end_idx_crlf == -1 or end_idx <= end_idx_crlf):
        fm_text = rest[:end_idx]
        body = rest[end_idx + 5:]  # skip "\n---\n"
    else:
        fm_text = rest[:end_idx_crlf]
        body = rest[end_idx_crlf + 7:]  # skip "\r\n---\r\n"

    fields: dict = {}
    raw_lines: list[str] = []

    for line in fm_text.splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip()
            if key:
                fields[key] = _parse_value(value)
                raw_lines.append(line)
                continue
        # Keep unrecognised lines verbatim
        raw_lines.append(line)

    fields["_raw_lines"] = raw_lines
    return fields, body


def _parse_value(value: str):
    """Parse a scalar or flat inline-array YAML value."""
    value = value.strip()

    # Inline array: [item1, item2, ...]
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1]
        items = [item.strip() for item in inner.split(",") if item.strip()]
        parsed_items = []
        for item in items:
            parsed_items.append(_parse_scalar(item))
        return parsed_items

    return _parse_scalar(value)


def _parse_scalar(value: str):
    """Convert a string scalar to int/bool/str as appropriate."""
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    try:
        return int(value)
    except ValueError:
        pass
    # Strip surrounding quotes if present
    if (value.startswith('"') and value.endswith('"')) or \
       (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    return value


def _serialise_value(value) -> str:
    """Serialise a Python value back to a YAML-compatible string."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        items = ", ".join(_serialise_value(v) for v in value)
        return f"[{items}]"
    return str(value)


def _serialise_frontmatter(fields: dict) -> str:
    """Produce the YAML front-matter block (without the `---` delimiters)."""
    raw_lines: list[str] = fields.get("_raw_lines", [])

    # Build a list of lines, preserving original order for existing keys
    # and appending new keys at the end.
    seen_keys: set[str] = set()
    output_lines: list[str] = []

    for line in raw_lines:
        if ":" in line:
            key, _, _ = line.partition(":")
            key = key.strip()
            if key and key in fields:
                # Re-serialise the (possibly updated) value
                output_lines.append(f"{key}: {_serialise_value(fields[key])}")
                seen_keys.add(key)
                continue
        output_lines.append(line)

    # Append any keys that were not in the original raw lines
    for key, value in fields.items():
        if key.startswith("_"):
            continue  # internal metadata
        if key not in seen_keys:
            output_lines.append(f"{key}: {_serialise_value(value)}")

    return "\n".join(output_lines)


# ---------------------------------------------------------------------------
# Main logic
# ---------------------------------------------------------------------------

MARP_DEFAULTS: dict = {
    "marp": True,
    "theme": "default",           # overridden by --theme argument
    "headingDivider": [1, 2],
    "paginate": True,
}


def inject_marp_frontmatter(input_path: Path, output_path: Path, theme: str) -> None:
    text = input_path.read_text(encoding="utf-8")

    fields, body = _parse_frontmatter(text)

    # Build the desired Marp fields, respecting existing values
    marp_fields = dict(MARP_DEFAULTS)
    marp_fields["theme"] = theme

    for key, value in marp_fields.items():
        if key not in fields:
            fields[key] = value
        # If already present, keep the existing value (user wins)

    fm_content = _serialise_frontmatter(fields)
    result = f"---\n{fm_content}\n---\n{body}"

    output_path.write_text(result, encoding="utf-8")
    print(f"Generated: {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inject Marp front matter into a Markdown file."
    )
    parser.add_argument("--input", required=True, help="Path to the input .md file")
    parser.add_argument("--output", required=True, help="Path to the output .md file")
    parser.add_argument(
        "--theme",
        default="default",
        choices=["default", "gaia", "uncover"],
        help="Marp theme (default: default)",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print(f"Error: input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    inject_marp_frontmatter(input_path, output_path, args.theme)


if __name__ == "__main__":
    main()
