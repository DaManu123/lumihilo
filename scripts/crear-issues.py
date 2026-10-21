#!/usr/bin/env python3
"""
Convierte docs/02-roadmap-por-fases.md en milestones, labels e issues de GitHub.
No necesita la CLI `gh`: usa la API de GitHub con un token personal.

  - Cada "## Fase N · ..." -> un milestone
  - Cada checkbox "- [ ] ..." dentro de la fase -> un issue con su milestone y labels

Uso (desde la raíz del repo):

  python scripts/crear-issues.py            # vista previa, no crea nada ni pide token
  python scripts/crear-issues.py --apply    # crea de verdad

Para --apply necesitas un token en la variable de entorno GITHUB_TOKEN
(fine-grained, solo este repo, permiso "Issues: Read and write").
Nunca pegues el token dentro de este archivo ni lo subas al repo.

El repo (dueño/nombre) se detecta del remoto `origin`; si falla, usa --repo dueño/nombre.
Es idempotente: si un milestone o un issue (mismo título) ya existe, lo salta.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
ROADMAP = Path(__file__).resolve().parent.parent / "docs" / "02-roadmap-por-fases.md"

PHASE_RE = re.compile(r"^##\s+Fase\s+(\d+)\s+·\s+(.*?)(?:\s+\(([^)]*)\))?\s*$")
CHECK_RE = re.compile(r"^-\s+\[[ xX]\]\s+(.*\S)\s*$")
FIELD_RE = re.compile(r"^\*\*(Objetivo|Entregable|Criterio de salida):\*\*\s*(.*)$")

# Etiquetas extra por palabras clave (además de fase-N)
KEYWORD_LABELS = {
    "anuncios": re.compile(r"admob|adsense|anuncio|rewarded|recompensad|intersticial|banner|ump|consentimiento", re.I),
    "play-store": re.compile(r"play console|play store|aab|testers?|pruebas cerradas|ficha|seguridad de datos", re.I),
    "generador": re.compile(r"generador|solver|semilla|rng|procedural|dificultad", re.I),
    "accesibilidad": re.compile(r"accesibilidad|contraste|daltónic|persona mayor", re.I),
    "cuentas-y-legal": re.compile(r"cuenta|pol[ií]tica de privacidad|licencia", re.I),
}
LABEL_COLORS = {
    "anuncios": "fbca04",
    "play-store": "0e8a16",
    "generador": "1d76db",
    "accesibilidad": "5319e7",
    "cuentas-y-legal": "b60205",
}
PHASE_COLOR = "ededed"


def clean(text: str) -> str:
    return re.sub(r"\*\*|`", "", text).strip()


def parse_roadmap():
    phases, current = [], None
    for raw in ROADMAP.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if line.startswith("## Riesgos"):
            break
        m = PHASE_RE.match(line)
        if m:
            current = {"num": int(m.group(1)), "name": m.group(2).strip(),
                       "duration": (m.group(3) or "").strip(), "fields": {}, "tasks": []}
            phases.append(current)
            continue
        if current is None:
            continue
        f = FIELD_RE.match(line)
        if f:
            current["fields"][f.group(1)] = clean(f.group(2))
            continue
        c = CHECK_RE.match(line)
        if c:
            current["tasks"].append(c.group(1).strip())
    return phases


def milestone_title(p):
    return f"Fase {p['num']} · {p['name']}"


def milestone_description(p):
    parts = [f"{k}: {p['fields'][k]}" for k in ("Objetivo", "Entregable", "Criterio de salida") if k in p["fields"]]
    if p["duration"]:
        parts.append(f"Duración estimada: {p['duration']}")
    return "\n".join(parts)[:1000]


def labels_for(p, task):
    labels = [f"fase-{p['num']}"]
    labels += [name for name, rx in KEYWORD_LABELS.items() if rx.search(task)]
    return labels


def issue_body(p, task):
    lines = [f"Parte de **{milestone_title(p)}**.", "", f"**Tarea:** {clean(task)}"]
    if "Criterio de salida" in p["fields"]:
        lines += ["", f"**Criterio de salida de la fase:** {p['fields']['Criterio de salida']}"]
    lines += ["", "Detalle completo en `docs/02-roadmap-por-fases.md`."]
    return "\n".join(lines)


# ---------- Cliente mínimo de la API de GitHub ----------

class GitHub:
    def __init__(self, token, slug):
        self.token, self.slug = token, slug

    def request(self, method, path, data=None):
        url = f"{API}{path}"
        body = json.dumps(data).encode("utf-8") if data is not None else None
        for attempt in range(5):
            req = urllib.request.Request(url, data=body, method=method, headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "puzzle-adaptativo-crear-issues",
                "Content-Type": "application/json",
            })
            try:
                with urllib.request.urlopen(req) as resp:
                    raw = resp.read().decode("utf-8")
                    return resp.status, (json.loads(raw) if raw else None)
            except urllib.error.HTTPError as e:
                raw = e.read().decode("utf-8", errors="replace")
                limited = e.code == 429 or (e.code == 403 and ("rate limit" in raw.lower() or e.headers.get("Retry-After")))
                if limited and attempt < 4:
                    wait = int(e.headers.get("Retry-After") or 30)
                    print(f"  (límite de ritmo de GitHub, espero {wait}s y reintento)")
                    time.sleep(wait)
                    continue
                try:
                    return e.code, json.loads(raw)
                except ValueError:
                    return e.code, {"message": raw}
        return 0, {"message": "demasiados reintentos"}

    def must(self, method, path, data=None):
        status, payload = self.request(method, path, data)
        if status not in (200, 201):
            msg = (payload or {}).get("message", "")
            hint = ""
            if status in (401, 403):
                hint = "\nRevisa que el token sea válido, no haya expirado y tenga permiso 'Issues: Read and write' sobre este repo."
            if status == 404:
                hint = "\nRepo no encontrado o el token no tiene acceso a él (en repos privados GitHub responde 404)."
            sys.exit(f"Error {status} en {method} {path}: {msg}{hint}")
        return payload

    def paginate(self, path):
        items, page = [], 1
        sep = "&" if "?" in path else "?"
        while True:
            chunk = self.must("GET", f"{path}{sep}per_page=100&page={page}")
            items += chunk
            if len(chunk) < 100:
                return items
            page += 1


def detect_repo():
    try:
        url = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return None
    m = re.search(r"github\.com[:/]([^/\s]+)/([^/\s]+?)(?:\.git)?/?$", url)
    return f"{m.group(1)}/{m.group(2)}" if m else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="crear de verdad (sin esto solo muestra la vista previa)")
    ap.add_argument("--repo", help="dueño/nombre, por ejemplo manuel/puzzle-adaptativo (si no, se detecta de origin)")
    ap.add_argument("--pausa", type=float, default=1.0, help="segundos entre creaciones (evita límites de GitHub)")
    args = ap.parse_args()

    phases = parse_roadmap()
    total = sum(len(p["tasks"]) for p in phases)
    print(f"Roadmap leído: {len(phases)} fases, {total} tareas.\n")

    if not args.apply:
        for p in phases:
            print(f"[Milestone] {milestone_title(p)}")
            for t in p["tasks"]:
                print(f"    [Issue] {clean(t)}   labels={','.join(labels_for(p, t))}")
        print("\nVista previa. Añade --apply para crear todo en GitHub.")
        return

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        sys.exit("Falta la variable de entorno GITHUB_TOKEN (ver las instrucciones al inicio del script).")
    slug = args.repo or detect_repo()
    if not slug:
        sys.exit("No pude detectar el repo desde 'origin'. Usa --repo dueño/nombre.")
    gh = GitHub(token, slug)
    print(f"Repo: {slug}\n")

    # Labels (422 = ya existe, se deja como está)
    all_labels = [(f"fase-{p['num']}", PHASE_COLOR, f"Tareas de la Fase {p['num']}") for p in phases]
    all_labels += [(n, c, "") for n, c in LABEL_COLORS.items()]
    for name, color, desc in all_labels:
        status, payload = gh.request("POST", f"/repos/{slug}/labels", {"name": name, "color": color, "description": desc})
        if status not in (200, 201, 422):
            sys.exit(f"Error {status} creando label {name}: {(payload or {}).get('message', '')}")

    ms_numbers = {m["title"]: m["number"] for m in gh.paginate(f"/repos/{slug}/milestones?state=all")}
    issue_titles = {i["title"] for i in gh.paginate(f"/repos/{slug}/issues?state=all") if "pull_request" not in i}

    created_ms = created_issues = skipped = 0
    for p in phases:
        title = milestone_title(p)
        if title in ms_numbers:
            print(f"= Milestone ya existe: {title}")
        else:
            m = gh.must("POST", f"/repos/{slug}/milestones", {"title": title, "description": milestone_description(p)})
            ms_numbers[title] = m["number"]
            created_ms += 1
            print(f"+ Milestone creado:   {title}")
            time.sleep(args.pausa)

        for t in p["tasks"]:
            it = clean(t)
            if it in issue_titles:
                skipped += 1
                print(f"    = ya existe: {it}")
                continue
            gh.must("POST", f"/repos/{slug}/issues", {
                "title": it, "body": issue_body(p, t),
                "milestone": ms_numbers[title], "labels": labels_for(p, t),
            })
            issue_titles.add(it)
            created_issues += 1
            print(f"    + {it}")
            time.sleep(args.pausa)

    print(f"\nListo: {created_ms} milestones y {created_issues} issues creados, {skipped} saltados.")


if __name__ == "__main__":
    main()
