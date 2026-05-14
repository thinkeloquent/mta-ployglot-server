export const LAYOUT_NAMES = Object.freeze({
  TABLE_LAYOUT:   'table',
  BOARD_LAYOUT:   'board',
  ROADMAP_LAYOUT: 'roadmap',
});

const REVERSE = Object.freeze(Object.fromEntries(
  Object.entries(LAYOUT_NAMES).map(([k, v]) => [v, k]),
));

export const toLayoutName = (enumName) => LAYOUT_NAMES[enumName] ?? enumName;
export const toLayoutEnum = (friendly) => REVERSE[friendly] ?? friendly;
