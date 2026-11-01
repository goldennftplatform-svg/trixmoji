/**
 * Retailer adapters for Attic drop tracking.
 * All adapters are STUBS until launch — check() returns { status: 'unknown', stub: true }
 * unless a real implementation is added and ATTIC_DROPS_LIVE=1.
 */

function stubAdapter(id, label) {
  return {
    id: id,
    label: label,
    implemented: false,
    async check(/* { url, sku, live } */) {
      return {
        status: 'unknown',
        stub: true,
        store: id,
        message: label + ' adapter not implemented — prep only'
      };
    }
  };
}

const registry = {
  walmart: stubAdapter('walmart', 'Walmart'),
  target: stubAdapter('target', 'Target'),
  bestbuy: stubAdapter('bestbuy', 'Best Buy'),
  dicks: stubAdapter('dicks', "Dick's Sporting Goods"),
  pokemoncenter: stubAdapter('pokemoncenter', 'Pokémon Center'),
  amazon: stubAdapter('amazon', 'Amazon')
};

function get(storeId) {
  if (!storeId) return null;
  const key = String(storeId).toLowerCase().replace(/[^a-z0-9]/g, '');
  // normalize dicks sporting goods etc
  if (key === 'dickssportinggoods' || key === 'dick') return registry.dicks;
  if (key === 'bestbuy' || key === 'bbuy') return registry.bestbuy;
  if (key === 'pokemon' || key === 'pokecenter' || key === 'pokemoncenter') {
    return registry.pokemoncenter;
  }
  return registry[key] || registry[storeId] || null;
}

function list() {
  return Object.keys(registry).map(function (k) {
    const a = registry[k];
    return { id: a.id, label: a.label, implemented: !!a.implemented };
  });
}

module.exports = {
  get: get,
  list: list,
  registry: registry
};
