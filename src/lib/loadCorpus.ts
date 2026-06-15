import type { SkillCorpus } from '../types';

export async function loadCorpus(): Promise<SkillCorpus> {
  const response = await fetch('/data/skills-corpus.json');

  if (!response.ok) {
    throw new Error(`Failed to load corpus: ${response.status}`);
  }

  return (await response.json()) as SkillCorpus;
}
