#!/usr/bin/env python3
"""
Sidekick Documentation Index & Interactive Report Generator

Scans docs/ for feature and requirement specifications, parses YAML frontmatter and Markdown body,
computes bidirectional dependencies, and compiles a single standalone HTML report with dynamic JS navigation.
"""

import os
import re
import sys
import json
from pathlib import Path
from typing import Dict, List, Any, Optional

import yaml
import markdown
from jinja2 import Template

DOCS_DIR = Path(__file__).resolve().parent.parent
REPORTS_DIR = DOCS_DIR / "reports"
OUTPUT_FILE = REPORTS_DIR / "index.html"

# Folders to scan
SCAN_DIRS = [
    ("features", "feature"),
    ("requirements", "requirement"),
]

# Additional root docs to include if present
EXTRA_DOCS = [
    ("inventory_database_schema.md", "general"),
    ("scratchpad.md", "general"),
]


def parse_frontmatter(content: str) -> tuple[Dict[str, Any], str]:
    """Extract YAML frontmatter and body from Markdown text."""
    frontmatter = {}
    body = content

    # Regex for YAML frontmatter demarcated by ---
    pattern = r"^---\s*\n(.*?)\n---\s*\n(.*)$"
    match = re.search(pattern, content, re.DOTALL)
    if match:
        yaml_str = match.group(1)
        body = match.group(2)
        try:
            parsed = yaml.safe_load(yaml_str)
            if isinstance(parsed, dict):
                frontmatter = parsed
        except Exception as e:
            print(f"Warning: Failed to parse YAML frontmatter: {e}")

    return frontmatter, body


def extract_title(frontmatter: Dict[str, Any], body: str, default_title: str) -> str:
    """Determine document title from frontmatter, H1 heading, or filename fallback."""
    if "title" in frontmatter and frontmatter["title"]:
        return str(frontmatter["title"]).strip()

    # Search for first H1 header in markdown body
    h1_match = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
    if h1_match:
        return h1_match.group(1).strip()

    return default_title


def extract_status(frontmatter: Dict[str, Any]) -> str:
    """Normalize document status."""
    status = frontmatter.get("status", "Active")
    if not status or status == "None":
        status = "Active"
    return str(status).strip()


def extract_target(frontmatter: Dict[str, Any]) -> List[str]:
    """Normalize target platforms."""
    target = frontmatter.get("target", [])
    if isinstance(target, str):
        target = [target]
    elif not isinstance(target, list):
        target = []
    return [str(t).strip() for t in target if t]


def extract_raw_deps(frontmatter: Dict[str, Any]) -> List[str]:
    """Extract dependencies list, handling spelling variations."""
    deps = frontmatter.get("dependencies") or frontmatter.get("dependancies") or []
    if isinstance(deps, str):
        deps = [deps]
    elif not isinstance(deps, list):
        deps = []
    
    # Clean up items (handling edge cases like `- dependancies: []` inside a list item)
    cleaned = []
    for item in deps:
        if isinstance(item, dict):
            for k, v in item.items():
                if isinstance(v, list):
                    cleaned.extend([str(x).strip() for x in v])
        elif isinstance(item, str):
            item_str = item.strip()
            if item_str:
                cleaned.append(item_str)
    return cleaned


def format_task_lists(html_content: str) -> str:
    """Enhance HTML checkboxes from markdown lists."""
    html_content = re.sub(
        r'<li>\[\s*\]\s*',
        '<li class="task-item"><input type="checkbox" disabled class="task-checkbox"> ',
        html_content
    )
    html_content = re.sub(
        r'<li>\[[xX]\]\s*',
        '<li class="task-item completed"><input type="checkbox" checked disabled class="task-checkbox"> ',
        html_content
    )
    return html_content


