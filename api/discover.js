const GRANTS_GOV_SEARCH = 'https://api.grants.gov/v1/api/search2';
const CANDID_RFP_SEARCH = 'https://api.candid.org/rfp/v1/search';

// These records keep the hackathon demo usable until Candid credentials are
// issued. They are fictional opportunities shaped like our normalized Candid
// RFP response; they are never represented as live Candid search results.
const CANDID_SAMPLE_OPPORTUNITIES = [
  {
    id: 'miami-grant-offer-demo',
    title: 'Miami Grant Offer — Youth Wellness Microgrant',
    number: 'CANDID-DEMO-001',
    agency: 'Miami Grant Offer · Fictional demo funder',
    description: 'A sample foundation opportunity for community-led youth wellness projects in Greater Miami.',
    openDate: 'Open year-round',
    closeDate: 'Rolling review',
    status: 'sample opportunity',
    awardCeiling: 'Up to $1,000',
    serviceArea: 'Greater Miami',
    eligibility: 'Community-led projects with a clear public benefit and local connection',
    sourceUrl: '',
    matchedPriorities: ['mental health', 'youth', 'families'],
    source: 'Candid-formatted sample data',
    isCandid: true,
    isMock: true,
    isCandidSample: true,
  },
  {
    id: 'candid-demo-family-wellbeing',
    title: 'Family Wellbeing & Resilience Fund',
    number: 'CANDID-DEMO-002',
    agency: 'Harborlight Foundation · Fictional demo funder',
    description: 'Sample opportunity supporting family counseling, caregiver support, and youth resilience programs.',
    openDate: 'November 1, 2026',
    closeDate: 'December 12, 2026',
    status: 'sample opportunity',
    awardCeiling: 'Up to $25,000',
    serviceArea: 'South Florida',
    matchedPriorities: ['families', 'counseling', 'youth'],
    source: 'Candid-formatted sample data',
    isCandid: true,
    isCandidSample: true,
  },
  {
    id: 'candid-demo-school-partnerships',
    title: 'Healthy Schools Partnership Grants',
    number: 'CANDID-DEMO-003',
    agency: 'Bright Futures Trust · Fictional demo funder',
    description: 'Sample opportunity for school-based wellness workshops and student mentoring partnerships.',
    openDate: 'October 15, 2026',
    closeDate: 'January 8, 2027',
    status: 'sample opportunity',
    awardCeiling: '$10,000–$20,000',
    serviceArea: 'Florida',
    matchedPriorities: ['school workshops', 'mentoring', 'youth'],
    source: 'Candid-formatted sample data',
    isCandid: true,
    isCandidSample: true,
  },
];

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

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') || '';
}

function displayValue(value, fallback = 'Not listed') {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback;
  if (value && typeof value === 'object') return firstValue(value.name, value.label, value.value, value.title) || fallback;
  return String(value || fallback);
}

function displayAmount(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  if (typeof value === 'object') {
    const ceiling = firstValue(value.max, value.maximum, value.award_ceiling, value.amount);
    const floor = firstValue(value.min, value.minimum, value.award_floor);
    if (ceiling && floor) return `${displayValue(floor)}–${displayValue(ceiling)}`;
    return displayValue(ceiling || value);
  }
  return String(value);
}

function candidRecords(payload) {
  const possibleLists = [
    payload?.data,
    payload?.opportunities,
    payload?.results,
    payload?.data?.opportunities,
    payload?.data?.results,
    payload?.data?.items,
    payload?.response?.data,
    payload?.items,
  ];
  return possibleLists.find(Array.isArray) || [];
}

