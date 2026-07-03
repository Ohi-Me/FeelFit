// FeelFit — medicine "buy" deep-links.
//
// Deep-links to each pharmacy's own search page — no scraping, no ToS
// violation, and affiliate-program-ready later (1mg/PharmEasy/Netmeds all have
// free affiliate signup) if you want it to earn a commission per click.

export interface BuyLink { label: string; url: string; }

export function getBuyLinks(name: string): BuyLink[] {
  const q = encodeURIComponent(name.trim());
  return [
    { label: '1mg', url: `https://www.1mg.com/search/all?name=${q}` },
    { label: 'PharmEasy', url: `https://pharmeasy.in/search/all?name=${q}` },
    { label: 'Netmeds', url: `https://www.netmeds.com/catalogsearch/result/${q}/all` },
  ];
}
