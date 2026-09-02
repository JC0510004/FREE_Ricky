export default function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <div className="auth-general-error">
      <span className="material-symbols-outlined">error</span>
      <span>{message}</span>
    </div>
  );
}
