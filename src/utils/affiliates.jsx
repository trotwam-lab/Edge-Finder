// affiliates.js — turn every "best price at <book>" surface into a tracked
// outbound click. Sportsbook affiliate/CPA programs pay per depositing user,
// which monetizes free users too — a book name shown next to a good price is
// the highest-intent click in the app and should never be dead text.

import React from 'react';
import { AFFILIATE_LINKS, BOOKMAKERS } from '../constants.js';

// Some surfaces only carry the display title ("DraftKings"), not the key.
const KEY_BY_TITLE = Object.fromEntries(
  Object.entries(BOOKMAKERS).map(([key, title]) => [title.toLowerCase(), key])
);

function resolveBookKey(bookKeyOrTitle) {
  if (!bookKeyOrTitle) return null;
  const raw = String(bookKeyOrTitle);
  if (AFFILIATE_LINKS[raw]) return raw;
  return KEY_BY_TITLE[raw.toLowerCase()] || null;
}

// Best link for a book: the odds feed's per-outcome deeplink when present
// (lands directly on the bet slip), otherwise our affiliate/referral URL.
export function getBookUrl(bookKeyOrTitle, deeplink = null) {
  if (deeplink) return deeplink;
  const key = resolveBookKey(bookKeyOrTitle);
  return key ? AFFILIATE_LINKS[key] : AFFILIATE_LINKS.default;
}

// Inline anchor that keeps the surrounding row's styling and never triggers
// parent onClick handlers (cards toggle open on click).
export function BookLink({ book, deeplink = null, style = {}, children, title }) {
  const url = getBookUrl(book, deeplink);
  if (!url) return <>{children}</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener sponsored"
      title={title || 'Open sportsbook'}
      onClick={(e) => e.stopPropagation()}
      style={{ color: 'inherit', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px', ...style }}
    >
      {children}
    </a>
  );
}
