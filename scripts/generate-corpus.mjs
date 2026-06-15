import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import YAML from 'yaml';

const args = process.argv.slice(2);
const options = {
  source: '~/.hermes/skills',
  output: 'public/data/skills-corpus.json',
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--source') {
    options.source = args[index + 1];
    index += 1;
  } else if (arg === '--output') {
    options.output = args[index + 1];
    index += 1;
  }
}

function expandHome(inputPath) {
  if (!inputPath.startsWith('~/')) return inputPath;
  return path.join(os.homedir(), inputPath.slice(2));
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }
      return fullPath;
    }),
  );

  return files.flat();
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) {
    return { frontmatter: {}, body: markdown.trim() };
  }

  const closingIndex = markdown.indexOf('\n---\n', 4);
  if (closingIndex === -1) {
    return { frontmatter: {}, body: markdown.trim() };
  }

  const yamlBlock = markdown.slice(4, closingIndex);
  const body = markdown.slice(closingIndex + 5).trim();

  try {
    const frontmatter = YAML.parse(yamlBlock) ?? {};
    return { frontmatter, body };
  } catch {
    return { frontmatter: {}, body };
  }
}

function summarizeBody(body) {
  const cleaned = body
    .replace(/^#\s+/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[>*_`#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.slice(0, 220);
}

function createRootNode() {
  return {
    id: 'root',
    name: 'Hermes Skills',
    type: 'root',
    path: '.',
    children: [],
  };
}

function ensurePathNode(root, segments) {
  let current = root;
  let accumulated = '';

  for (const segment of segments) {
    accumulated = accumulated ? `${accumulated}/${segment}` : segment;
    let child = current.children.find((node) => node.name === segment && node.type === 'group');
    if (!child) {
      child = {
        id: `group:${accumulated}`,
        name: segment,
        type: 'group',
        path: accumulated,
        children: [],
      };
      current.children.push(child);
      current.children.sort((a, b) => a.name.localeCompare(b.name));
    }
    current = child;
  }

  return current;
}

function extractTags(frontmatter) {
  const tags = frontmatter?.metadata?.hermes?.tags;
  if (Array.isArray(tags)) {
    return tags.filter((tag) => typeof tag === 'string');
  }
  return [];
}

function extractRelatedSkills(frontmatter) {
  const related = frontmatter?.metadata?.hermes?.related_skills;
  if (Array.isArray(related)) {
    return related.filter((item) => typeof item === 'string');
  }
  return [];
}

function computeMaxDepth(node, depth = 0) {
  if (!node.children || node.children.length === 0) {
    return depth;
  }

  return Math.max(...node.children.map((child) => computeMaxDepth(child, depth + 1)));
}

function countNodes(node) {
  return 1 + (node.children?.reduce((sum, child) => sum + countNodes(child), 0) ?? 0);
}

async function main() {
  const sourceRoot = path.resolve(expandHome(options.source));
  const outputPath = path.resolve(options.output);

  if (!(await exists(sourceRoot))) {
    throw new Error(`Source skill directory does not exist: ${sourceRoot}`);
  }

  const files = await walk(sourceRoot);
  const skillFiles = files
    .filter((filePath) => path.basename(filePath) === 'SKILL.md')
    .sort((a, b) => a.localeCompare(b));

  const root = createRootNode();
  const skills = [];

  for (const skillFile of skillFiles) {
    const relativeFilePath = path.relative(sourceRoot, skillFile);
    const skillDir = path.dirname(relativeFilePath);
    const segments = skillDir.split(path.sep).filter(Boolean);
    const groupSegments = segments.slice(0, -1);
    const folderName = segments[segments.length - 1] ?? path.basename(skillFile, '.md');
    const markdown = await fs.readFile(skillFile, 'utf8');
    const { frontmatter, body } = parseFrontmatter(markdown);
    const nodeParent = ensurePathNode(root, groupSegments);
    const stat = await fs.stat(skillFile);

    const skill = {
      id: segments.join('/'),
      slug: folderName,
      name: typeof frontmatter.name === 'string' ? frontmatter.name : folderName,
      folderName,
      categoryPath: groupSegments,
      path: skillDir,
      skillFile: relativeFilePath,
      description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
      author: typeof frontmatter.author === 'string' ? frontmatter.author : '',
      version: typeof frontmatter.version === 'string' ? frontmatter.version : '',
      tags: extractTags(frontmatter),
      relatedSkills: extractRelatedSkills(frontmatter),
      summary: summarizeBody(body),
      modifiedAt: stat.mtime.toISOString(),
    };

    skills.push(skill);

    nodeParent.children.push({
      id: `skill:${skill.id}`,
      name: skill.name,
      type: 'skill',
      path: skill.path,
      skillId: skill.id,
      description: skill.description,
      tags: skill.tags,
      relatedSkills: skill.relatedSkills,
    });

    nodeParent.children.sort((a, b) => a.name.localeCompare(b.name));
  }

  const corpus = {
    generatedAt: new Date().toISOString(),
    sourceRoot,
    stats: {
      skillCount: skills.length,
      nodeCount: countNodes(root),
      maxDepth: computeMaxDepth(root),
    },
    skills,
    tree: root,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(corpus, null, 2)}\n`, 'utf8');

  console.log(`Generated corpus with ${skills.length} skills at ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
