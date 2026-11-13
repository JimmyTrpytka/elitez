import { utcToZonedLocal } from "@/lib/dates";
import type { EventRow } from "@/lib/data/events";
import type { EventFormValues } from "./event-form";

/** Hodnoty formuláře z uloženého eventu (časy převedené na pražský čas). */
export function toEventFormValues(e: EventRow): EventFormValues {
  return {
    id: e.id,
    title: e.title,
    slug: e.slug,
    season_id: e.season_id ?? "",
    starts_at: utcToZonedLocal(e.starts_at, e.timezone),
    ends_at: utcToZonedLocal(e.ends_at, e.timezone),
    venue_name: e.venue_name ?? "",
    venue_address: e.venue_address ?? "",
    lat: e.lat,
    lng: e.lng,
    country: e.country ?? "",
    category: e.category,
    capacity: e.capacity?.toString() ?? "",
    description: e.description ?? "",
    program: e.program ?? "",
    rules: e.rules ?? "",
    selection_criteria: e.selection_criteria ?? "",
    access: e.access,
    verified_priority: e.verified_priority,
    verified_head_start_hours: e.verified_head_start_hours,
    registration_opens_at: utcToZonedLocal(e.registration_opens_at, e.timezone),
    registration_closes_at: utcToZonedLocal(e.registration_closes_at, e.timezone),
    social: {
      website_url: e.website_url,
      instagram_url: e.instagram_url,
      facebook_url: e.facebook_url,
      tiktok_url: e.tiktok_url,
      youtube_url: e.youtube_url,
    },
  };
}

export const EMPTY_EVENT_VALUES: EventFormValues = {
  title: "",
  slug: "",
  season_id: "",
  starts_at: "",
  ends_at: "",
  venue_name: "",
  venue_address: "",
  lat: null,
  lng: null,
  country: "CZ",
  category: "mix",
  capacity: "",
  description: "",
  program: "",
  rules: "",
  selection_criteria: "",
  access: "public",
  verified_priority: true,
  verified_head_start_hours: 0,
  registration_opens_at: "",
  registration_closes_at: "",
  social: {},
};
