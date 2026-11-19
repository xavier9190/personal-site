export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: '#121212',
        color: '#f1f3f5',
        fontFamily: 'var(--font-excalifont, "Excalifont", ui-sans-serif, system-ui, sans-serif)',
        textTransform: 'uppercase',
        boxSizing: 'border-box',
      }}
    >
      <main
        style={{
          width: '100%',
          maxWidth: '448px',
          backgroundColor: '#121212',
          color: '#f1f3f5',
          border: '2px solid #f1f3f5',
          borderRadius: '8px',
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f1f3f5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M12 20h.01" />
            <path d="M8.5 16.429a5 5 0 0 1 7 0" />
            <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
            <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
            <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
            <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
            <path d="m2 2 20 20" />
          </svg>
          <h1
            style={{
              margin: 0,
              fontSize: '20px',
              lineHeight: '28px',
              letterSpacing: '0.05em',
              color: '#f1f3f5',
              fontWeight: 700,
            }}
          >
            MODO OFFLINE
          </h1>
        </div>

        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: '12px',
            lineHeight: 1.625,
            color: '#868e96',
          }}
        >
          VOCÊ ESTÁ SEM CONEXÃO COM A INTERNET NO MOMENTO. POR SEGURANÇA, SEUS
          DADOS PRIVADOS NÃO FICAM ARMAZENADOS NO CACHE LOCAL.
        </p>

        <div
          style={{
            borderTop: '1px solid rgba(241, 243, 245, 0.3)',
            paddingTop: '16px',
          }}
        >
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px 16px',
              backgroundColor: '#121212',
              color: '#f1f3f5',
              border: '2px solid #f1f3f5',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              boxSizing: 'border-box',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f1f3f5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            <span>RECONECTAR</span>
          </a>
        </div>
      </main>
    </div>
  );
}
