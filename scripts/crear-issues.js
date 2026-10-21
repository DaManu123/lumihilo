#!/usr/bin/env node
/**
 * Convierte docs/02-roadmap-por-fases.md en milestones, labels e issues de GitHub.
 * No necesita dependencias externas: usa la API REST de GitHub con un token personal.
 *
 *   - Cada "## Fase N · ..." -> un milestone
 *   - Cada checkbox "- [ ] ..." dentro de la fase -> un issue con su milestone y labels
 *
 * Uso:
 *   node scripts/crear-issues.js            # vista previa, no crea nada
 *   node scripts/crear-issues.js --apply    # crea de verdad en GitHub
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROADMAP_PATH = path.resolve(__dirname, '..', 'docs', '02-roadmap-por-fases.md');

const PHASE_RE = /^##\s+Fase\s+(\d+)\s+·\s+(.*?)(?:\s+\(([^)]*)\))?\s*$/;
const CHECK_RE = /^-\s+\[[ xX]\]\s+(.*\S)\s*$/;
const FIELD_RE = /^\*\*(Objetivo|Entregable|Criterio de salida):\*\*\s*(.*)$/;

const KEYWORD_LABELS = {
  'anuncios': /admob|adsense|anuncio|rewarded|recompensad|intersticial|banner|ump|consentimiento/i,
  'play-store': /play console|play store|aab|testers?|pruebas cerradas|ficha|seguridad de datos/i,
  'generador': /generador|solver|semilla|rng|procedural|dificultad/i,
  'accesibilidad': /accesibilidad|contraste|daltónic|persona mayor/i,
  'cuentas-y-legal': /cuenta|pol[ií]tica de privacidad|licencia/i,
};

const LABEL_COLORS = {
  'anuncios': 'fbca04',
  'play-store': '0e8a16',
  'generador': '1d76db',
  'accesibilidad': '5319e7',
  'cuentas-y-legal': 'b60205',
};

const PHASE_COLOR = 'ededed';

function clean(text) {
  return text.replace(/\*\*|`/g, '').trim();
}

function parseRoadmap() {
  const content = fs.readFileSync(ROADMAP_PATH, 'utf-8');
  const lines = content.split(/\r?\n/);
  const phases = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('## Riesgos')) break;

    const m = PHASE_RE.exec(line);
    if (m) {
      current = {
        num: parseInt(m[1], 10),
        name: m[2].trim(),
        duration: (m[3] || '').trim(),
        fields: {},
        tasks: [],
      };
      phases.push(current);
      continue;
    }

    if (!current) continue;

    const f = FIELD_RE.exec(line);
    if (f) {
      current.fields[f[1]] = clean(f[2]);
      continue;
    }

    const c = CHECK_RE.exec(line);
    if (c) {
      current.tasks.push(c[1].trim());
    }
  }

  return phases;
}

function milestoneTitle(p) {
  return `Fase ${p.num} · ${p.name}`;
}

function milestoneDescription(p) {
  const parts = [];
  for (const k of ['Objetivo', 'Entregable', 'Criterio de salida']) {
    if (p.fields[k]) parts.push(`${k}: ${p.fields[k]}`);
  }
  if (p.duration) parts.push(`Duración estimada: ${p.duration}`);
  return parts.join('\n').slice(0, 1000);
}

function labelsFor(p, task) {
  const labels = [`fase-${p.num}`];
  for (const [name, rx] of Object.entries(KEYWORD_LABELS)) {
    if (rx.test(task)) labels.push(name);
  }
  return labels;
}

function issueBody(p, task) {
  const lines = [
    `Parte de **${milestoneTitle(p)}**.`,
    '',
    `**Tarea:** ${clean(task)}`
  ];
  if (p.fields['Criterio de salida']) {
    lines.push('', `**Criterio de salida de la fase:** ${p.fields['Criterio de salida']}`);
  }
  lines.push('', 'Detalle completo en `docs/02-roadmap-por-fases.md`.');
  return lines.join('\n');
}

function detectRepo() {
  try {
    const url = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(url);
    return m ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestGithub(token, method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'puzzle-adaptativo-crear-issues-node',
        'Content-Type': 'application/json',
      },
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          if (body) parsed = JSON.parse(body);
        } catch {
          parsed = { message: body };
        }
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function paginate(token, endpoint) {
  const items = [];
  let page = 1;
  const sep = endpoint.includes('?') ? '&' : '?';
  while (true) {
    const res = await requestGithub(token, 'GET', `${endpoint}${sep}per_page=100&page=${page}`);
    if (res.status !== 200) {
      throw new Error(`Error ${res.status} obteniendo ${endpoint}: ${JSON.stringify(res.data)}`);
    }
    items.push(...res.data);
    if (res.data.length < 100) break;
    page++;
  }
  return items;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const repoIdx = args.indexOf('--repo');
  const explicitRepo = repoIdx !== -1 ? args[repoIdx + 1] : null;
  const pausaIdx = args.indexOf('--pausa');
  const pausaSec = pausaIdx !== -1 ? parseFloat(args[pausaIdx + 1]) : 0.8;

  const phases = parseRoadmap();
  const total = phases.reduce((acc, p) => acc + p.tasks.length, 0);
  console.log(`Roadmap leído: ${phases.length} fases, ${total} tareas.\n`);

  if (!apply) {
    for (const p of phases) {
      console.log(`[Milestone] ${milestoneTitle(p)}`);
      for (const t of p.tasks) {
        console.log(`    [Issue] ${clean(t)}   labels=${labelsFor(p, t).join(',')}`);
      }
    }
    console.log('\nVista previa. Añade --apply para crear todo en GitHub.');
    return;
  }

  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    console.error('Falta la variable de entorno GITHUB_TOKEN o GITHUB_PERSONAL_ACCESS_TOKEN.');
    process.exit(1);
  }

  const slug = explicitRepo || detectRepo();
  if (!slug) {
    console.error('No pude detectar el repo desde "origin". Usa --repo dueño/nombre.');
    process.exit(1);
  }

  console.log(`Repo destino: ${slug}\n`);

  // 1. Labels
  console.log('--- Configurando Labels ---');
  const allLabels = phases.map((p) => ({
    name: `fase-${p.num}`,
    color: PHASE_COLOR,
    description: `Tareas de la Fase ${p.num}`,
  }));
  for (const [name, color] of Object.entries(LABEL_COLORS)) {
    allLabels.push({ name, color, description: '' });
  }

  for (const lbl of allLabels) {
    const res = await requestGithub(token, 'POST', `/repos/${slug}/labels`, lbl);
    if (res.status === 201) {
      console.log(`+ Label creado: ${lbl.name}`);
    } else if (res.status === 422) {
      // Ya existe
    } else {
      console.warn(`! Advertencia al crear label ${lbl.name}: ${res.status} ${JSON.stringify(res.data)}`);
    }
  }

  // 2. Milestones existentes
  console.log('\n--- Consultando Milestones e Issues existentes ---');
  const existingMilestones = await paginate(token, `/repos/${slug}/milestones?state=all`);
  const msNumbers = {};
  for (const m of existingMilestones) {
    msNumbers[m.title] = m.number;
  }

  const existingIssues = await paginate(token, `/repos/${slug}/issues?state=all`);
  const issueTitles = new Set(existingIssues.filter((i) => !i.pull_request).map((i) => i.title));

  let createdMs = 0;
  let createdIssues = 0;
  let skipped = 0;

  console.log('\n--- Creando Milestones e Issues ---');
  for (const p of phases) {
    const title = milestoneTitle(p);
    if (msNumbers[title]) {
      console.log(`= Milestone ya existe: ${title}`);
    } else {
      const res = await requestGithub(token, 'POST', `/repos/${slug}/milestones`, {
        title,
        description: milestoneDescription(p),
      });
      if (res.status !== 201) {
        throw new Error(`Error creando milestone ${title}: ${res.status} ${JSON.stringify(res.data)}`);
      }
      msNumbers[title] = res.data.number;
      createdMs++;
      console.log(`+ Milestone creado:   ${title}`);
      await sleep(pausaSec * 1000);
    }

    for (const t of p.tasks) {
      const it = clean(t);
      if (issueTitles.has(it)) {
        skipped++;
        console.log(`    = ya existe: ${it}`);
        continue;
      }

      const res = await requestGithub(token, 'POST', `/repos/${slug}/issues`, {
        title: it,
        body: issueBody(p, t),
        milestone: msNumbers[title],
        labels: labelsFor(p, t),
      });

      if (res.status !== 201) {
        throw new Error(`Error creando issue "${it}": ${res.status} ${JSON.stringify(res.data)}`);
      }

      issueTitles.add(it);
      createdIssues++;
      console.log(`    + Issue: ${it}`);
      await sleep(pausaSec * 1000);
    }
  }

  console.log(`\n🎉 Finalizado con éxito: ${createdMs} milestones y ${createdIssues} issues creados, ${skipped} omitidos.`);
}

main().catch((err) => {
  console.error('\nError fatal:', err);
  process.exit(1);
});