def build_doc_index() -> List[Dict[str, Any]]:
    """Scan docs directory and collect structured document objects."""
    docs = []

    # 1. Scan subdirectories
    for subfolder, doc_type in SCAN_DIRS:
        folder_path = DOCS_DIR / subfolder
        if not folder_path.exists():
            continue
        
        for file_path in sorted(folder_path.glob("*.md")):
            if file_path.name.startswith("_") or file_path.name.startswith("."):
                continue  # Skip templates and hidden files

            rel_path = f"{subfolder}/{file_path.name}"
            content = file_path.read_text(encoding="utf-8")
            fm, body = parse_frontmatter(content)

            slug = file_path.stem
            title = extract_title(fm, body, slug.replace("-", " ").title())
            status = extract_status(fm)
            target = extract_target(fm)
            raw_deps = extract_raw_deps(fm)

            # Render HTML body
            md_renderer = markdown.Markdown(extensions=["extra", "tables", "fenced_code", "toc"])
            html_body = format_task_lists(md_renderer.convert(body))

            docs.append({
                "id": slug,
                "filename": file_path.name,
                "rel_path": rel_path,
                "type": doc_type,
                "title": title,
                "status": status,
                "target": target,
                "raw_dependencies": raw_deps,
                "prerequisites": [],  # Will be populated
                "dependents": [],     # Will be populated
                "html": html_body,
                "raw_markdown": body,
            })

    # 2. Scan extra root docs
    for extra_file, doc_type in EXTRA_DOCS:
        file_path = DOCS_DIR / extra_file
        if file_path.exists():
            rel_path = extra_file
            content = file_path.read_text(encoding="utf-8")
            fm, body = parse_frontmatter(content)
            slug = file_path.stem
            title = extract_title(fm, body, slug.replace("-", " ").title())
            
            md_renderer = markdown.Markdown(extensions=["extra", "tables", "fenced_code", "toc"])
            html_body = format_task_lists(md_renderer.convert(body))

            docs.append({
                "id": slug,
                "filename": file_path.name,
                "rel_path": rel_path,
                "type": doc_type,
                "title": title,
                "status": fm.get("status", "Active"),
                "target": extract_target(fm),
                "raw_dependencies": extract_raw_deps(fm),
                "prerequisites": [],
                "dependents": [],
                "html": html_body,
                "raw_markdown": body,
            })

    return docs


