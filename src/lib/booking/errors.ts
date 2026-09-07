export type BookingErrorCode =
  | "SERVICE_NOT_FOUND"
  | "SERVICE_UNAVAILABLE"
  | "STAFF_NOT_FOUND"
  | "STAFF_UNAVAILABLE"
  | "STAFF_CANNOT_PERFORM_SERVICE"
  | "DATE_OUT_OF_RANGE"
  | "OUTSIDE_WORKING_HOURS"
  | "LEAD_TIME"
  | "SLOT_TAKEN"
  | "SLOT_INVALID"
  | "CUSTOMER_BLOCKED"
  | "APPOINTMENT_NOT_FOUND"
  | "APPOINTMENT_LOCKED"
  | "CANCELLATION_WINDOW"
  | "VALIDATION";

const MESSAGES: Record<BookingErrorCode, string> = {
  SERVICE_NOT_FOUND: "Valittua palvelua ei löytynyt.",
  SERVICE_UNAVAILABLE: "Tämä palvelu ei ole tällä hetkellä varattavissa verkossa.",
  STAFF_NOT_FOUND: "Valittua tekijää ei löytynyt.",
  STAFF_UNAVAILABLE: "Valittu tekijä ei ole varattavissa.",
  STAFF_CANNOT_PERFORM_SERVICE: "Valittu tekijä ei tee tätä palvelua.",
  DATE_OUT_OF_RANGE: "Valittu päivä on varausikkunan ulkopuolella.",
  OUTSIDE_WORKING_HOURS: "Valittu aika on aukioloaikojen ulkopuolella.",
  LEAD_TIME: "Aika on liian lähellä. Valitse myöhäisempi aika.",
  SLOT_TAKEN: "Valitettavasti tämä aika ehdittiin juuri varata. Valitse toinen aika.",
  SLOT_INVALID: "Valittu aika ei ole varattavissa. Valitse listalta vapaa aika.",
  CUSTOMER_BLOCKED: "Varausta ei voitu tehdä. Ota yhteyttä salonkiin.",
  APPOINTMENT_NOT_FOUND: "Varausta ei löytynyt tai linkki on vanhentunut.",
  APPOINTMENT_LOCKED: "Tätä varausta ei voi enää muuttaa verkossa. Ota yhteyttä salonkiin.",
  CANCELLATION_WINDOW: "Peruutusaika on umpeutunut. Ota yhteyttä salonkiin.",
  VALIDATION: "Tarkista lomakkeen tiedot.",
};

export class BookingError extends Error {
  code: BookingErrorCode;
  status: number;
  details?: unknown;

  constructor(code: BookingErrorCode, opts: { status?: number; details?: unknown; message?: string } = {}) {
    super(opts.message ?? MESSAGES[code]);
    this.name = "BookingError";
    this.code = code;
    this.status = opts.status ?? defaultStatus(code);
    this.details = opts.details;
  }
}

function defaultStatus(code: BookingErrorCode): number {
  switch (code) {
    case "SLOT_TAKEN":
      return 409;
    case "SERVICE_NOT_FOUND":
    case "STAFF_NOT_FOUND":
    case "APPOINTMENT_NOT_FOUND":
      return 404;
    case "CUSTOMER_BLOCKED":
      return 403;
    case "VALIDATION":
      return 422;
    default:
      return 400;
  }
}

export function isBookingError(e: unknown): e is BookingError {
  return e instanceof BookingError;
}
