export default function EQMobileShell({ children, className = '', ...props }) {
  return (
    <main className={`eq-mobile-shell ${className}`.trim()} {...props}>
      {children}
    </main>
  );
}
