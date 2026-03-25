# Xpoch v2 — AI War Game Design

## Core Identity

Real-time AI war game on a hex grid. Multiple AI models control factions, each trying to **annihilate all enemies** by destroying their cities. No cards, no hand management, no culture tracks — pure war strategy with economic and technological depth.

**Victory: Last faction standing. A faction dies when all its cities fall.**

---

## 1. Resources

Three resources drive everything:

| Resource | Source | Use |
|----------|--------|-----|
| **Gold** | Tiles, buildings, trade | Recruit units, build buildings, rush production |
| **Production** | City outskirts (per city) | Train units, construct buildings/wonders |
| **Research** | Cities with libraries/universities | Unlock techs |

No culture tokens, no coins dial, no trade dial. Simple numbers.

---

## 2. Map

### Terrain
| Terrain | Gold/tick | Production | Defense Bonus | Notes |
|---------|-----------|------------|---------------|-------|
| **Plains** | 1 | 2 | 0 | Farmland, food production |
| **Forest** | 0 | 2 | +1 | Defensive terrain, lumber |
| **Mountain** | 1 | 1 | +2 | High defense, mining |
| **Desert** | 0 | 0 | 0 | Wasteland |
| **Water** | 0 | 0 | — | Impassable until Navigation tech |

### Natural Resources (spawn randomly on some tiles)
| Resource | Effect when controlled |
|----------|----------------------|
| **Iron** | +1 strength to all infantry |
| **Horses** | +1 strength to all cavalry |
| **Saltpeter** | +1 strength to all artillery |
| **Oil** | Required for aircraft & tanks |

Controlling a tile with a resource gives the bonus to the entire faction.

---

## 3. Cities

### Capital
- Each faction starts with one **capital city**
- Capital has **+8 defense bonus**
- Losing your capital does NOT instantly kill you (you can fight on from other cities)
- But losing **all** cities = elimination

### Expansion Cities
- Built by **settler units** (produced by cities, costs 10 production)
- Settler is consumed when founding a city
- Max 4 cities total (capital + 3)
- New city must be 3+ hexes from any other city
- Cannot build on water or mountain

### City Mechanics
- Each city has **6 surrounding hexes** (outskirts)
- Outskirts produce gold/production/research based on terrain
- City can train units, build structures, or produce settlers
- **If an enemy army enters a city hex and wins combat, the city is captured** (not destroyed)
- Captured city switches to the attacker's faction

---

## 4. Units

### Unit Types

| Unit | Strength | Move | Cost | Trumps | Trumped By |
|------|----------|------|------|--------|------------|
| **Infantry** | 3 | 1 | 4 gold | Cavalry | Artillery |
| **Cavalry** | 3 | 2 | 6 gold | Artillery | Infantry |
| **Artillery** | 4 | 1 | 8 gold | Infantry | Cavalry |
| **Settler** | 0 | 1 | 10 gold | — | Everything |
| **Scout** | 1 | 3 | 3 gold | — | Everything |

**Trump** = Deals damage first. If the trump kills the target, it takes zero damage.

### Upgrades (via tech)
| Tech | Effect |
|------|--------|
| Iron Working | Infantry → **Swordsmen** (str 5) |
| Horseback Riding | Cavalry → **Knights** (str 5, move 3) |
| Gunpowder | Artillery → **Cannon** (str 6) |
| Industrialization | Unlock **Tanks** (str 7, move 2, costs 12 gold) |
| Flight | Unlock **Aircraft** (str 6, move 4, costs 15 gold, no trump weakness) |

### Stacking
- Max **3 units** per hex (increased by tech)
- When attacking, all units in the hex fight
- Defender terrain bonus applies to all defending units

---

## 5. Combat

### Resolution
When an army enters an enemy-occupied hex:

1. **Each unit fights independently** — no card draws, no hand sizes
2. Units are matched 1v1 from strongest to weakest
3. **Trump advantage**: If A trumps B, A deals damage first. If A kills B, A takes 0 damage.
4. Both sides deal damage equal to their strength simultaneously (unless trumped)
5. Unit dies when damage >= strength
6. Surviving units hold the hex

