/**
 * /offer/accept/$token — public offer-letter acceptance page.
 *
 * NO UserView gate — candidates aren't logged in. Security is by the
 * unguessable acceptance_token UUID in the URL + Supabase RLS that
 * only permits SELECT/UPDATE on rows matched by that token.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { AcceptOfferPage } from "@/MyComponents/OfferLetters/AcceptOfferPage";

export const Route = createLazyFileRoute("/offer/accept/$token")({
  component: AcceptOfferPage,
});

export default AcceptOfferPage;