function normalizeCandidOpportunity(opportunity) {
  const title = displayValue(firstValue(opportunity.title, opportunity.name, opportunity.opportunity_title, opportunity.opportunity_name), 'Open foundation RFP');
  const funder = opportunity.funder || opportunity.funder_organization || {};
  const description = displayValue(firstValue(opportunity.description, opportunity.summary, opportunity.opportunity_description), 'Open foundation funding opportunity');
  const subject = firstValue(opportunity.subject_area, opportunity.subject_areas, opportunity.subjects);
  const population = firstValue(opportunity.population_served, opportunity.populations_served, opportunity.populations);
  const geography = firstValue(opportunity.geographic_area, opportunity.geographic_areas, opportunity.geography, opportunity.service_area);

  return {
    id: `candid-${firstValue(opportunity.id, opportunity.opportunity_id, opportunity.uuid, title)}`,
    title: cleanText(title),
    number: cleanText(displayValue(firstValue(opportunity.opportunity_id, opportunity.id, opportunity.reference_number), 'Candid open RFP')),
    agency: cleanText(displayValue(firstValue(opportunity.funder_name, opportunity.organization_name, funder.name, funder.organization_name), 'Foundation funder')),
    description: cleanText(description),
    openDate: cleanText(displayValue(firstValue(opportunity.open_date, opportunity.start_date, opportunity.posted_date), 'Open now')),
    closeDate: cleanText(displayValue(firstValue(opportunity.deadline, opportunity.deadline_date, opportunity.close_date, opportunity.end_date), 'See funder guidelines')),
    status: 'open RFP',
    awardCeiling: cleanText(displayAmount(firstValue(opportunity.award_amount, opportunity.grant_amount, opportunity.amount, opportunity.funding_amount, opportunity.award_ceiling))),
    serviceArea: cleanText(displayValue(geography, 'See funder guidelines')),
    sourceUrl: cleanText(firstValue(opportunity.application_url, opportunity.url, opportunity.source_url, opportunity.opportunity_url, opportunity.website_url)),
    matchedPriorities: profileFit(`${title} ${description} ${displayValue(subject, '')} ${displayValue(population, '')} ${displayValue(geography, '')}`),
    source: 'Candid Open RFP',
    isCandid: true,
  };
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
    const grantsGovRequest = fetch(GRANTS_GOV_SEARCH, {
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
    const candidEnabled = Boolean(process.env.CANDID_API_KEY);
    const candidRequest = candidEnabled
      ? fetch(`${CANDID_RFP_SEARCH}?${new URLSearchParams({ search_term: query, size: '12', page_number: '1' })}`, {
        headers: { 'Subscription-Key': process.env.CANDID_API_KEY },
      })
      : Promise.resolve(null);
    const [grantsGovResult, candidResult] = await Promise.allSettled([grantsGovRequest, candidRequest]);

    let liveOpportunities = [];
    let grantsGovStatus = 'unavailable';
    let grantsGovHitCount = 0;
    if (grantsGovResult.status === 'fulfilled' && grantsGovResult.value.ok) {
      const payload = await grantsGovResult.value.json();
      grantsGovHitCount = payload.data?.hitCount || 0;
      liveOpportunities = (payload.data?.oppHits || []).map(opportunity => ({
      id: String(opportunity.id),
      title: cleanText(opportunity.title),
      number: cleanText(opportunity.number),
      agency: cleanText(opportunity.agency || opportunity.agencyName || opportunity.agencyCode || 'Federal agency'),
      openDate: cleanText(opportunity.openDate || 'Not listed'),
      closeDate: cleanText(opportunity.closeDate || 'No close date listed'),
      status: cleanText(opportunity.oppStatus || 'posted'),
      sourceUrl: `https://www.grants.gov/search-results-detail/${encodeURIComponent(opportunity.id)}`,
      matchedPriorities: profileFit(opportunity.title || ''),
      source: 'Grants.gov',
      }));
      grantsGovStatus = 'connected';
    }

    let candidOpportunities = CANDID_SAMPLE_OPPORTUNITIES;
    let candidStatus = 'sample data';
    if (candidResult?.status === 'fulfilled' && candidResult.value) {
      if (candidResult.value.ok) {
        const candidPayload = await candidResult.value.json();
        candidOpportunities = candidRecords(candidPayload).map(normalizeCandidOpportunity);
        candidStatus = 'connected';
      } else {
        candidStatus = `unavailable (${candidResult.value.status})`;
      }
    }

    const opportunities = [...candidOpportunities, ...liveOpportunities];

    response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return response.status(200).json({
      source: 'Grants.gov + Candid Open RFP or Candid-formatted sample data',
      searchedAt: new Date().toISOString(),
      query,
      totalFound: grantsGovHitCount + candidOpportunities.length,
      liveCount: liveOpportunities.length,
      candidCount: candidOpportunities.length,
      providers: {
        grantsGov: { status: grantsGovStatus, count: liveOpportunities.length },
        candid: { status: candidStatus, count: candidOpportunities.length },
      },
      opportunities,
    });
  } catch (error) {
    return response.status(502).json({
      error: 'Live Grants.gov search is temporarily unavailable. Please try again.',
      detail: error.message,
    });
  }
}
