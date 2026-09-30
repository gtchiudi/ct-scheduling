import dayjs from "dayjs";

/**
 * Formats a date for the API as ISO 8601 with its UTC offset.
 *
 * The backend reads offset-less times as America/New_York, so sending bare
 * wall-clock time shifted appointments saved from any other browser timezone
 * (and from pickers running in a non-Eastern warehouse's timezone). Keeping
 * the offset makes the instant unambiguous; a dayjs already in a timezone via
 * .tz() keeps that zone's offset.
 */
export const toApiDateTime = (value) => dayjs(value).format("YYYY-MM-DDTHH:mm:ssZ");