### Combat Modifiers
| Modifier | Bonus |
|----------|-------|
| **Forest** terrain | Defender +1 strength per unit |
| **Mountain** terrain | Defender +2 strength per unit |
| **City** | Defender +4 strength total |
| **Capital** | Defender +8 strength total |
| **City Walls** (building) | Defender +4 additional |
| **Barracks** (building) | Attacker from this city +2 strength total |
| **General** (great person) | +3 strength total |

### Capturing Cities
If the attacker wins combat at a **city hex**:
- City is **captured** (switches faction)
- Existing buildings preserved (captured intact)
- If this was the faction's last city → faction **eliminated**, all remaining units disbanded

---

## 6. Tech Tree

Linear tree with branches, not a pyramid. Each tech costs research points accumulated over turns.

### Era 1: Ancient (cost 6-10 research)
| Tech | Cost | Effect |
|------|------|--------|
| **Agriculture** | 6 | Plains tiles produce +1 food (supports larger armies) |
| **Mining** | 6 | Mountain tiles produce +1 gold |
| **Bronze Working** | 8 | Unlock Barracks building |
| **Pottery** | 6 | Unlock Granary building (+2 food per city) |
| **Animal Husbandry** | 8 | Unlock Cavalry unit |

### Era 2: Classical (cost 12-16, requires 2 Ancient techs)
| Tech | Cost | Effect |
|------|------|--------|
| **Iron Working** | 12 | Infantry → Swordsmen (str 5) |
| **Horseback Riding** | 12 | Cavalry → Knights (str 5, move 3) |
| **Masonry** | 14 | Unlock City Walls (+4 defense) |
| **Currency** | 12 | Markets produce +2 gold per city |
| **Navigation** | 16 | Units can cross water (not stop) |

### Era 3: Medieval (cost 18-22, requires 2 Classical techs)
| Tech | Cost | Effect |
|------|------|--------|
| **Gunpowder** | 18 | Artillery → Cannon (str 6) |
| **Engineering** | 20 | Buildings cost -2 production |
| **Sailing** | 18 | Units can stop on water, Harbor building |
| **Theology** | 20 | Unlock Temple (+1 research per city) |
| **Feudalism** | 22 | +1 max stacking limit |

### Era 4: Industrial (cost 24-30, requires 2 Medieval techs)
| Tech | Cost | Effect |
|------|------|--------|
| **Industrialization** | 24 | Unlock Tanks (str 7, move 2) |
| **Railroad** | 26 | All units +1 movement |
| **Rifling** | 24 | All Infantry +2 strength |
| **Steam Power** | 28 | Cities produce +3 production |
| **Dynamite** | 26 | Siege: +4 damage vs cities |

### Era 5: Modern (cost 32-40, requires 2 Industrial techs)
| Tech | Cost | Effect |
|------|------|--------|
| **Flight** | 32 | Unlock Aircraft (str 6, move 4, no trump) |
| **Nuclear Fission** | 40 | Unlock **Nuke** (destroys city instantly, one-use, 30 gold) |
| **Computers** | 34 | All cities +3 research |
| **Rocketry** | 36 | Artillery range: can attack 2 hexes away |
| **Modern Armor** | 32 | Tanks → Modern Armor (str 9, move 3) |

---

## 7. Buildings

Built in city outskirts. Each city can build multiple buildings on different hexes.

| Building | Cost | Terrain | Effect |
|----------|------|---------|--------|
| **Granary** | 4 | Plains | +2 food (supports +2 units) |
| **Barracks** | 6 | Any land | Units from this city +1 strength |
| **Workshop** | 5 | Mountain/Forest | +2 production |
| **Market** | 5 | Any land | +2 gold per turn |
| **Library** | 6 | Any land | +2 research per turn |
| **City Walls** | 8 | City center | +4 city defense |
| **Harbor** | 7 | Water (adjacent to city) | +2 gold, +1 production |
| **Fortress** | 10 | Any land | +3 defense on this hex, holds 5 units |
| **Factory** | 12 | Any land | +4 production (requires Industrialization) |
| **Airport** | 15 | Any land | Aircraft can deploy here (requires Flight) |

---

## 8. Wonders

Global unique buildings. First to build it owns it. Built in a city (costs production).

