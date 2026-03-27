/** Opciones de prefijo telefónico para el formulario de perfil (etiquetas en español). */

export type PhoneCountryOption = {
  iso: string;
  label: string;
  dialCode: string;
};

export const DEFAULT_PHONE_COUNTRY_ISO = 'ES';

/** Lista ordenada alfabéticamente por nombre para el desplegable. */
export const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { iso: 'DE', label: 'Alemania (+49)', dialCode: '+49' },
  { iso: 'AD', label: 'Andorra (+376)', dialCode: '+376' },
  { iso: 'AR', label: 'Argentina (+54)', dialCode: '+54' },
  { iso: 'AU', label: 'Australia (+61)', dialCode: '+61' },
  { iso: 'AT', label: 'Austria (+43)', dialCode: '+43' },
  { iso: 'BE', label: 'Bélgica (+32)', dialCode: '+32' },
  { iso: 'BO', label: 'Bolivia (+591)', dialCode: '+591' },
  { iso: 'BR', label: 'Brasil (+55)', dialCode: '+55' },
  { iso: 'BG', label: 'Bulgaria (+359)', dialCode: '+359' },
  { iso: 'CA', label: 'Canadá (+1)', dialCode: '+1' },
  { iso: 'CL', label: 'Chile (+56)', dialCode: '+56' },
  { iso: 'CN', label: 'China (+86)', dialCode: '+86' },
  { iso: 'CO', label: 'Colombia (+57)', dialCode: '+57' },
  { iso: 'KR', label: 'Corea del Sur (+82)', dialCode: '+82' },
  { iso: 'CR', label: 'Costa Rica (+506)', dialCode: '+506' },
  { iso: 'HR', label: 'Croacia (+385)', dialCode: '+385' },
  { iso: 'CU', label: 'Cuba (+53)', dialCode: '+53' },
  { iso: 'DK', label: 'Dinamarca (+45)', dialCode: '+45' },
  { iso: 'EC', label: 'Ecuador (+593)', dialCode: '+593' },
  { iso: 'EG', label: 'Egipto (+20)', dialCode: '+20' },
  { iso: 'SV', label: 'El Salvador (+503)', dialCode: '+503' },
  { iso: 'AE', label: 'Emiratos Árabes (+971)', dialCode: '+971' },
  { iso: 'SK', label: 'Eslovaquia (+421)', dialCode: '+421' },
  { iso: 'SI', label: 'Eslovenia (+386)', dialCode: '+386' },
  { iso: 'ES', label: 'España (+34)', dialCode: '+34' },
  { iso: 'US', label: 'Estados Unidos (+1)', dialCode: '+1' },
  { iso: 'EE', label: 'Estonia (+372)', dialCode: '+372' },
  { iso: 'PH', label: 'Filipinas (+63)', dialCode: '+63' },
  { iso: 'FI', label: 'Finlandia (+358)', dialCode: '+358' },
  { iso: 'FR', label: 'Francia (+33)', dialCode: '+33' },
  { iso: 'GR', label: 'Grecia (+30)', dialCode: '+30' },
  { iso: 'GT', label: 'Guatemala (+502)', dialCode: '+502' },
  { iso: 'HN', label: 'Honduras (+504)', dialCode: '+504' },
  { iso: 'HK', label: 'Hong Kong (+852)', dialCode: '+852' },
  { iso: 'HU', label: 'Hungría (+36)', dialCode: '+36' },
  { iso: 'IN', label: 'India (+91)', dialCode: '+91' },
  { iso: 'ID', label: 'Indonesia (+62)', dialCode: '+62' },
  { iso: 'IE', label: 'Irlanda (+353)', dialCode: '+353' },
  { iso: 'IL', label: 'Israel (+972)', dialCode: '+972' },
  { iso: 'IT', label: 'Italia (+39)', dialCode: '+39' },
  { iso: 'JP', label: 'Japón (+81)', dialCode: '+81' },
  { iso: 'LV', label: 'Letonia (+371)', dialCode: '+371' },
  { iso: 'LT', label: 'Lituania (+370)', dialCode: '+370' },
  { iso: 'LU', label: 'Luxemburgo (+352)', dialCode: '+352' },
  { iso: 'MY', label: 'Malasia (+60)', dialCode: '+60' },
  { iso: 'MT', label: 'Malta (+356)', dialCode: '+356' },
  { iso: 'MA', label: 'Marruecos (+212)', dialCode: '+212' },
  { iso: 'MX', label: 'México (+52)', dialCode: '+52' },
  { iso: 'NI', label: 'Nicaragua (+505)', dialCode: '+505' },
  { iso: 'NO', label: 'Noruega (+47)', dialCode: '+47' },
  { iso: 'NZ', label: 'Nueva Zelanda (+64)', dialCode: '+64' },
  { iso: 'NL', label: 'Países Bajos (+31)', dialCode: '+31' },
  { iso: 'PA', label: 'Panamá (+507)', dialCode: '+507' },
  { iso: 'PY', label: 'Paraguay (+595)', dialCode: '+595' },
  { iso: 'PE', label: 'Perú (+51)', dialCode: '+51' },
  { iso: 'PL', label: 'Polonia (+48)', dialCode: '+48' },
  { iso: 'PT', label: 'Portugal (+351)', dialCode: '+351' },
  { iso: 'GB', label: 'Reino Unido (+44)', dialCode: '+44' },
  { iso: 'CZ', label: 'Rep. Checa (+420)', dialCode: '+420' },
  { iso: 'RO', label: 'Rumanía (+40)', dialCode: '+40' },
  { iso: 'RU', label: 'Rusia (+7)', dialCode: '+7' },
  { iso: 'SN', label: 'Senegal (+221)', dialCode: '+221' },
  { iso: 'SG', label: 'Singapur (+65)', dialCode: '+65' },
  { iso: 'ZA', label: 'Sudáfrica (+27)', dialCode: '+27' },
  { iso: 'SE', label: 'Suecia (+46)', dialCode: '+46' },
  { iso: 'CH', label: 'Suiza (+41)', dialCode: '+41' },
  { iso: 'TH', label: 'Tailandia (+66)', dialCode: '+66' },
  { iso: 'TW', label: 'Taiwán (+886)', dialCode: '+886' },
  { iso: 'TR', label: 'Turquía (+90)', dialCode: '+90' },
  { iso: 'UA', label: 'Ucrania (+380)', dialCode: '+380' },
  { iso: 'UY', label: 'Uruguay (+598)', dialCode: '+598' },
  { iso: 'VE', label: 'Venezuela (+58)', dialCode: '+58' },
  { iso: 'VN', label: 'Vietnam (+84)', dialCode: '+84' },
];

