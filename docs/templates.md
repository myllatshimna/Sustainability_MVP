# Curated Organization and Local Rule Data Templates

## 1. Organization Record Template (JSON)
```json
{
  "id": "org_seattle_goodwill",
  "name": "Seattle Goodwill (Capitol Hill)",
  "city": "Seattle",
  "acceptedCategories": ["clothing", "furniture", "household_goods", "books_paper"],
  "acceptedMaterials": ["cotton", "wool", "synthetic_fabric", "wood", "metal"],
  "conditionRequirements": ["new_with_tags", "good_usable"],
  "contactUrl": "https://evergreengoodwill.org/locations/capitol-hill",
  "address": "115 Belmont Ave E, Seattle, WA 98102",
  "latitude": 47.6192,
  "longitude": -122.3245,
  "sourceUrl": "https://evergreengoodwill.org/donation-guidelines",
  "verifiedAt": "2026-09-15",
  "isDemo": false
}
```

## 2. Municipal Local Disposal Rule Template (JSON)
```json
{
  "id": "rule_seattle_cardboard_packaging",
  "city": "Seattle",
  "category": "packaging",
  "material": "cardboard",
  "instruction": "Flatten all clean, dry corrugated boxes. Place in standard curbside blue recycling bin. Remove plastic packing tape or heavy adhesives if possible.",
  "sourceUrl": "https://www.seattle.gov/utilities/your-services/collection-and-disposal/recycling",
  "verifiedAt": "2026-09-01",
  "isDemo": false
}
```

## 3. Data Integrity & Verification Standard
To expand ReLoop to additional pilot cities (e.g. Austin, Portland, Chicago):
1. **Never scrape or invent organizations or addresses.**
2. Coordinate with municipal solid waste departments or official reuse registries.
3. Verify coordinates with official geocoding before setting `latitude` and `longitude`.
4. Re-verify acceptance criteria and URLs quarterly, logging the date in `verifiedAt`.
