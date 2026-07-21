export interface CountryOption {
  name: string;
  timezones: string[];
}

const COUNTRY_LIBRARY: CountryOption[] = [
  { name: 'Afghanistan', timezones: ['Asia/Kabul'] },
  { name: 'Albania', timezones: ['Europe/Tirane'] },
  { name: 'Algeria', timezones: ['Africa/Algiers'] },
  { name: 'Andorra', timezones: ['Europe/Andorra'] },
  { name: 'Angola', timezones: ['Africa/Lagos'] },
  { name: 'Antigua and Barbuda', timezones: ['America/Antigua'] },
  { name: 'Argentina', timezones: ['America/Buenos_Aires'] },
  { name: 'Armenia', timezones: ['Asia/Yerevan'] },
  { name: 'Australia', timezones: ['Australia/Sydney', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth'] },
  { name: 'Austria', timezones: ['Europe/Vienna'] },
  { name: 'Azerbaijan', timezones: ['Asia/Baku'] },
  { name: 'Bahamas', timezones: ['America/Nassau'] },
  { name: 'Bahrain', timezones: ['Asia/Bahrain'] },
  { name: 'Bangladesh', timezones: ['Asia/Dhaka'] },
  { name: 'Barbados', timezones: ['America/Barbados'] },
  { name: 'Belarus', timezones: ['Europe/Minsk'] },
  { name: 'Belgium', timezones: ['Europe/Brussels'] },
  { name: 'Belize', timezones: ['America/Belize'] },
  { name: 'Benin', timezones: ['Africa/Porto-Novo'] },
  { name: 'Bhutan', timezones: ['Asia/Thimphu'] },
  { name: 'Bolivia', timezones: ['America/La_Paz'] },
  { name: 'Bosnia and Herzegovina', timezones: ['Europe/Sarajevo'] },
  { name: 'Botswana', timezones: ['Africa/Gaborone'] },
  { name: 'Brazil', timezones: ['America/Sao_Paulo', 'America/Belem', 'America/Fortaleza', 'America/Bahia'] },
  { name: 'Brunei', timezones: ['Asia/Brunei'] },
  { name: 'Bulgaria', timezones: ['Europe/Sofia'] },
  { name: 'Burkina Faso', timezones: ['Africa/Ouagadougou'] },
  { name: 'Burundi', timezones: ['Africa/Bujumbura'] },
  { name: 'Cabo Verde', timezones: ['Atlantic/Cape_Verde'] },
  { name: 'Cambodia', timezones: ['Asia/Phnom_Penh'] },
  { name: 'Cameroon', timezones: ['Africa/Douala'] },
  { name: 'Canada', timezones: ['America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax'] },
  { name: 'Central African Republic', timezones: ['Africa/Bangui'] },
  { name: 'Chad', timezones: ['Africa/Ndjamena'] },
  { name: 'Chile', timezones: ['America/Santiago'] },
  { name: 'China', timezones: ['Asia/Shanghai'] },
  { name: 'Colombia', timezones: ['America/Bogota'] },
  { name: 'Comoros', timezones: ['Indian/Comoro'] },
  { name: 'Congo (Brazzaville)', timezones: ['Africa/Brazzaville'] },
  { name: 'Congo (Kinshasa)', timezones: ['Africa/Kinshasa'] },
  { name: 'Costa Rica', timezones: ['America/Costa_Rica'] },
  { name: 'Côte d’Ivoire', timezones: ['Africa/Abidjan'] },
  { name: 'Croatia', timezones: ['Europe/Zagreb'] },
  { name: 'Cuba', timezones: ['America/Havana'] },
  { name: 'Cyprus', timezones: ['Asia/Nicosia'] },
  { name: 'Czechia', timezones: ['Europe/Prague'] },
  { name: 'Denmark', timezones: ['Europe/Copenhagen'] },
  { name: 'Djibouti', timezones: ['Africa/Djibouti'] },
  { name: 'Dominica', timezones: ['America/Dominica'] },
  { name: 'Dominican Republic', timezones: ['America/Santo_Domingo'] },
  { name: 'Ecuador', timezones: ['America/Guayaquil'] },
  { name: 'Egypt', timezones: ['Africa/Cairo'] },
  { name: 'El Salvador', timezones: ['America/El_Salvador'] },
  { name: 'Equatorial Guinea', timezones: ['Africa/Malabo'] },
  { name: 'Eritrea', timezones: ['Africa/Asmara'] },
  { name: 'Estonia', timezones: ['Europe/Tallinn'] },
  { name: 'Eswatini', timezones: ['Africa/Mbabane'] },
  { name: 'Ethiopia', timezones: ['Africa/Addis_Ababa'] },
  { name: 'Fiji', timezones: ['Pacific/Fiji'] },
  { name: 'Finland', timezones: ['Europe/Helsinki'] },
  { name: 'France', timezones: ['Europe/Paris'] },
  { name: 'Gabon', timezones: ['Africa/Libreville'] },
  { name: 'Gambia', timezones: ['Africa/Banjul'] },
  { name: 'Georgia', timezones: ['Asia/Tbilisi'] },
  { name: 'Germany', timezones: ['Europe/Berlin'] },
  { name: 'Ghana', timezones: ['Africa/Accra'] },
  { name: 'Greece', timezones: ['Europe/Athens'] },
  { name: 'Grenada', timezones: ['America/Grenada'] },
  { name: 'Guatemala', timezones: ['America/Guatemala'] },
  { name: 'Guinea', timezones: ['Africa/Conakry'] },
  { name: 'Guinea-Bissau', timezones: ['Africa/Bissau'] },
  { name: 'Guyana', timezones: ['America/Guyana'] },
  { name: 'Haiti', timezones: ['America/Port-au-Prince'] },
  { name: 'Honduras', timezones: ['America/Tegucigalpa'] },
  { name: 'Hungary', timezones: ['Europe/Budapest'] },
  { name: 'Iceland', timezones: ['Atlantic/Reykjavik'] },
  { name: 'India', timezones: ['Asia/Kolkata'] },
  { name: 'Indonesia', timezones: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] },
  { name: 'Iran', timezones: ['Asia/Tehran'] },
  { name: 'Iraq', timezones: ['Asia/Baghdad'] },
  { name: 'Ireland', timezones: ['Europe/Dublin'] },
  { name: 'Israel', timezones: ['Asia/Jerusalem'] },
  { name: 'Italy', timezones: ['Europe/Rome'] },
  { name: 'Jamaica', timezones: ['America/Jamaica'] },
  { name: 'Japan', timezones: ['Asia/Tokyo'] },
  { name: 'Jordan', timezones: ['Asia/Amman'] },
  { name: 'Kazakhstan', timezones: ['Asia/Almaty', 'Asia/Aqtau'] },
  { name: 'Kenya', timezones: ['Africa/Nairobi'] },
  { name: 'Kiribati', timezones: ['Pacific/Kiritimati'] },
  { name: 'Kuwait', timezones: ['Asia/Kuwait'] },
  { name: 'Kyrgyzstan', timezones: ['Asia/Bishkek'] },
  { name: 'Laos', timezones: ['Asia/Vientiane'] },
  { name: 'Latvia', timezones: ['Europe/Riga'] },
  { name: 'Lebanon', timezones: ['Asia/Beirut'] },
  { name: 'Lesotho', timezones: ['Africa/Maseru'] },
  { name: 'Liberia', timezones: ['Africa/Monrovia'] },
  { name: 'Libya', timezones: ['Africa/Tripoli'] },
  { name: 'Liechtenstein', timezones: ['Europe/Vaduz'] },
  { name: 'Lithuania', timezones: ['Europe/Vilnius'] },
  { name: 'Luxembourg', timezones: ['Europe/Luxembourg'] },
  { name: 'Madagascar', timezones: ['Indian/Antananarivo'] },
  { name: 'Malawi', timezones: ['Africa/Blantyre'] },
  { name: 'Malaysia', timezones: ['Asia/Kuala_Lumpur'] },
  { name: 'Maldives', timezones: ['Indian/Maldives'] },
  { name: 'Mali', timezones: ['Africa/Bamako'] },
  { name: 'Malta', timezones: ['Europe/Malta'] },
  { name: 'Marshall Islands', timezones: ['Pacific/Majuro'] },
  { name: 'Mauritania', timezones: ['Africa/Nouakchott'] },
  { name: 'Mauritius', timezones: ['Indian/Mauritius'] },
  { name: 'Mexico', timezones: ['America/Mexico_City', 'America/Monterrey', 'America/Los_Angeles'] },
  { name: 'Micronesia', timezones: ['Pacific/Chuuk'] },
  { name: 'Moldova', timezones: ['Europe/Chisinau'] },
  { name: 'Monaco', timezones: ['Europe/Monaco'] },
  { name: 'Mongolia', timezones: ['Asia/Ulaanbaatar'] },
  { name: 'Montenegro', timezones: ['Europe/Podgorica'] },
  { name: 'Morocco', timezones: ['Africa/Casablanca'] },
  { name: 'Mozambique', timezones: ['Africa/Maputo'] },
  { name: 'Myanmar', timezones: ['Asia/Yangon'] },
  { name: 'Namibia', timezones: ['Africa/Windhoek'] },
  { name: 'Nauru', timezones: ['Pacific/Nauru'] },
  { name: 'Nepal', timezones: ['Asia/Kathmandu'] },
  { name: 'Netherlands', timezones: ['Europe/Amsterdam'] },
  { name: 'New Zealand', timezones: ['Pacific/Auckland'] },
  { name: 'Nicaragua', timezones: ['America/Managua'] },
  { name: 'Niger', timezones: ['Africa/Niamey'] },
  { name: 'Nigeria', timezones: ['Africa/Lagos'] },
  { name: 'North Korea', timezones: ['Asia/Pyongyang'] },
  { name: 'North Macedonia', timezones: ['Europe/Skopje'] },
  { name: 'Norway', timezones: ['Europe/Oslo'] },
  { name: 'Oman', timezones: ['Asia/Muscat'] },
  { name: 'Pakistan', timezones: ['Asia/Karachi'] },
  { name: 'Palau', timezones: ['Pacific/Palau'] },
  { name: 'Panama', timezones: ['America/Panama'] },
  { name: 'Papua New Guinea', timezones: ['Pacific/Port_Moresby'] },
  { name: 'Paraguay', timezones: ['America/Asuncion'] },
  { name: 'Peru', timezones: ['America/Lima'] },
  { name: 'Philippines', timezones: ['Asia/Manila'] },
  { name: 'Poland', timezones: ['Europe/Warsaw'] },
  { name: 'Portugal', timezones: ['Europe/Lisbon'] },
  { name: 'Qatar', timezones: ['Asia/Qatar'] },
  { name: 'Romania', timezones: ['Europe/Bucharest'] },
  { name: 'Russia', timezones: ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Vladivostok'] },
  { name: 'Rwanda', timezones: ['Africa/Kigali'] },
  { name: 'Saint Kitts and Nevis', timezones: ['America/St_Kitts'] },
  { name: 'Saint Lucia', timezones: ['America/St_Lucia'] },
  { name: 'Saint Vincent and the Grenadines', timezones: ['America/St_Vincent'] },
  { name: 'Samoa', timezones: ['Pacific/Apia'] },
  { name: 'San Marino', timezones: ['Europe/San_Marino'] },
  { name: 'São Tomé and Príncipe', timezones: ['Africa/Sao_Tome'] },
  { name: 'Saudi Arabia', timezones: ['Asia/Riyadh'] },
  { name: 'Senegal', timezones: ['Africa/Dakar'] },
  { name: 'Serbia', timezones: ['Europe/Belgrade'] },
  { name: 'Seychelles', timezones: ['Indian/Mahe'] },
  { name: 'Sierra Leone', timezones: ['Africa/Freetown'] },
  { name: 'Singapore', timezones: ['Asia/Singapore'] },
  { name: 'Slovakia', timezones: ['Europe/Bratislava'] },
  { name: 'Slovenia', timezones: ['Europe/Ljubljana'] },
  { name: 'Solomon Islands', timezones: ['Pacific/Guadalcanal'] },
  { name: 'Somalia', timezones: ['Africa/Mogadishu'] },
  { name: 'South Africa', timezones: ['Africa/Johannesburg'] },
  { name: 'South Korea', timezones: ['Asia/Seoul'] },
  { name: 'South Sudan', timezones: ['Africa/Juba'] },
  { name: 'Spain', timezones: ['Europe/Madrid'] },
  { name: 'Sri Lanka', timezones: ['Asia/Colombo'] },
  { name: 'Sudan', timezones: ['Africa/Khartoum'] },
  { name: 'Suriname', timezones: ['America/Paramaribo'] },
  { name: 'Sweden', timezones: ['Europe/Stockholm'] },
  { name: 'Switzerland', timezones: ['Europe/Zurich'] },
  { name: 'Syria', timezones: ['Asia/Damascus'] },
  { name: 'Taiwan', timezones: ['Asia/Taipei'] },
  { name: 'Tajikistan', timezones: ['Asia/Dushanbe'] },
  { name: 'Tanzania', timezones: ['Africa/Dar_es_Salaam'] },
  { name: 'Thailand', timezones: ['Asia/Bangkok'] },
  { name: 'Timor-Leste', timezones: ['Asia/Dili'] },
  { name: 'Togo', timezones: ['Africa/Lome'] },
  { name: 'Tonga', timezones: ['Pacific/Tongatapu'] },
  { name: 'Trinidad and Tobago', timezones: ['America/Port_of_Spain'] },
  { name: 'Tunisia', timezones: ['Africa/Tunis'] },
  { name: 'Turkey', timezones: ['Europe/Istanbul'] },
  { name: 'Turkmenistan', timezones: ['Asia/Ashgabat'] },
  { name: 'Tuvalu', timezones: ['Pacific/Funafuti'] },
  { name: 'Uganda', timezones: ['Africa/Kampala'] },
  { name: 'Ukraine', timezones: ['Europe/Kyiv'] },
  { name: 'United Arab Emirates', timezones: ['Asia/Dubai'] },
  { name: 'United Kingdom', timezones: ['Europe/London'] },
  { name: 'United States', timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'] },
  { name: 'Uruguay', timezones: ['America/Montevideo'] },
  { name: 'Uzbekistan', timezones: ['Asia/Tashkent'] },
  { name: 'Vanuatu', timezones: ['Pacific/Efate'] },
  { name: 'Vatican City', timezones: ['Europe/Vatican'] },
  { name: 'Venezuela', timezones: ['America/Caracas'] },
  { name: 'Vietnam', timezones: ['Asia/Ho_Chi_Minh'] },
  { name: 'Yemen', timezones: ['Asia/Aden'] },
  { name: 'Zambia', timezones: ['Africa/Lusaka'] },
  { name: 'Zimbabwe', timezones: ['Africa/Harare'] },
  { name: 'Holy See', timezones: ['Europe/Vatican'] },
  { name: 'Palestine', timezones: ['Asia/Hebron'] },
  { name: 'Kosovo', timezones: ['Europe/Belgrade'] },
  { name: 'Taiwan', timezones: ['Asia/Taipei'] },
  { name: 'United States Minor Outlying Islands', timezones: ['Pacific/Honolulu'] }
];

const COUNTRY_LOOKUP = new Map(COUNTRY_LIBRARY.map(country => [country.name.toLowerCase(), country]));

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function getCountryOptions(): CountryOption[] {
  return COUNTRY_LIBRARY;
}

export function searchCountries(query: string): CountryOption[] {
  const normalized = normalize(query);
  if (!normalized) return COUNTRY_LIBRARY.slice(0, 20);

  const scored = COUNTRY_LIBRARY.map(country => {
    const haystack = `${country.name}`.toLowerCase();
    const exact = haystack === normalized ? 100 : 0;
    const prefix = haystack.startsWith(normalized) ? 40 : 0;
    const contains = haystack.includes(normalized) ? 20 : 0;
    const tokenMatches = normalized.split(/\s+/).filter(Boolean).reduce((score, token) => {
      return score + (haystack.includes(token) ? 10 : 0);
    }, 0);

    return { country, score: exact + prefix + contains + tokenMatches };
  })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.country);

  return scored.slice(0, 8);
}

export function detectUserCountryAndTimezone(): { country: string; timezone: string } {
  try {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    
    for (const country of COUNTRY_LIBRARY) {
      if (country.timezones.some(tz => tz.toLowerCase() === userTz.toLowerCase())) {
        return { country: country.name, timezone: userTz };
      }
    }

    // Secondary fallback matching by country code / timezone prefix
    const region = userTz.split('/')[0];
    if (region === 'America') {
      return { country: 'United States', timezone: userTz };
    } else if (region === 'Europe') {
      return { country: 'United Kingdom', timezone: userTz };
    } else if (region === 'Asia') {
      return { country: 'Saudi Arabia', timezone: userTz };
    }

    return { country: '', timezone: userTz };
  } catch {
    return { country: '', timezone: 'UTC' };
  }
}

export function getDefaultTimezoneForCountry(country: string): string {
  const found = COUNTRY_LOOKUP.get(normalize(country));
  return found?.timezones[0] || 'UTC';
}

export function getCountryTimezones(country: string): string[] {
  const found = COUNTRY_LOOKUP.get(normalize(country));
  return found?.timezones || [];
}

function normalizeOffset(offset: string): string {
  const match = offset.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return offset === 'UTC' ? 'GMT+00:00' : offset;
  }

  const [, sign, hours, minutes = '00'] = match;
  return `GMT${sign}${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

export function formatTimezoneForDisplay(timezone: string): string {
  try {
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value || 'GMT';
    const label = timezone.replace(/_/g, ' ').split('/').pop() || timezone;
    return `${normalizeOffset(offset)} ${label}`;
  } catch {
    const label = timezone.replace(/_/g, ' ').split('/').pop() || timezone;
    return timezone === 'UTC' ? 'GMT+00:00 UTC' : label;
  }
}

export function getTimezoneDisplayLabel(timezone: string): string {
  const formatted = formatTimezoneForDisplay(timezone);
  const offset = formatted.split(' ')[0];
  const label = formatted.split(' ').slice(1).join(' ');
  return `(${offset}) ${label}`;
}
