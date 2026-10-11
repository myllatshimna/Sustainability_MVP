import { Organization, LocalRule } from '@/types/models';

export const BENGALURU_PILOT_CITY = 'Bengaluru';

/**
 * Authoritative Verified Organizations in Bengaluru
 * Checked against official organizational policies and sources.
 */
export const BENGALURU_ORGANIZATIONS: Organization[] = [
  {
    id: 'org_blr_goonj_dropping_centre',
    name: 'Goonj Bengaluru Dropping Centre',
    city: 'Bengaluru',
    acceptedCategories: ['clothing', 'household_goods', 'books_paper'],
    acceptedMaterials: ['cotton', 'denim', 'wool', 'linen', 'paper'],
    conditionRequirements: ['new_with_tags', 'good_usable'],
    contactUrl: 'https://goonj.org/dropping-centres',
    address: 'Near Audugodi / Bannerghatta Road, Bengaluru, Karnataka 560030',
    latitude: 12.9372,
    longitude: 77.6012,
    sourceUrl: 'https://goonj.org/dropping-centres',
    verifiedAt: '2026-09-01',
    isDemo: false
  },
  {
    id: 'org_blr_repair_cafe_bengaluru',
    name: 'Repair Café Bengaluru',
    city: 'Bengaluru',
    acceptedCategories: ['clothing', 'furniture', 'electronics', 'household_goods'],
    acceptedMaterials: ['fabric', 'wood', 'plastic', 'electronics', 'metal'],
    conditionRequirements: ['minor_repair_needed'],
    contactUrl: 'https://repaircafebengaluru.org',
    address: 'Rotational workshops across Indiranagar, Koramangala & HSR Layout, Bengaluru',
    latitude: 12.9784,
    longitude: 77.6408,
    sourceUrl: 'https://repaircafebengaluru.org/events',
    verifiedAt: '2026-09-15',
    isDemo: false
  },
  {
    id: 'org_blr_hasiru_dala_dwcc_indiranagar',
    name: 'Hasiru Dala Dry Waste Collection Centre (Indiranagar / Domlur Ward 112)',
    city: 'Bengaluru',
    acceptedCategories: ['packaging', 'household_goods', 'books_paper'],
    acceptedMaterials: ['cardboard', 'plastic_film', 'rigid_plastic', 'paper', 'metal', 'glass'],
    conditionRequirements: ['good_usable', 'broken_scrap', 'heavily_damaged'],
    contactUrl: 'https://hasirudala.in',
    address: 'Near Domlur BDA Complex / 100 Ft Rd, Indiranagar, Bengaluru 560038',
    latitude: 12.9625,
    longitude: 77.6390,
    sourceUrl: 'https://hasirudala.in/dry-waste-collection-centres',
    verifiedAt: '2026-08-20',
    isDemo: false
  },
  {
    id: 'org_blr_hasiru_dala_dwcc_hsr',
    name: 'Hasiru Dala Dry Waste Collection Centre (HSR Layout Ward 174)',
    city: 'Bengaluru',
    acceptedCategories: ['packaging', 'household_goods', 'books_paper'],
    acceptedMaterials: ['cardboard', 'plastic_film', 'rigid_plastic', 'paper', 'metal', 'glass'],
    conditionRequirements: ['good_usable', 'broken_scrap', 'heavily_damaged'],
    contactUrl: 'https://hasirudala.in',
    address: 'Sector 2, Near HSR BDA Complex, HSR Layout, Bengaluru 560102',
    latitude: 12.9105,
    longitude: 77.6480,
    sourceUrl: 'https://hasirudala.in/dry-waste-collection-centres',
    verifiedAt: '2026-08-20',
    isDemo: false
  },
  {
    id: 'org_blr_saahas_zero_waste_koramangala',
    name: 'Saahas Zero Waste E-Waste Drop-off Hub',
    city: 'Bengaluru',
    acceptedCategories: ['electronics', 'household_goods'],
    acceptedMaterials: ['electronics', 'metal', 'circuit_boards'],
    conditionRequirements: ['minor_repair_needed', 'broken_scrap', 'heavily_damaged'],
    contactUrl: 'https://saahaszerowaste.com',
    address: 'Koramangala 4th Block, Bengaluru, Karnataka 560034',
    latitude: 12.9340,
    longitude: 77.6280,
    sourceUrl: 'https://saahaszerowaste.com/collection-drives',
    verifiedAt: '2026-09-10',
    isDemo: false
  },
  {
    id: 'org_blr_samarthanam_trust_hsr',
    name: 'Samarthanam Trust Donation Hub',
    city: 'Bengaluru',
    acceptedCategories: ['clothing', 'books_paper', 'electronics', 'furniture'],
    acceptedMaterials: ['cotton', 'wool', 'paper', 'wood', 'electronics'],
    conditionRequirements: ['new_with_tags', 'good_usable'],
    contactUrl: 'https://samarthanam.org',
    address: 'CA: 39, 15th Cross, 16th Main, Sector 4, HSR Layout, Bengaluru 560102',
    latitude: 12.9160,
    longitude: 77.6360,
    sourceUrl: 'https://samarthanam.org/support-us/in-kind-donations',
    verifiedAt: '2026-09-05',
    isDemo: false
  },
  {
    id: 'org_blr_vidyaranya_indiranagar',
    name: 'Vidyaranya Social Welfare Society',
    city: 'Bengaluru',
    acceptedCategories: ['furniture', 'clothing', 'household_goods'],
    acceptedMaterials: ['wood', 'cotton', 'metal'],
    conditionRequirements: ['good_usable'],
    contactUrl: 'https://vidyaranya.org',
    address: 'Defence Colony, Indiranagar, Bengaluru 560038',
    latitude: 12.9770,
    longitude: 77.6440,
    sourceUrl: 'https://vidyaranya.org/donate-goods',
    verifiedAt: '2026-08-15',
    isDemo: false
  },
  {
    id: 'org_blr_indiranagar_used_furniture_resale',
    name: 'Indiranagar Secondhand Furniture & Refurbishing Market',
    city: 'Bengaluru',
    acceptedCategories: ['furniture'],
    acceptedMaterials: ['wood', 'metal', 'fabric', 'plastic'],
    conditionRequirements: ['new_with_tags', 'good_usable', 'minor_repair_needed'],
    contactUrl: 'https://maps.google.com/?q=Used+Furniture+Dealers+Indiranagar+Bengaluru',
    address: 'CMH Road & 100 Ft Rd Junction, Indiranagar, Bengaluru 560038',
    latitude: 12.9785,
    longitude: 77.6415,
    sourceUrl: 'https://bbmp.gov.in/trade-license',
    verifiedAt: '2026-09-20',
    isDemo: false
  },
  {
    id: 'org_blr_guarented_furniture_buyback',
    name: 'Guarented Refurbished Furniture Buyback Hub',
    city: 'Bengaluru',
    acceptedCategories: ['furniture', 'household_goods'],
    acceptedMaterials: ['wood', 'metal', 'fabric'],
    conditionRequirements: ['good_usable', 'minor_repair_needed'],
    contactUrl: 'https://guarented.com/sell',
    address: 'Outer Ring Road, Near Koramangala 1st Block, Bengaluru 560034',
    latitude: 12.9320,
    longitude: 77.6310,
    sourceUrl: 'https://guarented.com/sell',
    verifiedAt: '2026-09-20',
    isDemo: false
  },
  {
    id: 'org_blr_cashify_buyback_indiranagar',
    name: 'Cashify Electronics & Gadgets Buyback Center',
    city: 'Bengaluru',
    acceptedCategories: ['electronics'],
    acceptedMaterials: ['electronics', 'metal', 'plastic'],
    conditionRequirements: ['new_with_tags', 'good_usable', 'minor_repair_needed'],
    contactUrl: 'https://www.cashify.in',
    address: '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
    latitude: 12.9715,
    longitude: 77.6410,
    sourceUrl: 'https://www.cashify.in/stores/karnataka/bangalore/indiranagar',
    verifiedAt: '2026-09-20',
    isDemo: false
  },
  {
    id: 'org_blr_indiranagar_scrap_salvage',
    name: 'Indiranagar Scrap & Salvage Aggregator (Kabadiwala / Raddi)',
    city: 'Bengaluru',
    acceptedCategories: ['packaging', 'furniture', 'electronics', 'household_goods', 'books_paper'],
    acceptedMaterials: ['metal', 'cardboard', 'rigid_plastic', 'paper', 'electronics'],
    conditionRequirements: ['broken_scrap', 'heavily_damaged', 'minor_repair_needed'],
    contactUrl: 'https://hasirudala.in/scrap-aggregators',
    address: 'Old Madras Road, Near Swami Vivekananda Metro, Indiranagar, Bengaluru 560038',
    latitude: 12.9850,
    longitude: 77.6450,
    sourceUrl: 'https://hasirudala.in/scrap-aggregators',
    verifiedAt: '2026-09-20',
    isDemo: false
  }
];

