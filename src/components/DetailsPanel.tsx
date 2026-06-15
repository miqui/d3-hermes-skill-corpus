import type { SkillRecord } from '../types';

type DetailsPanelProps = {
  selectedSkill: SkillRecord | null;
  generatedAt: string | null;
};

export function DetailsPanel({ selectedSkill, generatedAt }: DetailsPanelProps) {
  return (
    <aside className="panel details-panel">
      <div className="panel-header">
        <h2>Details</h2>
        <p>{generatedAt ? `Generated ${new Date(generatedAt).toLocaleString()}` : 'No corpus generated yet'}</p>
      </div>

      {selectedSkill ? (
        <div className="details-content">
          <div>
            <p className="eyebrow">{selectedSkill.categoryPath.join(' / ') || 'top level'}</p>
            <h3>{selectedSkill.name}</h3>
            <p className="description">{selectedSkill.description || 'No description provided.'}</p>
          </div>

          <dl className="meta-grid">
            <div>
              <dt>Skill ID</dt>
              <dd>{selectedSkill.id}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{selectedSkill.version || '—'}</dd>
            </div>
            <div>
              <dt>Author</dt>
              <dd>{selectedSkill.author || '—'}</dd>
            </div>
            <div>
              <dt>Source File</dt>
              <dd>{selectedSkill.skillFile}</dd>
            </div>
          </dl>

          <div>
            <h4>Summary</h4>
            <p>{selectedSkill.summary || 'No summary available.'}</p>
          </div>

          <div>
            <h4>Tags</h4>
            <div className="pill-row">
              {selectedSkill.tags.length > 0 ? (
                selectedSkill.tags.map((tag) => (
                  <span className="pill" key={tag}>
                    {tag}
                  </span>
                ))
              ) : (
                <span className="muted">No tags</span>
              )}
            </div>
          </div>

          <div>
            <h4>Related Skills</h4>
            <div className="pill-row">
              {selectedSkill.relatedSkills.length > 0 ? (
                selectedSkill.relatedSkills.map((relatedSkill) => (
                  <span className="pill outline" key={relatedSkill}>
                    {relatedSkill}
                  </span>
                ))
              ) : (
                <span className="muted">No related skills</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>Select a skill node in the hierarchy to inspect it.</p>
        </div>
      )}
    </aside>
  );
}
