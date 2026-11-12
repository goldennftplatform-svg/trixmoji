(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TrixHuntEngine = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Prices and refunds are represented in integer cents to avoid rounding drift.
  var PACKS = Object.freeze({
    bullet: Object.freeze({ name: 'bullet', priceCents: 500, bestProbability: 0.04, shots: 10 }),
    shotgun: Object.freeze({ name: 'shotgun', priceCents: 750, bestProbability: 0.50, shots: 10 }),
    sniper: Object.freeze({ name: 'sniper', priceCents: 1000, bestProbability: 0.80, shots: 10 })
  });

  function copy(value) {
    if (Array.isArray(value)) return value.map(copy);
    if (value && typeof value === 'object') {
      var result = {};
      Object.keys(value).forEach(function (key) { result[key] = copy(value[key]); });
      return result;
    }
    return value;
  }

  function secureRandom() {
    var crypto = typeof globalThis !== 'undefined' && globalThis.crypto;
    if (!crypto || typeof crypto.getRandomValues !== 'function') {
      throw new Error('crypto.getRandomValues is unavailable; provide random explicitly');
    }
    var value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] / 4294967296;
  }

  function createSession(options) {
    options = options || {};
    var pack = PACKS[options.pack];
    if (!Object.prototype.hasOwnProperty.call(PACKS, options.pack)) throw new Error('Unknown pack');
    if (!Array.isArray(options.inventory)) throw new TypeError('inventory must be an array');
    var players = options.players === undefined ? 1 : options.players;
    if (players !== 1 && players !== 2) throw new RangeError('players must be 1 or 2');
    var random = options.random === undefined ? secureRandom : options.random;
    if (typeof random !== 'function') throw new TypeError('random must be a function');
    var ids = new Set();
    var inventory = options.inventory.map(function (item) {
      if (!item || (typeof item.id !== 'string' && typeof item.id !== 'number') ||
          !Number.isInteger(item.rank) || item.rank < 1 || typeof item.symbol !== 'string' ||
          !Array.isArray(item.tiles)) throw new TypeError('Invalid inventory entry');
      if (ids.has(item.id)) throw new Error('Duplicate inventory id');
      ids.add(item.id);
      return copy(item);
    });
    var state = {
      pack: copy(pack), players: players, shotsRemaining: pack.shots,
      shotsTaken: 0, nextPlayer: 0, status: 'active', reason: null,
      refundCents: 0, inventoryRemaining: inventory.length, receipts: [], results: []
    };

    function finish(reason) {
      state.status = reason === 'cancelled' ? 'cancelled' : 'finished';
      state.reason = reason;
      state.refundCents = state.shotsRemaining * pack.priceCents / pack.shots;
      state.nextPlayer = null;
    }
    function draw() {
      var value = random();
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) {
        throw new RangeError('random must return a number in [0, 1)');
      }
      return value;
    }
    if (!inventory.length) finish('inventory_exhausted');

    function shoot(hit) {
      if (state.status !== 'active') throw new Error('Session is not active');
      if (typeof hit !== 'boolean') throw new TypeError('hit must be a boolean');
      var player = state.nextPlayer;
      var tier = null;
      var prize = null;
      var index = -1;
      if (hit) {
        tier = draw() < pack.bestProbability ? 'best' : 'normal';
        var candidates = [];
        inventory.forEach(function (item, i) {
          if ((item.rank === 1) === (tier === 'best')) candidates.push(i);
        });
        if (!candidates.length) {
          finish('tier_exhausted');
          var errorReceipt = { type: 'error', code: 'tier_exhausted', tier: tier,
            player: player, message: 'Selected ' + tier + ' tier is empty; unused shots refunded.',
            refundCents: state.refundCents };
          state.receipts.push(errorReceipt);
          return copy(errorReceipt);
        }
        index = candidates[Math.floor(draw() * candidates.length)];
        prize = inventory[index];
      }
      // All random draws and validation precede mutation, so a failed draw consumes nothing.
      if (hit) inventory.splice(index, 1);
      state.shotsRemaining--;
      state.shotsTaken++;
      state.inventoryRemaining = inventory.length;
      var receipt = { type: 'shot', shot: state.shotsTaken, player: player,
        hit: hit, tier: tier, prize: prize ? copy(prize) : null };
      state.receipts.push(receipt);
      if (prize) state.results.push({ player: player, shot: state.shotsTaken, prize: copy(prize) });
      if (!state.shotsRemaining) finish('ammo_exhausted');
      else if (!inventory.length) finish('inventory_exhausted');
      else state.nextPlayer = state.shotsTaken % players;
      return copy(receipt);
    }

    function cancel() {
      if (state.status !== 'active') throw new Error('Session is not active');
      finish('cancelled');
      var receipt = { type: 'cancellation', refundCents: state.refundCents };
      state.receipts.push(receipt);
      return copy(receipt);
    }

    return { shoot: shoot, cancel: cancel, get state() { return copy(state); } };
  }

  return { PACKS: PACKS, createSession: createSession };
}));