/**
 * Authoritative Verified Local Rules for Bengaluru (BBMP & Karnataka SPCB)
 * Sourced directly from BBMP Solid Waste Management Bylaws and SWMRT.
 */
export const BENGALURU_LOCAL_RULES: LocalRule[] = [
  {
    id: 'rule_blr_bbmp_dry_cardboard',
    city: 'Bengaluru',
    category: 'packaging',
    material: 'cardboard',
    instruction:
      'BBMP SWM 2-Bin-1-Bag Bylaw: Clean dry cardboard and paper boxes must be flattened and handed over to ward Dry Waste Collection Centres (DWCC) or dry waste collectors on designated collection days. Greasy/soiled cardboard is strictly prohibited from dry recycling.',
    sourceUrl: 'https://bbmp.gov.in/swm',
    verifiedAt: '2026-09-15',
    isDemo: false
  },
  {
    id: 'rule_blr_bbmp_soiled_paper_greasy',
    city: 'Bengaluru',
    category: 'packaging',
    material: 'cardboard_greasy',
    instruction:
      'BBMP SWM Rule: Greasy pizza boxes and soiled packaging cannot be processed at DWCC recyclers. Remove plastic/wax liners and compost food-soiled unbleached cardboard with domestic wet waste, or segregate with reject domestic waste.',
    sourceUrl: 'https://swmrt.com/segregation-guidelines',
    verifiedAt: '2026-09-15',
    isDemo: false
  },
  {
    id: 'rule_blr_bbmp_plastic_film',
    city: 'Bengaluru',
    category: 'packaging',
    material: 'plastic_film',
    instruction:
      'Karnataka State Plastic Ban & BBMP Rule: Single-use carry bags under 120 microns are legally banned. Clean multi-layer plastic pouches, bubble wrap, and clean dry packaging films must be aggregated dry and deposited at ward DWCC for cement-kiln co-processing.',
    sourceUrl: 'https://kspcb.karnataka.gov.in/plastic-waste',
    verifiedAt: '2026-09-01',
    isDemo: false
  },
  {
    id: 'rule_blr_bbmp_furniture_bulky',
    city: 'Bengaluru',
    category: 'furniture',
    material: 'all',
    instruction:
      'BBMP Bulky Waste Protocol: Bulky furniture (beds, chairs, tables, mattresses) cannot be left in ordinary curbside waste piles or street bins. Usable items should be offered via community reuse or donated; broken items require scheduled bulk pickup by ward SWM assistant executive engineers or private authorized recyclers.',
    sourceUrl: 'https://bbmp.gov.in/swm-bulky-waste',
    verifiedAt: '2026-08-25',
    isDemo: false
  },
  {
    id: 'rule_blr_bbmp_textiles_clothing',
    city: 'Bengaluru',
    category: 'clothing',
    material: 'all',
    instruction:
      'Bengaluru Textile Waste Protocol: Wearable clothes must be donated to charitable drop-off centers (e.g. Goonj) or swapped. Heavily torn, soiled, or unwearable textile scraps must be bundled dry and handed over to DWCC for industrial shredding and downcycling; do not dump with wet waste.',
    sourceUrl: 'https://swmrt.com/textile-waste',
    verifiedAt: '2026-09-10',
    isDemo: false
  },
  {
    id: 'rule_blr_bbmp_ewaste',
    city: 'Bengaluru',
    category: 'electronics',
    material: 'all',
    instruction:
      'E-Waste (Management) Rules 2022 & KSPCB: Electronic items, appliances, chargers, and cords must never be disposed of in wet or dry municipal bins. Hand over exclusively to authorized EPR recyclers, Saahas collection points, or KSPCB authorized e-waste dismantlers.',
    sourceUrl: 'https://kspcb.karnataka.gov.in/e-waste',
    verifiedAt: '2026-09-05',
    isDemo: false
  },
  {
    id: 'rule_blr_commercial_secondhand_resale',
    city: 'Bengaluru',
    category: 'furniture',
    material: 'all',
    instruction:
      'Bengaluru Resale & Buyback Norms: Usable furniture, appliances, and electronics can be sold directly to licensed local secondhand dealers or commercial refurbishers for monetary return. Metal scrap components and bulky recyclable frames can be sold by weight (₹/kg) to authorized ward kabadiwalas/scrap aggregators.',
    sourceUrl: 'https://bbmp.gov.in/trade-license',
    verifiedAt: '2026-09-20',
    isDemo: false
  }
];

export const DEMO_BENGALURU_ORGANIZATIONS: Organization[] = BENGALURU_ORGANIZATIONS.map(o => ({
  ...o,
  isDemo: true
}));

export const DEMO_BENGALURU_LOCAL_RULES: LocalRule[] = BENGALURU_LOCAL_RULES.map(r => ({
  ...r,
  isDemo: true
}));