def resolve_bidirectional_dependencies(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Build resolution alias map and populate prerequisites & dependents lists."""
    lookup: Dict[str, Dict[str, Any]] = {}

    # Build alias mappings for flexible dependency resolution
    for doc in docs:
        doc_id = doc["id"]
        lookup[doc_id] = doc
        lookup[doc["filename"]] = doc
        lookup[doc["rel_path"]] = doc
        
        # Also map numeric prefix if available (e.g., '016' -> doc)
        num_match = re.match(r"^(\d+)", doc_id)
        if num_match:
            num_key = num_match.group(1)
            if num_key not in lookup:  # Don't overwrite exact matches
                lookup[num_key] = doc

    # Resolve dependencies
    for doc in docs:
        resolved_prereqs = []
        for raw_dep in doc["raw_dependencies"]:
            clean_dep = str(raw_dep).strip()
            target_doc = lookup.get(clean_dep)
            if not target_doc:
                # Try adding .md or removing features/ prefix
                target_doc = lookup.get(f"{clean_dep}.md") or lookup.get(clean_dep.replace("features/", "").replace("requirements/", ""))
            
            if target_doc and target_doc["id"] != doc["id"]:
                if target_doc["id"] not in [p["id"] for p in resolved_prereqs]:
                    resolved_prereqs.append({
                        "id": target_doc["id"],
                        "title": target_doc["title"],
                        "type": target_doc["type"],
                        "status": target_doc["status"],
                        "rel_path": target_doc["rel_path"]
                    })
                    
                    # Reverse dependency (dependent)
                    if not any(d["id"] == doc["id"] for d in target_doc["dependents"]):
                        target_doc["dependents"].append({
                            "id": doc["id"],
                            "title": doc["title"],
                            "type": doc["type"],
                            "status": doc["status"],
                            "rel_path": doc["rel_path"]
                        })

        doc["prerequisites"] = resolved_prereqs

    return docs


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sidekick Docs & Architecture Navigator</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js"></script>
    <style>
        :root {
            --bg-dark: #0b0f19;
            --panel-bg: rgba(22, 30, 46, 0.75);
            --panel-border: rgba(255, 255, 255, 0.08);
            --panel-border-hover: rgba(56, 189, 248, 0.3);
            --accent-blue: #38bdf8;
            --accent-indigo: #818cf8;
            --accent-purple: #c084fc;
            --text-main: #f1f5f9;
            --text-muted: #94a3b8;
            --text-dim: #64748b;
            
            --status-complete-bg: rgba(16, 185, 129, 0.15);
            --status-complete-border: #10b981;
            --status-inprogress-bg: rgba(245, 158, 11, 0.15);
            --status-inprogress-border: #f59e0b;
            --status-draft-bg: rgba(99, 102, 241, 0.15);
            --status-draft-border: #6366f1;
            --status-pending-bg: rgba(148, 163, 184, 0.15);
            --status-pending-border: #94a3b8;
            
            --sidebar-width: 340px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-main);
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background-image: 
                radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.08) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(129, 140, 248, 0.08) 0px, transparent 50%);
        }

        /* App Header */
        header {
            height: 64px;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--panel-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
            z-index: 50;
        }

        .header-brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .header-logo {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--accent-blue), var(--accent-indigo));
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            color: #fff;
            box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
        }

        .header-title {
            font-size: 1.1rem;
            font-weight: 600;
            letter-spacing: -0.01em;
            background: linear-gradient(90deg, #fff, #cbd5e1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .header-stats {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .stat-badge {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--panel-border);
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.78rem;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .stat-badge strong {
            color: var(--text-main);
        }

        .view-switchers {
            display: flex;
            background: rgba(255, 255, 255, 0.05);
            padding: 3px;
            border-radius: 8px;
            border: 1px solid var(--panel-border);
        }

        .view-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .view-btn.active {
            background: var(--accent-blue);
            color: #0b0f19;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(56, 189, 248, 0.4);
        }

        /* Main Container */
        .app-container {
            display: flex;
            flex: 1;
            height: calc(100vh - 64px);
            overflow: hidden;
            position: relative;
        }

        /* Sidebar Navigation */
        aside {
            width: var(--sidebar-width);
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(16px);
            border-right: 1px solid var(--panel-border);
            display: flex;
            flex-direction: column;
            z-index: 20;
        }

        .filter-panel {
            padding: 16px;
            border-bottom: 1px solid var(--panel-border);
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .search-box {
            position: relative;
        }

        .search-input {
            width: 100%;
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--panel-border);
            border-radius: 8px;
            padding: 8px 12px 8px 36px;
            color: var(--text-main);
            font-size: 0.85rem;
            outline: none;
            transition: border-color 0.2s ease;
        }

        .search-input:focus {
            border-color: var(--accent-blue);
        }

        .search-icon {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            width: 16px;
            height: 16px;
            color: var(--text-dim);
        }

        .filter-pills {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .pill {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--panel-border);
            border-radius: 6px;
            padding: 4px 10px;
            font-size: 0.75rem;
            color: var(--text-muted);
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .pill:hover, .pill.active {
            background: rgba(56, 189, 248, 0.15);
            border-color: var(--accent-blue);
            color: var(--accent-blue);
        }

        .doc-list {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .doc-item {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid transparent;
            border-radius: 8px;
            padding: 10px 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .doc-item:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: var(--panel-border);
        }

        .doc-item.active {
            background: rgba(56, 189, 248, 0.1);
            border-color: var(--accent-blue);
            box-shadow: 0 2px 10px rgba(56, 189, 248, 0.15);
        }

        .doc-item-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .doc-title {
            font-size: 0.88rem;
            font-weight: 500;
            color: var(--text-main);
            line-height: 1.3;
        }

        .doc-meta {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .tag {
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }

        .tag-feature { background: rgba(56, 189, 248, 0.15); color: var(--accent-blue); }
        .tag-requirement { background: rgba(192, 132, 252, 0.15); color: var(--accent-purple); }
        .tag-general { background: rgba(148, 163, 184, 0.15); color: var(--text-muted); }

        .status-badge {
            font-size: 0.68rem;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .status-complete { background: var(--status-complete-bg); color: #34d399; border: 1px solid var(--status-complete-border); }
        .status-inprogress { background: var(--status-inprogress-bg); color: #fbbf24; border: 1px solid var(--status-inprogress-border); }
        .status-draft { background: var(--status-draft-bg); color: #818cf8; border: 1px solid var(--status-draft-border); }
        .status-pending { background: var(--status-pending-bg); color: #94a3b8; border: 1px solid var(--status-pending-border); }

        /* Main Workspace */
        main {
            flex: 1;
            overflow-y: auto;
            position: relative;
            background: rgba(11, 15, 25, 0.5);
            display: flex;
            flex-direction: column;
        }

        .content-view {
            padding: 32px 48px;
            max-width: 1080px;
            margin: 0 auto;
            width: 100%;
        }

        .doc-header-card {
            background: var(--panel-bg);
            border: 1px solid var(--panel-border);
            border-radius: 14px;
            padding: 24px;
            margin-bottom: 24px;
            backdrop-filter: blur(12px);
            display: flex;
            flex-direction: column;
            gap: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .doc-header-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
        }

        .doc-main-title {
            font-size: 1.8rem;
            font-weight: 700;
            color: #fff;
            line-height: 1.2;
        }

        .target-list {
            display: flex;
            gap: 6px;
            margin-top: 4px;
        }

        .target-chip {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--panel-border);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.72rem;
            color: var(--text-muted);
        }

        /* Dependency Panels */
        .dependency-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 8px;
        }

        .dep-card {
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--panel-border);
            border-radius: 10px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .dep-card-title {
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-dim);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .dep-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .dep-link-item {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--panel-border);
            border-radius: 6px;
            padding: 8px 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: space-between;
            text-decoration: none;
            color: var(--text-main);
        }

        .dep-link-item:hover {
            background: rgba(56, 189, 248, 0.1);
            border-color: var(--accent-blue);
            transform: translateX(2px);
        }

        .dep-link-title {
            font-size: 0.84rem;
            font-weight: 500;
        }

        .empty-deps {
            font-size: 0.8rem;
            color: var(--text-dim);
            font-style: italic;
        }

        /* Markdown Rendered Content */
        .markdown-body {
            background: var(--panel-bg);
            border: 1px solid var(--panel-border);
            border-radius: 14px;
            padding: 36px;
            backdrop-filter: blur(12px);
            line-height: 1.7;
            font-size: 0.95rem;
            color: #cbd5e1;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
            color: #fff;
            margin-top: 1.8em;
            margin-bottom: 0.6em;
            font-weight: 600;
        }

        .markdown-body h1:first-child, .markdown-body h2:first-child {
            margin-top: 0;
        }

        .markdown-body h2 {
            font-size: 1.3rem;
            border-bottom: 1px solid var(--panel-border);
            padding-bottom: 8px;
        }

        .markdown-body p {
            margin-bottom: 1em;
        }

        .markdown-body ul, .markdown-body ol {
            margin-bottom: 1em;
            padding-left: 24px;
        }

        .markdown-body li {
            margin-bottom: 0.3em;
        }

        .markdown-body code {
            font-family: 'JetBrains Mono', monospace;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.85em;
            color: var(--accent-blue);
        }

        .markdown-body pre {
            background: rgba(5, 8, 15, 0.9);
            border: 1px solid var(--panel-border);
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin-bottom: 1em;
        }

        .markdown-body pre code {
            background: transparent;
            border: none;
            padding: 0;
            color: #e2e8f0;
        }

        .markdown-body table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1.5em;
            font-size: 0.88rem;
        }

        .markdown-body th, .markdown-body td {
            border: 1px solid var(--panel-border);
            padding: 10px 14px;
            text-align: left;
        }

        .markdown-body th {
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            font-weight: 600;
        }

        .task-item {
            list-style-type: none;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: -20px;
        }

        .task-checkbox {
            accent-color: var(--accent-blue);
            width: 16px;
            height: 16px;
            cursor: default;
        }

        .task-item.completed {
            color: var(--text-dim);
            text-decoration: line-through;
        }

        /* Graph View Workspace */
        #graph-container {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            display: none;
            background: #070a12;
            z-index: 10;
        }

        .graph-controls {
            position: absolute;
            top: 24px;
            right: 24px;
            display: flex;
            gap: 8px;
            z-index: 20;
        }

        .graph-btn {
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid var(--panel-border);
            color: var(--text-main);
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .graph-btn:hover {
            background: rgba(56, 189, 248, 0.15);
            border-color: var(--accent-blue);
            color: var(--accent-blue);
        }

        .graph-legend {
            position: absolute;
            bottom: 24px;
            right: 24px;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid var(--panel-border);
            border-radius: 10px;
            padding: 12px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 20;
            font-size: 0.78rem;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .legend-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }

        /* Scrollbars */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        @media (max-width: 900px) {
            .app-container { flex-direction: column; }
            aside { width: 100%; height: 260px; }
            .dependency-container { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>

    <header>
        <div class="header-brand">
            <div class="header-logo">S</div>
            <div class="header-title">Sidekick Architecture Index</div>
        </div>

        <div class="header-stats">
            <div class="stat-badge">Docs: <strong id="stat-total">0</strong></div>
            <div class="stat-badge">Features: <strong id="stat-features">0</strong></div>
            <div class="stat-badge">Requirements: <strong id="stat-reqs">0</strong></div>
            <div class="stat-badge">Complete: <strong id="stat-complete">0</strong></div>
        </div>

        <div class="view-switchers">
            <button class="view-btn active" id="btn-view-doc" onclick="switchView('doc')">Document View</button>
            <button class="view-btn" id="btn-view-graph" onclick="switchView('graph')">Dependency Graph</button>
        </div>
    </header>

    <div class="app-container">
        <!-- Sidebar -->
        <aside>
            <div class="filter-panel">
                <div class="search-box">
                    <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <input type="text" id="search-input" class="search-input" placeholder="Search features & specs..." oninput="applyFilters()">
                </div>
                <div class="filter-pills">
                    <button class="pill active" data-type="all" onclick="filterType('all', this)">All</button>
                    <button class="pill" data-type="feature" onclick="filterType('feature', this)">Features</button>
                    <button class="pill" data-type="requirement" onclick="filterType('requirement', this)">Requirements</button>
                </div>
            </div>

            <div class="doc-list" id="doc-list-container">
                <!-- Dynamically populated doc items -->
            </div>
        </aside>

        <!-- Main Content Workspace -->
        <main id="main-workspace">
            <div class="content-view" id="doc-view-container">
                <div class="doc-header-card">
                    <div class="doc-header-top">
                        <div>
                            <div class="doc-meta" style="margin-bottom: 6px;" id="header-tags">
                                <!-- Tag pills -->
                            </div>
                            <h1 class="doc-main-title" id="header-title">Select a Document</h1>
                        </div>
                        <div id="header-status">
                            <!-- Status badge -->
                        </div>
                    </div>

                    <div class="target-list" id="header-targets">
                        <!-- Targets list -->
                    </div>

                    <!-- Bidirectional Dependency Section -->
                    <div class="dependency-container">
                        <!-- Prerequisites -->
                        <div class="dep-card">
                            <div class="dep-card-title">
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18"></path></svg>
                                Depends On (Prerequisites)
                            </div>
                            <div class="dep-list" id="prereq-list">
                                <span class="empty-deps">No prerequisites</span>
                            </div>
                        </div>

                        <!-- Dependents -->
                        <div class="dep-card">
                            <div class="dep-card-title">
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                                Depended On By (Required By)
                            </div>
                            <div class="dep-list" id="dependent-list">
                                <span class="empty-deps">No incoming dependencies</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Markdown Rendered HTML Body -->
                <div class="markdown-body" id="markdown-content">
                    <p style="color: var(--text-dim);">Select a feature or requirement document from the sidebar to view detailed specifications and dependency links.</p>
                </div>
            </div>
        </main>

        <!-- Interactive Graph View Workspace -->
        <div id="graph-container">
            <div class="graph-controls">
                <button class="graph-btn" onclick="zoomGraph(1.2)">Zoom In +</button>
                <button class="graph-btn" onclick="zoomGraph(0.8)">Zoom Out -</button>
                <button class="graph-btn" onclick="resetGraphView()">Fit Screen</button>
            </div>
            <div class="graph-legend">
                <div class="legend-item"><div class="legend-dot" style="background: #38bdf8;"></div> Feature</div>
                <div class="legend-item"><div class="legend-dot" style="background: #c084fc;"></div> Requirement</div>
                <div class="legend-item"><div class="legend-dot" style="background: #10b981;"></div> Complete</div>
                <div class="legend-item"><div class="legend-dot" style="background: #f59e0b;"></div> In Progress</div>
            </div>
        </div>
    </div>

    <script>
        // Injected raw dataset
        const DOCS_DATA = {{ docs_json | safe }};

        let currentActiveDocId = null;
        let activeTypeFilter = 'all';
        let cyInstance = null;

        // Initialize application
        document.addEventListener('DOMContentLoaded', () => {
            calculateStats();
            renderDocList(DOCS_DATA);

            // Handle hash routing
            const hash = window.location.hash.replace('#', '');
            if (hash && DOCS_DATA.find(d => d.id === hash)) {
                selectDoc(hash);
            } else if (DOCS_DATA.length > 0) {
                selectDoc(DOCS_DATA[0].id);
            }

            window.addEventListener('hashchange', () => {
                const newHash = window.location.hash.replace('#', '');
                if (newHash && newHash !== currentActiveDocId) {
                    selectDoc(newHash, false);
                }
            });
        });

        function calculateStats() {
            document.getElementById('stat-total').innerText = DOCS_DATA.length;
            document.getElementById('stat-features').innerText = DOCS_DATA.filter(d => d.type === 'feature').length;
            document.getElementById('stat-reqs').innerText = DOCS_DATA.filter(d => d.type === 'requirement').length;
            document.getElementById('stat-complete').innerText = DOCS_DATA.filter(d => d.status.toLowerCase() === 'complete').length;
        }

        function filterType(type, element) {
            activeTypeFilter = type;
            document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
            element.classList.add('active');
            applyFilters();
        }

        function applyFilters() {
            const query = document.getElementById('search-input').value.toLowerCase();
            const filtered = DOCS_DATA.filter(doc => {
                const matchesType = activeTypeFilter === 'all' || doc.type === activeTypeFilter;
                const matchesSearch = doc.title.toLowerCase().includes(query) || 
                                      doc.id.toLowerCase().includes(query) || 
                                      doc.raw_markdown.toLowerCase().includes(query);
                return matchesType && matchesSearch;
            });
            renderDocList(filtered);
        }

        function renderDocList(items) {
            const container = document.getElementById('doc-list-container');
            container.innerHTML = '';

            items.forEach(doc => {
                const el = document.createElement('div');
                el.className = `doc-item ${doc.id === currentActiveDocId ? 'active' : ''}`;
                el.onclick = () => selectDoc(doc.id);

                const statusClass = `status-${doc.status.toLowerCase().replace(/\\s+/g, '')}`;
                const tagClass = `tag-${doc.type}`;

                el.innerHTML = `
                    <div class="doc-item-header">
                        <span class="tag ${tagClass}">${doc.type}</span>
                        <span class="status-badge ${statusClass}">${doc.status}</span>
                    </div>
                    <div class="doc-title">${escapeHtml(doc.title)}</div>
                `;
                container.appendChild(el);
            });
        }

        function selectDoc(docId, updateHash = true) {
            const doc = DOCS_DATA.find(d => d.id === docId);
            if (!doc) return;

            currentActiveDocId = docId;
            if (updateHash) {
                window.location.hash = docId;
            }

            // Update sidebar active highlights
            document.querySelectorAll('.doc-item').forEach(el => {
                if (el.onclick.toString().includes(`'${docId}'`)) {
                    el.classList.add('active');
                    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                } else {
                    el.classList.remove('active');
                }
            });

            // Populate header
            const tagClass = `tag-${doc.type}`;
            document.getElementById('header-tags').innerHTML = `<span class="tag ${tagClass}">${doc.type}</span><span class="target-chip">${doc.id}</span>`;
            document.getElementById('header-title').innerText = doc.title;

            const statusClass = `status-${doc.status.toLowerCase().replace(/\\s+/g, '')}`;
            document.getElementById('header-status').innerHTML = `<span class="status-badge ${statusClass}">${doc.status}</span>`;

            // Render targets
            const targetContainer = document.getElementById('header-targets');
            targetContainer.innerHTML = (doc.target || []).map(t => `<span class="target-chip">${escapeHtml(t)}</span>`).join('');

            // Render Prerequisites (Depends On)
            const prereqContainer = document.getElementById('prereq-list');
            if (doc.prerequisites.length > 0) {
                prereqContainer.innerHTML = doc.prerequisites.map(p => `
                    <div class="dep-link-item" onclick="selectDoc('${p.id}')">
                        <span class="dep-link-title">${escapeHtml(p.title)}</span>
                        <span class="status-badge status-${p.status.toLowerCase().replace(/\\s+/g, '')}">${p.status}</span>
                    </div>
                `).join('');
            } else {
                prereqContainer.innerHTML = `<span class="empty-deps">No prerequisites</span>`;
            }

            // Render Dependents (Required By)
            const dependentContainer = document.getElementById('dependent-list');
            if (doc.dependents.length > 0) {
                dependentContainer.innerHTML = doc.dependents.map(d => `
                    <div class="dep-link-item" onclick="selectDoc('${d.id}')">
                        <span class="dep-link-title">${escapeHtml(d.title)}</span>
                        <span class="status-badge status-${d.status.toLowerCase().replace(/\\s+/g, '')}">${d.status}</span>
                    </div>
                `).join('');
            } else {
                dependentContainer.innerHTML = `<span class="empty-deps">No incoming dependencies</span>`;
            }

            // Render HTML Body
            document.getElementById('markdown-content').innerHTML = doc.html;

            // Scroll main workspace to top
            document.getElementById('main-workspace').scrollTop = 0;
        }

        function switchView(view) {
            const docBtn = document.getElementById('btn-view-doc');
            const graphBtn = document.getElementById('btn-view-graph');
            const docContainer = document.getElementById('doc-view-container');
            const graphContainer = document.getElementById('graph-container');

            if (view === 'graph') {
                docBtn.classList.remove('active');
                graphBtn.classList.add('active');
                docContainer.style.display = 'none';
                graphContainer.style.display = 'block';
                initGraphView();
            } else {
                graphBtn.classList.remove('active');
                docBtn.classList.add('active');
                graphContainer.style.display = 'none';
                docContainer.style.display = 'block';
            }
        }

        function zoomGraph(factor) {
            if (cyInstance) {
                cyInstance.zoom({
                    level: cyInstance.zoom() * factor,
                    renderedPosition: { x: cyInstance.width() / 2, y: cyInstance.height() / 2 }
                });
            }
        }

        function resetGraphView() {
            if (cyInstance) {
                cyInstance.fit(undefined, 80);
            }
        }

        function initGraphView() {
            if (cyInstance) {
                cyInstance.resize();
                cyInstance.fit(undefined, 80);
                return;
            }

            const elements = [];
            
            // Build Nodes
            DOCS_DATA.forEach(doc => {
                let color = '#38bdf8';
                if (doc.type === 'requirement') color = '#c084fc';
                if (doc.status.toLowerCase() === 'complete') color = '#10b981';

                elements.push({
                    data: {
                        id: doc.id,
                        label: doc.title,
                        type: doc.type,
                        status: doc.status,
                        color: color
                    }
                });
            });

            // Build Edges
            DOCS_DATA.forEach(doc => {
                doc.prerequisites.forEach(p => {
                    elements.push({
                        data: {
                            id: `${doc.id}->${p.id}`,
                            source: doc.id,
                            target: p.id
                        }
                    });
                });
            });

            cyInstance = cytoscape({
                container: document.getElementById('graph-container'),
                elements: elements,
                style: [
                    {
                        selector: 'node',
                        style: {
                            'background-color': 'data(color)',
                            'label': 'data(label)',
                            'color': '#f8fafc',
                            'font-size': '11px',
                            'font-weight': '500',
                            'font-family': 'Inter, sans-serif',
                            'text-wrap': 'wrap',
                            'text-max-width': '130px',
                            'text-valign': 'bottom',
                            'text-margin-y': 6,
                            'text-background-opacity': 0.85,
                            'text-background-color': '#090d16',
                            'text-background-padding': '4px',
                            'text-background-shape': 'roundrectangle',
                            'text-border-opacity': 0.4,
                            'text-border-width': 1,
                            'text-border-color': 'rgba(255, 255, 255, 0.15)',
                            'width': 28,
                            'height': 28,
                            'border-width': 3,
                            'border-color': '#070a12'
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 2,
                            'line-color': 'rgba(255, 255, 255, 0.2)',
                            'target-arrow-color': 'rgba(56, 189, 248, 0.6)',
                            'target-arrow-shape': 'triangle',
                            'arrow-scale': 1.1,
                            'curve-style': 'bezier'
                        }
                    },
                    {
                        selector: 'node:selected',
                        style: {
                            'border-width': 4,
                            'border-color': '#38bdf8',
                            'width': 34,
                            'height': 34,
                            'text-background-opacity': 1,
                            'text-background-color': '#1e293b'
                        }
                    }
                ],
                layout: {
                    name: 'cose',
                    animate: true,
                    animationDuration: 800,
                    fit: true,
                    padding: 80,
                    nodeDimensionsIncludeLabels: true,
                    componentSpacing: 120,
                    nodeRepulsion: function(node) { return 4500000; },
                    nodeOverlap: 40,
                    idealEdgeLength: function(edge) { return 150; },
                    edgeElasticity: function(edge) { return 45; },
                    nestingFactor: 1.2,
                    gravity: 0.85,
                    numIter: 1000,
                    initialTemp: 1000,
                    coolingFactor: 0.99,
                    minTemp: 1.0
                }
            });

            cyInstance.on('tap', 'node', function(evt) {
                const nodeId = evt.target.id();
                switchView('doc');
                selectDoc(nodeId);
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.innerText = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>
"""


def main():
    print("Parsing documentation files...")
    docs = build_doc_index()
    print(f"Found {len(docs)} documents.")

    print("Resolving bidirectional dependencies...")
    docs = resolve_bidirectional_dependencies(docs)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    print("Generating HTML report template...")
    docs_json = json.dumps(docs, indent=2)
    template = Template(HTML_TEMPLATE)
    rendered_html = template.render(docs_json=docs_json)

    OUTPUT_FILE.write_text(rendered_html, encoding="utf-8")
    print(f"Successfully generated report at: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
