export default function EQCard({ children, glow = true, className = '', ...props }) {
  const baseClass = glow ? 'eq-glow-card' : 'eq-card';

  return (
    <section className={`${baseClass} ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}
