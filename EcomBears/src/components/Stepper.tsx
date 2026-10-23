type Props = { step: 1 | 2 };

const STEPS = ['Add your PDFs', 'Check labels & download'];

export default function Stepper({ step }: Props) {
  return (
    <ol className="stepper" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'active' : 'todo';
        return (
          <li key={label} className={`step ${state}`} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="step-num">{state === 'done' ? '✓' : n}</span>
            <span className="step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