| Wonder | Era | Cost | Effect |
|--------|-----|------|--------|
| **Great Wall** | Ancient | 15 | All cities +2 defense |
| **Colossus** | Ancient | 12 | +3 gold per turn globally |
| **Pyramids** | Ancient | 18 | Settlers cost 50% less |
| **Himeji Castle** | Medieval | 20 | All units +1 strength when defending |
| **Machu Picchu** | Medieval | 16 | Mountain tiles produce +2 gold |
| **Kremlin** | Industrial | 25 | Rush production costs 50% less gold |
| **Pentagon** | Modern | 30 | +2 units per hex stacking limit |
| **Manhattan Project** | Modern | 35 | Unlock Nukes without Nuclear Fission tech |

---

## 9. Diplomacy

AI-driven. Each tick, AI can propose:

| Action | Effect |
|--------|--------|
| **Declare War** | Enable attacks. Already implicit if borders touch. |
| **Propose Alliance** | Cannot attack each other. Shared vision. |
| **Break Alliance** | Betrayal. Enables surprise attack next tick. |
| **Demand Tribute** | Ask for gold. Target can accept or refuse (→ war). |
| **Offer Peace** | Cease hostilities. Both must agree. |
| **Trade Gold** | Send gold to another faction |

Diplomacy is **cheap talk** — alliances can be broken at any time. AIs will learn to trust or distrust.

---

## 10. Economy

### Income (per tick)
- **Gold**: Sum of gold from all owned tiles + building bonuses + trade routes
- **Food**: Sum of food from farms/granaries. Each unit consumes 1 food/tick.
  - Excess food → stored (max 20)
  - Deficit → units starve (lose 1 HP per unfed unit)
- **Production**: Per city, from outskirt terrain + buildings. Used to build.
- **Research**: Per city, from libraries/universities. Accumulated toward next tech.

### Spending
- **Recruit units**: costs gold
- **Build buildings**: costs production (per city)
- **Rush production**: spend gold to instantly finish a building (2x cost in gold)
- **Research tech**: accumulated research spent automatically when threshold reached

---

## 11. Fog of War

- Each faction only sees hexes within **2 tiles** of their units and cities
- Unexplored hexes shown as dark to the AI
- Scouts have **vision range of 3**
- AI prompt only includes visible hexes — must explore to find enemies

---

## 12. AI Decision Format

Each tick, AI receives game state and responds with actions:

```json
{
  "military": [
    {"unit_id": "u1", "action": "move", "to": "3,-2"},
    {"unit_id": "u2", "action": "attack", "to": "4,-2"}
  ],
  "cities": [
    {"city_id": "c1", "action": "train", "unit_type": "infantry"},
    {"city_id": "c2", "action": "build", "building": "barracks", "hex": "1,3"}
  ],
  "research": "iron_working",
  "diplomacy": [
    {"action": "propose_alliance", "target": "faction_gpt"}
  ]
}
```

AI prompt includes:
1. **Your state**: cities, units, gold, food, production, research, tech unlocked
2. **Visible map**: terrain, enemy units/cities in vision range
3. **Threat level**: enemy strength estimates
4. **Available actions**: what you can build, research, recruit this tick
5. **Diplomacy inbox**: proposals from other factions

---

## Implementation Phases

### Phase 1: Core War Engine
- [ ] City system (capital, capture, outskirts, production)
- [ ] Unit types with stats (infantry, cavalry, artillery)
- [ ] Trump combat system (rock-paper-scissors)
- [ ] Gold/food/production economy
- [ ] Elimination victory

### Phase 2: Tech & Buildings
- [ ] Tech tree (5 eras, unlock units/buildings/bonuses)
- [ ] Research accumulation per city
- [ ] Buildings with terrain restrictions
- [ ] Unit upgrades via tech

### Phase 3: Advanced Military
- [ ] Scouts, settlers, city founding
- [ ] Tanks, aircraft, nukes
- [ ] Stacking, terrain defense modifiers
- [ ] Fog of war

### Phase 4: Strategic Layer
- [ ] Wonders
- [ ] Diplomacy system
- [ ] Natural resources (iron, horses, oil)
- [ ] Food/starvation mechanics

### Phase 5: AI Integration
- [ ] Restructure prompt for war game
- [ ] Multi-phase turn decisions
- [ ] Strategic planning (AI allocates between economy/military/tech)
- [ ] Threat assessment from visible information only
