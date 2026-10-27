// Vertical rhythm for Home, in one place so every section moves together.
//
// Tester feedback on the old Home was that it was crowded, and "the most
// important thing is adding space" — more so than the new card shapes. The gap
// between sections used to be 28 and was hardcoded separately in each section
// (the carousels, and again in the Spotlight and Orgs blocks); it is 36 here and
// they all read it, so tuning it is one number.

/** Space below each section, i.e. between one section's content and the next one's header. */
export const SECTION_GAP = 36;

/** Space between a section's header and its content. */
export const HEADER_GAP = 14;
