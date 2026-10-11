import { Organization, LocalRule } from '@/types/models';

export const PILOT_CITY = 'Seattle';

export const SEATTLE_ORGANIZATIONS: Organization[] = [
  {
    id: 'org_seattle_goodwill',
    name: 'Seattle Goodwill (Capitol Hill)',
    city: 'Seattle',
    acceptedCategories: ['clothing', 'furniture', 'household_goods', 'books_paper'],
    acceptedMaterials: ['cotton', 'wool', 'synthetic_fabric', 'wood', 'metal'],
    conditionRequirements: ['new_with_tags', 'good_usable'],
    contactUrl: 'https://evergreengoodwill.org/locations/capitol-hill',
    address: '115 Belmont Ave E, Seattle, WA 98102',
    latitude: 47.6192,
    longitude: -122.3245,
    sourceUrl: 'https://evergreengoodwill.org/donation-guidelines',
    verifiedAt: '2026-09-15',
    isDemo: false
  },
  {
    id: 'org_seattle_ballard_tool_library',
    name: 'Ballard Tool Library & Fixers Collective',
    city: 'Seattle',
    acceptedCategories: ['furniture', 'electronics', 'household_goods'],
    acceptedMaterials: ['wood', 'metal', 'plastic', 'electronics'],
    conditionRequirements: ['minor_repair_needed', 'good_usable'],
    contactUrl: 'https://ballardtoollibrary.org',
    address: '7549-B 15th Ave NW, Seattle, WA 98117',
    latitude: 47.6842,
    longitude: -122.3768,
    sourceUrl: 'https://ballardtoollibrary.org/fixers',
    verifiedAt: '2026-09-20',
    isDemo: false
  },
  {
    id: 'org_seattle_lifelong_thrift',
    name: 'Lifelong Thrift Store',
    city: 'Seattle',
    acceptedCategories: ['clothing', 'household_goods', 'books_paper'],
    acceptedMaterials: ['cotton', 'denim', 'leather', 'paper'],
    conditionRequirements: ['new_with_tags', 'good_usable'],
    contactUrl: 'https://www.lifelong.org/thrift-store',
    address: '312 Broadway E, Seattle, WA 98102',
    latitude: 47.6219,
    longitude: -122.3211,
    sourceUrl: 'https://www.lifelong.org/donation-guidelines',
    verifiedAt: '2026-08-30',
    isDemo: false
  },
  {
    id: 'org_seattle_re-store',
    name: 'The RE Store (Building & Furniture Salvage)',
    city: 'Seattle',
    acceptedCategories: ['furniture', 'household_goods'],
    acceptedMaterials: ['solid_wood', 'metal', 'glass'],
    conditionRequirements: ['good_usable', 'minor_repair_needed'],
    contactUrl: 'https://re-store.org',
    address: '2309 Meridian St, Bellingham / Seattle Hub, WA',
    latitude: 47.6062,
    longitude: -122.3321,
    sourceUrl: 'https://re-store.org/donate',
    verifiedAt: '2026-09-01',
    isDemo: false
  },
  {
    id: 'org_seattle_ridwell_partner_depot',
    name: 'Seattle Special Recycling Depot',
    city: 'Seattle',
    acceptedCategories: ['packaging', 'clothing'],
    acceptedMaterials: ['soft_plastics', 'bubble_wrap', 'polyethylene', 'scrap_fabric'],
    conditionRequirements: ['any', 'broken_scrap', 'heavily_damaged'],
    contactUrl: 'https://www.seattle.gov/utilities/your-services/collection-and-disposal/recycling/special-items',
    address: '8100 2nd Ave S, Seattle, WA 98108',
    latitude: 47.5307,
    longitude: -122.3314,
    sourceUrl: 'https://www.seattle.gov/utilities/where-does-it-go',
    verifiedAt: '2026-09-10',
    isDemo: false
  }
];

export const SEATTLE_LOCAL_RULES: LocalRule[] = [
  {
    id: 'rule_seattle_cardboard_packaging',
    city: 'Seattle',
    category: 'packaging',
    material: 'cardboard',
    instruction: 'Flatten all clean, dry corrugated boxes. Place in standard curbside blue recycling bin. Remove plastic packing tape or heavy adhesives if possible.',
    sourceUrl: 'https://www.seattle.gov/utilities/your-services/collection-and-disposal/recycling',
    verifiedAt: '2026-09-01',
    isDemo: false
  },
  {
    id: 'rule_seattle_soft_plastic_film',
    city: 'Seattle',
    category: 'packaging',
    material: 'plastic_film',
    instruction: 'Do NOT place plastic film, grocery bags, or bubble wrap in curbside bins (they jam sorting equipment). Bundle clean dry films for drop-off at participating grocery stores or special recycling depots.',
    sourceUrl: 'https://www.seattle.gov/utilities/where-does-it-go/plastic-bags',
    verifiedAt: '2026-09-01',
    isDemo: false
  },
  {
    id: 'rule_seattle_rigid_plastic_packaging',
    city: 'Seattle',
    category: 'packaging',
    material: 'rigid_plastic',
    instruction: 'Clean, empty plastic tubs, bottles, and jugs (#1-#5) are accepted curbside. Ensure they are free of food residue. Caps may be screwed back on.',
    sourceUrl: 'https://www.seattle.gov/utilities/where-does-it-go/plastics',
    verifiedAt: '2026-09-01',
    isDemo: false
  },
  {
    id: 'rule_seattle_textiles_damaged',
    city: 'Seattle',
    category: 'clothing',
    material: 'fabric',
    instruction: 'Torn, stained, or unwearable textiles are NOT accepted in curbside recycling. Clean, dry textiles can be dropped off at Seattle Goodwill or Threadcycle partners for fiber recycling.',
    sourceUrl: 'https://kingcounty.gov/depts/dnrp/solid-waste/programs/threadcycle.aspx',
    verifiedAt: '2026-09-05',
    isDemo: false
  },
  {
    id: 'rule_seattle_furniture_bulky',
    city: 'Seattle',
    category: 'furniture',
    material: 'wood_metal',
    instruction: 'Usable furniture should be donated or posted on community exchange. For non-repairable bulky items, schedule Seattle Public Utilities Special Bulky Item Collection or drop off at South Transfer Station.',
    sourceUrl: 'https://www.seattle.gov/utilities/your-services/collection-and-disposal/special-item-collections',
    verifiedAt: '2026-09-05',
    isDemo: false
  }
];

export const DEMO_ORGANIZATIONS: Organization[] = SEATTLE_ORGANIZATIONS.map(org => ({
  ...org,
  isDemo: true,
  name: `[Demo] ${org.name}`
}));

export const DEMO_LOCAL_RULES: LocalRule[] = SEATTLE_LOCAL_RULES.map(rule => ({
  ...rule,
  isDemo: true,
  instruction: `[Demo Pilot] ${rule.instruction}`
}));
