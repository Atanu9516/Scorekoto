export default function BrandLogo({ showWordmark = true, className = "" }) {
  return (
    <span className={`brand-logo${className ? ` ${className}` : ""}`} aria-label="Scoreকত?">
      <span className="brand-logo-mark" aria-hidden="true">
        <svg className="brand-logo-symbol" viewBox="0 0 48 64" focusable="false">
          <path
            className="brand-logo-piece brand-logo-piece-secondary"
            d="M9 13 27 23.4c-4-2.2-7 .2-7 4.5v9L8 30C3.8 27.5 2.4 22 5 17.8A12 12 0 0 1 9 13Z"
          />
          <path
            className="brand-logo-piece brand-logo-piece-primary"
            d="m9 13 11.2-6.6a7.5 7.5 0 0 1 7.6 0L42 14.8a8 8 0 0 1 4 6.9V31Z"
          />
          <path
            className="brand-logo-piece brand-logo-piece-primary"
            d="m4 32 17 9.8c4.6 2.7 7 .8 7-3.8v-7l16 9.2v10.1a8 8 0 0 1-4 6.9l-12.2 7.1a7.5 7.5 0 0 1-7.6 0L8 57.2a8 8 0 0 1-4-6.9Z"
          />
          <path
            className="brand-logo-piece brand-logo-piece-secondary"
            d="m28 31 12 7a10.7 10.7 0 0 1 4 14.7c-2.7 4.6-8.7 6.1-13.3 3.4L21 50.5c4.5 2.6 7 .5 7-4Z"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className="brand-logo-wordmark">
          Score<span lang="bn">কত?</span>
        </span>
      )}
    </span>
  );
}
