'use client';

export function KycPencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M12.8 3.9a1.2 1.2 0 0 1 1.7 0l1.6 1.6a1.2 1.2 0 0 1 0 1.7l-7.4 7.4a1.2 1.2 0 0 1-.5.3l-3.1 1a.6.6 0 0 1-.8-.8l1-3.1c.06-.2.16-.38.3-.52l7.4-7.4Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M11.7 5 15 8.3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function KycPlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M10 4.8v10.4M4.8 10h10.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Iconos compactos para la barra de acciones del detalle KYC (toolbar). */
export function KycToolbarPdfIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M11.2 3.5H6.7c-.5 0-.9.4-.9.9v11.2c0 .5.4.9.9.9h6.6c.5 0 .9-.4.9-.9V6.4l-2.9-2.9Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M11 3.5v2.7h2.7" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M7.4 12.2h5.2M7.4 9.4h5.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Recarga / actualizar: arco casi completo + flecha (lectura clara a tamaño pequeño). */
export function KycToolbarRefreshIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 3v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KycToolbarInterviewIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M5.2 4.8h7.1c.6 0 1.1.5 1.1 1.1v4.4c0 .6-.5 1.1-1.1 1.1H8.4l-2.4 1.8V11.4H5.2c-.6 0-1.1-.5-1.1-1.1V5.9c0-.6.5-1.1 1.1-1.1Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M8.8 13.6h4.4l2 1.5v-1.5h1.1c.6 0 1.1-.5 1.1-1.1v-3.3c0-.6-.5-1.1-1.1-1.1h-1.3"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KycToolbarTrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M7 6.5V5.2c0-.6.5-1.1 1.1-1.1h3.8c.6 0 1.1.5 1.1 1.1v1.3"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path d="M5.2 6.5h9.6v9.4a1.1 1.1 0 0 1-1.1 1.1H6.3a1.1 1.1 0 0 1-1.1-1.1V6.5Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M8.2 9.4v4.4M11.8 9.4v4.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Menú «más» (tres puntos) en cabecera detalle KYC móvil. */
export function KycToolbarMoreIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <circle cx="10" cy="4.5" r="1.35" fill="currentColor" />
      <circle cx="10" cy="10" r="1.35" fill="currentColor" />
      <circle cx="10" cy="15.5" r="1.35" fill="currentColor" />
    </svg>
  );
}

/** Estrella cuenta estratégica: rellena = activa, solo trazo = no marcada. */
export function KycStrategicStarIcon({ filled, size = 18 }: { filled: boolean; size?: number }) {
  const d = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
  if (filled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        focusable="false"
      >
        <path d={d} fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Barra de comando KYC (tamaño pequeño, currentColor). */
export function KycIconSearchSm({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <circle cx="8.25" cy="8.25" r="4.75" stroke="currentColor" strokeWidth="1.35" />
      <path d="M11.6 11.6 16.5 16.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function KycIconListSm({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path d="M4 5.5h12M4 10h12M4 14.5h9" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function KycIconChatSm({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M5.2 4.8h9.6c.6 0 1.1.5 1.1 1.1v5.8c0 .6-.5 1.1-1.1 1.1h-5.4l-3.8 2.8v-2.8h-1.6c-.6 0-1.1-.5-1.1-1.1V5.9c0-.6.5-1.1 1.1-1.1Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