const byIso = new Map(PHONE_COUNTRY_OPTIONS.map((c) => [c.iso, c] as const));

export function getPhoneCountryByIso(iso: string): PhoneCountryOption | undefined {
  return byIso.get(iso);
}

/** Nombre del país sin el sufijo « (+XX) » del label. */
export function countryNameFromOption(option: PhoneCountryOption): string {
  const i = option.label.indexOf(' (+');
  return i >= 0 ? option.label.slice(0, i).trim() : option.label.trim();
}

/** Coincide el prefijo más largo posible (p. ej. +351 antes que +3). */
export function parseStoredPhone(phone: string | null | undefined): { iso: string; national: string } {
  const defaultIso = DEFAULT_PHONE_COUNTRY_ISO;
  const t = (phone ?? '').trim();
  if (!t) return { iso: defaultIso, national: '' };

  if (t.startsWith('+')) {
    const sorted = [...PHONE_COUNTRY_OPTIONS].sort(
      (a, b) => b.dialCode.length - a.dialCode.length || a.iso.localeCompare(b.iso),
    );
    for (const c of sorted) {
      if (t.startsWith(c.dialCode)) {
        return { iso: c.iso, national: t.slice(c.dialCode.length).trim() };
      }
    }
    return { iso: defaultIso, national: t.replace(/^\++/, '').trim() };
  }

  return { iso: defaultIso, national: t.trim() };
}

/** Normaliza a almacenamiento (E.164-like): + y solo dígitos en la parte nacional. Vacío si no hay número. */
export function buildStoredPhone(iso: string, national: string): string {
  const country = getPhoneCountryByIso(iso) ?? getPhoneCountryByIso(DEFAULT_PHONE_COUNTRY_ISO)!;
  const digits = national.replace(/\D/g, '');
  if (!digits) return '';
  return `${country.dialCode}${digits}`;
}
