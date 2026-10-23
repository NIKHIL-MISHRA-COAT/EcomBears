type Props = { icon?: string; title: string; text: string; soon?: boolean };

export default function FeatureCard({ icon, title, text, soon = false }: Props) {
  return (
    <div className={`card feature-card${soon ? ' soon' : ''}`}>
      {soon ? <span className="pill">Coming soon</span> : icon && <div className="feature-icon" aria-hidden>{icon}</div>}
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}