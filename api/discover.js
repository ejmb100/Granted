const GRANTS_GOV_SEARCH = 'https://api.grants.gov/v1/api/search2';

function cleanText(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function profileFit(title) {
  const haystack = title.toLowerCase();
  const priorities = [
    ['mental health', 'mental health'],
    ['youth', 'youth'],
    ['child', 'youth'],
    ['school', 'school workshops'],
    ['family', 'families'],
    ['mentor', 'mentoring'],
    ['counsel', 'family counseling'],
  ].filter(([term]) => haystack.includes(term)).map(([, label]) => label);
  return priorities.length ? [...new Set(priorities)].slice(0, 3) : ['Tidepath’s verified nonprofit mission'];
}

export default async function handler(request, response) {
  // The Tidepath prototype can also be opened directly from Finder as index.html.
  // Allow that local page to read this public, server-side discovery response.
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  const query = String(request.query.q || request.body?.q || 'youth mental health').trim().slice(0, 180);
  if (!query) return response.status(400).json({ error: 'A search phrase is required.' });

  try {
    const grantsGovResponse = await fetch(GRANTS_GOV_SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: 12,
        startRecordNum: 0,
        keyword: query,
        oppStatuses: 'posted|forecasted',
        eligibilities: '',
        agencies: '',
        fundingCategories: '',
      }),
    });

    if (!grantsGovResponse.ok) throw new Error(`Grants.gov returned ${grantsGovResponse.status}`);
    const payload = await grantsGovResponse.json();
    const liveOpportunities = (payload.data?.oppHits || []).map(opportunity => ({
      id: String(opportunity.id),
      title: cleanText(opportunity.title),
      number: cleanText(opportunity.number),
      agency: cleanText(opportunity.agency || opportunity.agencyName || opportunity.agencyCode || 'Federal agency'),
      openDate: cleanText(opportunity.openDate || 'Not listed'),
      closeDate: cleanText(opportunity.closeDate || 'No close date listed'),
      status: cleanText(opportunity.oppStatus || 'posted'),
      sourceUrl: `https://www.grants.gov/search-results-detail/${encodeURIComponent(opportunity.id)}`,
      matchedPriorities: profileFit(opportunity.title || ''),
    }));

    const miamiGrantOffer = {
      id: 'miami-grant-offer-demo',
      title: 'Miami Grant Offer — Youth Wellness Microgrant',
      number: 'MGO-DEMO-2026',
      agency: 'Miami Grant Offer · Demo funder',
      openDate: 'Open year-round',
      closeDate: 'Rolling review',
      status: 'demo opportunity',
      fundingType: 'Community microgrant',
      awardCeiling: 'Up to $1,000',
      serviceArea: 'Greater Miami',
      eligibility: 'Community-led projects with a clear public benefit and local connection',
      sourceUrl: 'https://miami-grant-offer.vercel.app',
      matchedPriorities: ['mental health', 'youth', 'families'],
      isMock: true,
    };
    const opportunities = [miamiGrantOffer, ...liveOpportunities];

    response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return response.status(200).json({
      source: 'Grants.gov + Miami Grant Offer demo',
      searchedAt: new Date().toISOString(),
      query,
      totalFound: payload.data?.hitCount || 0,
      liveCount: liveOpportunities.length,
      opportunities,
    });
  } catch (error) {
    return response.status(502).json({
      error: 'Live Grants.gov search is temporarily unavailable. Please try again.',
      detail: error.message,
    });
  }
}
