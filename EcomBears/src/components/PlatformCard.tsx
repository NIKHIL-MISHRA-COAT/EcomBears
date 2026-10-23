import { Link } from 'react-router-dom';

type Props = { name: string; letter: string; to: string; text: string; tags: string[] };

export default function PlatformCard({ name, letter, to, text, tags }: Props) {
  return (
    <Link className="card platform-card" to={to}>
      <div className="platform-icon" aria-hidden>{letter}</div>
      <h3>{name}</h3>
      <p>{text}</p>
      <div className="tags">
        {tags.map(t => <span key={t} className="tag">{t}</span>)}
      </div>
    </Link>
  );
}